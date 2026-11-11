# JWT ログインの例

ユーザー登録とログインの API を作り、ログイン時に発行した JWT で自分の情報を取得します。認証インターセプターは `/me` にのみ適用するため、ユーザー登録とログインはトークンなしでリクエストできます。

## 事前準備

[インストール手順](/ja/learn/getting-started/installation)に沿って正式版の Spine CLI を導入します。この例では CLI `v0.4.4` とコア `v0.7.5` を使います。

この例では、認証フローを学ぶために、メモリ上のストア、平文のパスワード比較、コードに固定した JWT の秘密鍵を使用します。サーバーを終了すると登録情報は失われます。実際のサービスに適用する前に、パスワードハッシュと、環境変数で管理する JWT の秘密鍵を使用する必要があります。

## 1. プロジェクトを作成する

基本アプリと JWT の依存関係を準備します。以降のコマンドは `login-example/` で実行します。

以下のコマンドは `main` チャネルの正式版の依存関係を選択します。生成された `go.mod` でコアとプラットフォームのバージョンを確認してください。

```sh
spine new login-example --module example.com/login-example --channel main --validator playground --no-interactive
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
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type SignupRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
	Name     string `json:"name" validate:"required"`
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
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key") // 実際の環境では環境変数を使用

type AuthInterceptor struct{}

func (*AuthInterceptor) Constructor() *AuthInterceptor { return &AuthInterceptor{} }

func (i *AuthInterceptor) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	// Authorization ヘッダーからトークンを取得
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return httperr.Unauthorized("HTTP request required")
	}
	authHeader := request.Header("Authorization")
	if authHeader == "" {
		return httperr.Unauthorized("トークンが必要です。")
	}

	// "Bearer {token}" 形式を解析
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return httperr.Unauthorized("トークンの形式が正しくありません。")
	}

	tokenString := parts[1]

	// JWT トークンを検証
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, httperr.Unauthorized("署名方式が正しくありません。")
		}
		return JWTSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

	if err != nil || !token.Valid {
		return httperr.Unauthorized("トークンは無効です。")
	}

	// トークンからユーザー ID を取得
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return httperr.Unauthorized("トークンのクレームを読み取れません。")
	}

	rawID, ok := claims["user_id"].(float64)
	if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
		return httperr.Unauthorized("Invalid user ID claim.")
	}
	userID := int64(rawID)

	// ExecutionContext にユーザー ID を保存
	ctx.ExecutionContext().Set("userID", userID)

	return nil
}

func (i *AuthInterceptor) PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error {
	return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error) {}
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
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/golang-jwt/jwt/v5"
)

type AuthController struct {
	userStore *store.UserStore
}

func (*AuthController) Constructor(userStore *store.UserStore) *AuthController {
	return &AuthController{userStore: userStore}
}

func (c *AuthController) RegisterRoutes(r *api.Registry) {
	// ユーザー登録 — 認証不要
	r.POST("/signup", func(req input.Body[model.SignupRequest]) (httpx.Response[model.User], error) {
		user, err := c.userStore.Create(req.Email, req.Password, req.Name)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
		}

		return httpx.Response[model.User]{Body: *user}, nil
	})

	// ログイン — 認証不要
	r.POST("/login", func(req input.Body[model.LoginRequest]) (httpx.Response[model.LoginResponse], error) {
		user, err := c.userStore.FindByEmail(req.Email)
		if err != nil {
			return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("メールアドレスまたはパスワードが正しくありません。")
		}

		// パスワードを確認 (実際には bcrypt などでハッシュを比較)
		if user.Password != req.Password {
			return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("メールアドレスまたはパスワードが正しくありません。")
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
	})

	// 自分の情報を取得 — 認証が必要
	r.GET("/me", func(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
		// AuthInterceptor が保存した userID を取得
		userIDValue, ok := ctx.ExecutionContext().Get("userID")
		if !ok {
			return httpx.Response[model.User]{}, httperr.Unauthorized("認証情報が見つかりません。")
		}

		userID, valid := userIDValue.(int64)
		if !valid {
			return httpx.Response[model.User]{}, httperr.Unauthorized("invalid authentication context")
		}
		user, err := c.userStore.FindByID(userID)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.NotFound("ユーザーが見つかりません。")
		}

		return httpx.Response[model.User]{Body: *user}, nil
	}, api.Interceptors((*interceptor.AuthInterceptor)(nil)))
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
	"example.com/login-example/src/interceptor"
	"example.com/login-example/src/store"

	"github.com/NARUBROWN/spine"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/interceptor/cors"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Custom(store.NewUserStore), constructor.Interceptor(&interceptor.AuthInterceptor{}), constructor.Controller(&controller.AuthController{}))

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
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP:                   &boot.HTTPOptions{},
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
  "message": "トークンが必要です。"
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
   │       └─ トークン有効 → ctx.ExecutionContext().Set("userID", ...)
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
