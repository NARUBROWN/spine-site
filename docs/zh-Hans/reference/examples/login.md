# JWT 登录示例

请先完成 [CLI 安装](/zh-Hans/learn/getting-started/installation)。CLI 0.1.4 不提供 JWT 认证生成器；先生成基础项目，再手动添加以下 `src/` 认证文件。

## 使用 CLI 创建项目

```sh
spine new login-example --module example.com/login-example
cd login-example
go mod tidy
spine doctor
go get github.com/golang-jwt/jwt/v5
```

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

## 模型

```go
// src/model/user.go
package model

type User struct {
    ID       int64  `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"`
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

## 用户存储

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

## 认证拦截器

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
    "strings"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key")

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    authHeader := ctx.Header("Authorization")
    if authHeader == "" {
        return httperr.Unauthorized("Token is required.")
    }
    parts := strings.Split(authHeader, " ")
    if len(parts) != 2 || parts[0] != "Bearer" {
        return httperr.Unauthorized("Invalid token format.")
    }

    tokenString := parts[1]
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, httperr.Unauthorized("Invalid signing method.")
        }
        return JWTSecret, nil
    }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

    if err != nil || !token.Valid {
        return httperr.Unauthorized("Invalid token.")
    }
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("Cannot read token claims.")
    }

    rawID, ok := claims["user_id"].(float64)
    if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
        return httperr.Unauthorized("Invalid user ID claim.")
    }
    userID := int64(rawID)
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    executionErr error,
) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```

## 控制器

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
func (c *AuthController) Signup(req *model.SignupRequest) (httpx.Response[model.User], error) {
    if req.Email == "" || req.Password == "" || req.Name == "" {
        return httpx.Response[model.User]{}, httperr.BadRequest("All fields are required.")
    }

    user, err := c.userStore.Create(req.Email, req.Password, req.Name)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
    }

    return httpx.Response[model.User]{Body: *user}, nil
}
func (c *AuthController) Login(req *model.LoginRequest) (httpx.Response[model.LoginResponse], error) {
    if req.Email == "" || req.Password == "" {
        return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("Email and password are required.")
    }

    user, err := c.userStore.FindByEmail(req.Email)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("Invalid email or password.")
    }
    if user.Password != req.Password {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("Invalid email or password.")
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(interceptor.JWTSecret)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("Failed to generate token.")
    }

    return httpx.Response[model.LoginResponse]{
        Body: model.LoginResponse{
            Token: tokenString,
            User:  *user,
        },
    }, nil
}
func (c *AuthController) GetMe(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
    userIDValue, ok := ctx.Get("userID")
    if !ok {
        return httpx.Response[model.User]{}, httperr.Unauthorized("Authentication info not found.")
    }

    userID := userIDValue.(int64)
    user, err := c.userStore.FindByID(userID)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.NotFound("User not found.")
    }

    return httpx.Response[model.User]{Body: *user}, nil
}
```

## 应用组装

保留生成的根目录 `main.go`，按 `BuildApplication`、`Validate`、`Run` 的顺序执行。使用以下内容替换 `internal/application/application.go`。

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

## 验证与运行

```sh
gofmt -w src internal/application
go mod tidy
spine contract check
spine verify
spine dev
```

`contract check` 检查静态契约；`verify` 检查契约、gofmt、vet 和 Go 测试。请使用下方 HTTP 示例单独验证注册、登录和认证请求。内存存储及明文密码比较仅用于学习；实际服务应使用密码哈希及环境变量中的 JWT 密钥。

```sh
curl -X POST http://localhost:8080/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"secret","name":"Alice"}'
curl -X POST http://localhost:8080/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"secret"}'
curl http://localhost:8080/me
```

复制登录响应中完整的 `token` 值。执行下方 `read` 后粘贴令牌并按 Enter，再请求 `/me`。

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

`/signup`、`/login` 公开，`/me` 需要登录响应中的实际令牌，缺少令牌时返回 HTTP 401。
