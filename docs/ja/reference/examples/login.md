# JWT ログインの例

::: info
この例は `v0.7.1` のコントローラーとルートインターセプターを使います。以前の登録方法は[ルートの移行](/ja/learn/migration/preview-controller-routes)を参照してください。
:::

ユーザー登録とログインの API を作り、ログイン時に発行した JWT で自分の情報を取得します。認証インターセプターは `/me` にのみ適用するため、ユーザー登録とログインはトークンなしでリクエストできます。

## 事前準備

[CLI のインストール](/ja/learn/getting-started/installation)後、CLI `v0.4.3` 以降でプロジェクトを作成します。JWT コードを手動で追加し、`github.com/golang-jwt/jwt/v5` をインストールします。

この例では、認証フローを学ぶために、メモリ上のストア、平文のパスワード比較、コードに固定した JWT の秘密鍵を使用します。サーバーを終了すると登録情報は失われます。実際のサービスに適用する前に、パスワードハッシュと、環境変数で管理する JWT の秘密鍵を使用する必要があります。

## 1. プロジェクトを作成する

基本アプリと JWT の依存関係を準備します。以降のコマンドは `login-example/` で実行します。

以下のコマンドは正式依存関係チャンネルを使います。選択されたバージョンを `go.mod` で確認してください。

```sh
spine new login-example --layout legacy --module example.com/login-example --channel main --no-interactive
cd login-example
spine doctor
go get github.com/golang-jwt/jwt/v5@v5.3.1
```

### ファイル構成

以降の手順で `src/` 以下に 4 つのファイルを追加し、生成された `internal/application/application.go` を置き換えます。ルートの `main.go` と `spine.toml` はそのまま使用します。

```text
login-example/
├── go.mod
├── go.sum
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    ├── controller/auth_controller.go
    ├── interceptor/auth_interceptor.go
    ├── model/user.go
    └── store/user_store.go
```

## 2. ユーザーモデルとリクエスト、レスポンスを定義する

`src/model/user.go` を新規作成します。`Password` の `json:"-"` タグは、パスワードが JSON レスポンスに含まれることを防ぎます。

```go
// src/model/user.go
package model

type User struct {
    ID       int64  `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"` // JSON レスポンスから除外
    Name     string `json:"name"`
}

type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type LoginResponse struct {
    Token string `json:"token"`
    User  User   `json:"user"`
}

type SignupRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
    Name     string `json:"name"`
}
```

## 3. ユーザーストアを追加する

`src/store/user_store.go` を新規作成します。ユーザーをメモリに保存し、メールアドレスと ID で取得します。同じメールアドレスで再登録するとエラーを返します。

```go
// src/store/user_store.go
package store

import (
    "errors"
    "example.com/login-example/src/model"
    "sync"
)

type UserStore struct {
    mu     sync.RWMutex
    users  map[int64]*model.User
    nextID int64
}

func NewUserStore() *UserStore {
    return &UserStore{
        users:  make(map[int64]*model.User),
        nextID: 1,
    }
}

func (s *UserStore) Create(email, password, name string) (*model.User, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // メールアドレスの重複をチェック
    for _, u := range s.users {
        if u.Email == email {
            return nil, errors.New("email already exists")
        }
    }

    user := &model.User{
        ID:       s.nextID,
        Email:    email,
        Password: password,
        Name:     name,
    }
    s.users[s.nextID] = user
    s.nextID++

    return user, nil
}

func (s *UserStore) FindByEmail(email string) (*model.User, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    for _, u := range s.users {
        if u.Email == email {
            return u, nil
        }
    }
    return nil, errors.New("user not found")
}

