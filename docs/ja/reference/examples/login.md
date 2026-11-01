# JWTログインの例

SpineでJWTベースのログインを実装します。

## プロジェクト構造
```text
login-example/
├── go.mod
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
## CLIでプロジェクトを作成

先に[CLIをインストール](/ja/learn/getting-started/installation)します。CLI 0.1.4にJWT認証の生成器はありません。基本プロジェクトを生成し、以下の認証ファイルを`src/`に手動で追加します。

```sh
spine new login-example --module example.com/login-example
cd login-example
go mod tidy
spine doctor
go get github.com/golang-jwt/jwt/v5
```

## モデル定義
```go
// src/model/user.go
package model

type User struct {
    ID       int64  `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"` // JSONレスポンスから除外
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
## ユーザーストア

インメモリストアとして簡単に実装します。
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

// メールの重複チェック
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
## 認証インターセプタ

JWT トークンを検証するルートインターセプタです。
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
    // Authorizationヘッダーからトークンを抽出
    authHeader := ctx.Header("Authorization")
    if authHeader == "" {
        return httperr.Unauthorized("トークンが必要です。")
    }

    // 「Bearer {token}」形式を解析
    parts := strings.Split(authHeader, " ")
    if len(parts) != 2 || parts[0] != "Bearer" {
        return httperr.Unauthorized("不正なトークン形式です。")
    }

    tokenString := parts[1]

    // JWT トークン検証
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, httperr.Unauthorized("署名方式が不正です。")
        }
        return JWTSecret, nil
    }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

    if err != nil || !token.Valid {
        return httperr.Unauthorized("無効なトークンです。")
    }

    // トークンからユーザーIDを抽出
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("トークンクレームを読み取れません。")
    }

    rawID, ok := claims["user_id"].(float64)
    if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
        return httperr.Unauthorized("Invalid user ID claim.")
    }
    userID := int64(rawID)
    
    // ExecutionContextにユーザーIDを保存
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```
## コントローラ

ログイン、会員登録、個人情報検索機能を実装します。
```go
// src/controller/auth_controller.go
package controller

import (
    "time"

    "example.com/login-example/src/interceptor"
    "example.com/login-example/src/model"
    "example.com/login-example/src/store"

    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/golang-jwt/jwt/v5"
)

type AuthController struct {
    userStore *store.UserStore
}

func NewAuthController(userStore *store.UserStore) *AuthController {
    return &AuthController{
        userStore: userStore,
    }
}

//会員登録 - 認証は不要
func (c *AuthController) Signup(req *model.SignupRequest) (httpx.Response[model.User], error) {
    if req.Email == "" || req.Password == "" || req.Name == "" {
return httpx.Response[model.User]{}, httperr.BadRequest("すべてのフィールドを入力してください。")
    }

    user, err := c.userStore.Create(req.Email, req.Password, req.Name)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
    }

    return httpx.Response[model.User]{Body: *user}, nil
}

//ログイン - 認証は不要
func (c *AuthController) Login(req *model.LoginRequest) (httpx.Response[model.LoginResponse], error) {
    if req.Email == "" || req.Password == "" {
return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("メールとパスワードを入力してください。")
    }

    user, err := c.userStore.FindByEmail(req.Email)
    if err != nil {
return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("メールまたはパスワードが一致しません。")
    }

//パスワード確認(実際にはbcryptなどでハッシュ比較)
    if user.Password != req.Password {
return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("メールまたはパスワードが一致しません。")
    }

// JWTトークンの生成
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(interceptor.JWTSecret)
    if err != nil {
return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("トークンの生成に失敗しました。")
    }

    return httpx.Response[model.LoginResponse]{
        Body: model.LoginResponse{
            Token: tokenString,
            User:  *user,
        },
    }, nil
}

//私の情報の照会 - 認証が必要
func (c *AuthController) GetMe(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
// AuthInterceptorによって保存されたuserID照会
    userIDValue, ok := ctx.Get("userID")
    if !ok {
return httpx.Response[model.User]{}, httperr.Unauthorized("認証情報が見つかりません。")
    }

    userID := userIDValue.(int64)
    user, err := c.userStore.FindByID(userID)
    if err != nil {
return httpx.Response[model.User]{}, httperr.NotFound("ユーザーが見つかりません。")
    }

    return httpx.Response[model.User]{Body: *user}, nil
}
```
## アプリの構成

生成されたルートの`main.go`はそのまま使います。`BuildApplication`、`Validate`、`Run`の順に呼び出します。以下で`internal/application/application.go`を置き換えます。

```go
// internal/application/application.go
package application

import (
    "time"

    "example.com/login-example/src/controller"
    "example.com/login-example/src/interceptor"
    "example.com/login-example/src/store"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/route"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(store.NewUserStore, controller.NewAuthController)

    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders: []string{"Content-Type", "Authorization"},
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
    app.Route("POST", "/signup", (*controller.AuthController).Signup)
    app.Route("POST", "/login", (*controller.AuthController).Login)
    app.Route("GET", "/me", (*controller.AuthController).GetMe,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 検証と実行

```sh
gofmt -w src internal/application
go mod tidy
spine contract check
spine verify
spine dev
```

`contract check`は静的契約、`verify`は契約、gofmt、vet、Goテストを確認します。実際の登録・ログイン・認証リクエストは以下のHTTP例で別に確認します。メモリ保存と平文パスワード比較は学習用です。実際のサービスではパスワードハッシュと環境変数によるJWT秘密鍵を使ってください。

## APIテスト

### 会員登録
```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```
応答：
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
応答：
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
### 私の情報を見る（認証が必要）

トークンなしで要求：
```bash
curl http://localhost:8080/me
```
応答：
```json
{
"message": "トークンが必要です。"
}
```
トークンと一緒にリクエスト：
ログイン応答の`token`値を省略せずコピーします。以下の`read`を実行したらトークンを貼り付けてEnterを押し、`/me`を呼び出します。

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```
応答：
```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```
## ルートインターセプタの動作フロー
```
POST /signup (公開)
   │
   ├─→ CORS.PreHandle（グローバル）
   ├─→ AuthController.Signup
   └─→ Response 200

POST /login (公開)
   │
   ├─→ CORS.PreHandle（グローバル）
   ├─→ AuthController.Login
   └─→ Response 200 + JWTトークン

GET /me（保護対象）
   │
   ├─→ CORS.PreHandle（グローバル）
   ├─→ Auth.PreHandle (ルート) ← トークン検証
   │       │
   │       ├─ トークンなし → 401 Unauthorized
   │       └─ トークン有効 → ctx.Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + ユーザー 情報
```
## コアクリーンアップ

| ルート | メソッド | インターセプター | 説明 |
| --- | --- | --- | --- |
| `/signup` | POST | グローバルのみ | 会員登録（公開） |
| `/login` | POST | グローバルのみ | ログイン後JWTを発行（公開） |
| `/me` | GET | グローバル + Auth | 自分の情報を取得（認証が必要） |
