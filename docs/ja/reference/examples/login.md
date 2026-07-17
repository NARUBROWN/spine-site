# JWTログインの例

SpineでJWTベースのログインを実装します。

## プロジェクト構造
```
login-example/
├── go.mod
├── main.go
├── controller/
│   └── auth_controller.go
├── interceptor/
│   └── auth_interceptor.go
├── model/
│   └── user.go
└── store/
    └── user_store.go
```
## プロジェクトの作成
```bash
mkdir login-example
cd login-example
go mod init login-example
```
## 依存関係のインストール
```bash
go get github.com/NARUBROWN/spine
go get github.com/golang-jwt/jwt/v5
```
## モデル定義
```go
// model/user.go
package model

type User struct {
    ID       int64  `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"` // JSON レスポンス에서 제외
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
// store/user_store.go
package store

import (
    "errors"
    "login-example/model"
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
// interceptor/auth_interceptor.go
package interceptor

import (
    "strings"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key") // 実際の 환경에서는 환경변수 사용

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Authorization ヘッダー에서 トークン抽出
    authHeader := ctx.Header("Authorization")
    if authHeader == "" {
        return httperr.Unauthorized("トークンが必要です。")
    }

    // "Bearer {token}" 형식 파싱
    parts := strings.Split(authHeader, " ")
    if len(parts) != 2 || parts[0] != "Bearer" {
        return httperr.Unauthorized("不正なトークン形式です。")
    }

    tokenString := parts[1]

    // JWT トークン検証
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, httperr.Unauthorized("不正な 서명 方式입니다.")
        }
        return JWTSecret, nil
    })

    if err != nil || !token.Valid {
        return httperr.Unauthorized("無効なトークンです。")
    }

    // 토큰에서 ユーザー ID 抽出
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("토큰 클레임을 읽을 수 ありません.")
    }

    userID := int64(claims["user_id"].(float64))
    
    // ExecutionContext에 ユーザー ID 保存
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```
## コントローラ

ログイン、会員登録、個人情報検索機能を実装します。
```go
// controller/auth_controller.go
package controller

import (
    "time"

    "login-example/interceptor"
    "login-example/model"
    "login-example/store"

    "github.com/NARUBROWN/spine/core"
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
func (c *AuthController) Signup(req model.SignupRequest) (httpx.Response[model.User], error) {
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
func (c *AuthController) Login(req model.LoginRequest) (httpx.Response[model.LoginResponse], error) {
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
func (c *AuthController) GetMe(ctx core.ExecutionContext) (httpx.Response[model.User], error) {
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
## main.go

ルートを登録してサーバーを起動します。
```go
// main.go
package main

import (
    "log"
    "time"

    "login-example/controller"
    "login-example/interceptor"
    "login-example/store"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/route"
)

func main() {
    app := spine.New()

    // コンストラクタ登録
    app.Constructor(
        store.NewUserStore,
        controller.NewAuthController,
    )

    // グローバルインターセプタ — CORS
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
            AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
            AllowHeaders: []string{"Content-Type", "Authorization"},
        }),
    )

    // 公開 ルート — 認証不要
    app.Route("POST", "/signup", (*controller.AuthController).Signup)
    app.Route("POST", "/login", (*controller.AuthController).Login)

    // 保護された ルート — 認証が必要 (ルートインターセプタ 사용)
    app.Route(
        "GET",
        "/me",
        (*controller.AuthController).GetMe,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )

    log.Println("サーバー起動: http://localhost:8080")
    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```
## 実行
```bash
go run .
```
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
```bash
curl http://localhost:8080/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
   ├─→ CORS.PreHandle (전역)
   ├─→ AuthController.Signup
   └─→ Response 200

POST /login (公開)
   │
   ├─→ CORS.PreHandle (전역)
   ├─→ AuthController.Login
   └─→ Response 200 + JWT 토큰

GET /me (보호됨)
   │
   ├─→ CORS.PreHandle (전역)
   ├─→ Auth.PreHandle (ルート) ← トークン検証
   │       │
   │       ├─ 토큰 없음 → 401 Unauthorized
   │       └─ 토큰 유효 → ctx.Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + ユーザー 情報
```
## コアクリーンアップ

|ルート|メソッドインターセプター説明
|--------|--------|----------|------|
| `/signup` | POST |グローバルのみ|会員登録（公開）|
| `/login` | POST |グローバルのみ|ログイン後JWT発行（公開）|
| `/me` | GET |グローバル+ Auth |私の情報を見る（認証が必要）|