func (s *UserStore) FindByID(id int64) (*model.User, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    user, ok := s.users[id]
    if !ok {
        return nil, errors.New("user not found")
    }
    return user, nil
}
```

## 4. 認証インターセプターを追加する

`src/interceptor/auth_interceptor.go` を新規作成します。`Authorization: Bearer <token>` ヘッダーから JWT を読み取り、署名と有効期限を検証します。検証した `user_id` は、コントローラーで読み取れるよう実行コンテキストに保存します。

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
    "strings"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key") // 実際の環境では環境変数を使用

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Authorization ヘッダーからトークンを取得
    authHeader := ctx.Header("Authorization")
    if authHeader == "" {
        return httperr.Unauthorized("토큰이 필요합니다.")
    }

    // "Bearer {token}" 形式を解析
    parts := strings.Split(authHeader, " ")
    if len(parts) != 2 || parts[0] != "Bearer" {
        return httperr.Unauthorized("잘못된 토큰 형식입니다.")
    }

    tokenString := parts[1]

    // JWT トークンを検証
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, httperr.Unauthorized("잘못된 서명 방식입니다.")
        }
        return JWTSecret, nil
    }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

    if err != nil || !token.Valid {
        return httperr.Unauthorized("유효하지 않은 토큰입니다.")
    }

    // トークンからユーザー ID を取得
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("토큰 클레임을 읽을 수 없습니다.")
    }

    rawID, ok := claims["user_id"].(float64)
    if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
        return httperr.Unauthorized("Invalid user ID claim.")
    }
    userID := int64(rawID)

    // ExecutionContext にユーザー ID を保存
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```

## 5. 認証コントローラーを追加する

`src/controller/auth_controller.go` を新規作成します。ユーザー登録ではユーザーを保存し、ログインではメールアドレスとパスワードを確認してから JWT を発行します。自分の情報を取得する処理では、インターセプターが保存したユーザー ID でストアを検索します。

```go
// src/controller/auth_controller.go
package controller

import (
    "time"

    "example.com/login-example/src/interceptor"
    "example.com/login-example/src/model"
    "example.com/login-example/src/store"

    "github.com/NARUBROWN/spine/pkg/api"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/golang-jwt/jwt/v5"
)

type AuthController struct {
    userStore *store.UserStore
}

func (*AuthController) Constructor(userStore *store.UserStore) *AuthController {
    return &AuthController{userStore: userStore}
}

func (c *AuthController) RegisterRoutes(r *api.Registry) {
    r.POST("/signup", c.Signup)
    r.POST("/login", c.Login)
    r.GET("/me", c.GetMe, api.Interceptors(&interceptor.AuthInterceptor{}))
}

// ユーザー登録 — 認証不要
func (c *AuthController) Signup(req *model.SignupRequest) (httpx.Response[model.User], error) {
    if req.Email == "" || req.Password == "" || req.Name == "" {
        return httpx.Response[model.User]{}, httperr.BadRequest("모든 필드를 입력해주세요.")
    }

    user, err := c.userStore.Create(req.Email, req.Password, req.Name)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
    }

    return httpx.Response[model.User]{Body: *user}, nil
}

// ログイン — 認証不要
func (c *AuthController) Login(req *model.LoginRequest) (httpx.Response[model.LoginResponse], error) {
    if req.Email == "" || req.Password == "" {
        return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("이메일과 비밀번호를 입력해주세요.")
    }

    user, err := c.userStore.FindByEmail(req.Email)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // パスワードを確認 (実際には bcrypt などでハッシュを比較)
    if user.Password != req.Password {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // JWT トークンを生成
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(interceptor.JWTSecret)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, err
    }

    return httpx.Response[model.LoginResponse]{
        Body: model.LoginResponse{
            Token: tokenString,
            User:  *user,
        },
    }, nil
}

// 自分の情報を取得 — 認証が必要
func (c *AuthController) GetMe(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
    // AuthInterceptor が保存した userID を取得
    userIDValue, ok := ctx.Get("userID")
    if !ok {
        return httpx.Response[model.User]{}, httperr.Unauthorized("인증 정보를 찾을 수 없습니다.")
    }

    userID, valid := userIDValue.(int64)
    if !valid {
        return httpx.Response[model.User]{}, httperr.Unauthorized("invalid authentication context")
    }
    user, err := c.userStore.FindByID(userID)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.NotFound("사용자를 찾을 수 없습니다.")
    }

    return httpx.Response[model.User]{Body: *user}, nil
}
```

## 6. コンストラクタと認証ルートを登録する

`internal/application/application.go` 全体を次のコードに置き換えます。ストアとコントローラーのコンストラクタを登録し、`/me` にのみ認証インターセプターを接続します。生成されたルートの `main.go` は、`BuildApplication`、`Validate`、`Run` を順に実行します。

```go
// internal/application/application.go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "time"

    "example.com/login-example/src/controller"
    "example.com/login-example/src/store"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New(echoplatform.Option())
    app.Constructor(store.NewUserStore, constructor.Controller(&controller.AuthController{}))

    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders: []string{"Content-Type", "Authorization"},
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 7. 検証してサーバーを起動する

プロジェクトルートでコードの書式を整え、依存関係とコードを検査してからサーバーを起動します。

```sh
gofmt -w src internal/application
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

`contract check` は静的な契約を検査します。`verify` は静的な契約に加え、gofmt、go vet、Go テストを検査します。実際のユーザー登録、ログイン、認証は、次の HTTP リクエストで確認します。

## 8. ユーザー登録と認証リクエストを確認する

サーバーを起動した状態で別のターミナルを開き、以下のリクエストを順に送信します。新しく起動したサーバーで最初に登録したユーザーの ID は `1` です。

### ユーザー登録

```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```

HTTP 200 と登録したユーザー情報が返されます。パスワードはレスポンスに含まれません。

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

### ログイン

```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234"}'
```

HTTP 200 と JWT が返されます。以下のレスポンスは、トークンを省略して表示した例です。`/me` をリクエストする際は、実際のレスポンスの `token` 値を使用します。

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "name": "Alice"
  }
}
```

### トークンなしで自分の情報を取得する

認証ヘッダーを付けずに `/me` をリクエストします。

```bash
curl http://localhost:8080/me
```

HTTP 401 と次のエラーメッセージが返されます。

```json
{
  "message": "토큰이 필요합니다."
}
```

### トークンで自分の情報を取得する

ログインレスポンスの `token` 値を省略せずにコピーします。まず以下の `read` コマンドを実行し、入力待ちの状態でトークンを貼り付けて Enter を押します。続けて `curl` コマンドで `/me` をリクエストします。

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

トークンが有効であれば、HTTP 200 と該当ユーザーの情報が返されます。

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

## 認証インターセプターの実行順序

CORS インターセプターはすべてのルートで実行されます。認証インターセプターは `/me` でトークンを検証し、コントローラーにユーザー ID を渡します。

```
POST /signup (公開)
   │
   ├─→ CORS.PreHandle (グローバル)
   ├─→ AuthController.Signup
   └─→ Response 200

POST /login (公開)
   │
   ├─→ CORS.PreHandle (グローバル)
   ├─→ AuthController.Login
   └─→ Response 200 + JWT トークン

GET /me (保護対象)
   │
   ├─→ CORS.PreHandle (グローバル)
   ├─→ Auth.PreHandle (ルート) ← トークン検証
   │       │
   │       ├─ トークンなし → 401 Unauthorized
   │       └─ トークン有効 → ctx.Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + ユーザー情報
```

## ルートごとの認証範囲

| ルート | メソッド | インターセプター | 説明 |
|--------|--------|----------|------|
| `/signup` | POST | CORS | トークンなしでユーザー登録 |
| `/login` | POST | CORS | トークンなしでログインし、JWT を発行 |
| `/me` | GET | CORS, Auth | JWT を検証して自分の情報を取得 |

## 次のステップ

[インターセプター API](/ja/reference/api/interceptor)で実行順序と各メソッドの役割を確認してください。ユーザー情報を永続的に保存するには、[データベース接続](/ja/learn/tutorial/5-database)を参照してください。
