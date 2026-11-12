# JWT 登录示例

创建注册和登录 API，并使用登录时签发的 JWT 查询个人信息。认证拦截器仅应用于 `/me`，因此注册和登录请求无需携带令牌。

## 开始前的准备

按[安装指南](/zh-Hans/learn/getting-started/installation)安装正式版 Spine CLI。本示例使用 CLI `v0.4.4` 和核心 `v0.7.5`。

本示例使用内存存储库、明文密码比较和硬编码的 JWT 密钥，帮助你了解认证流程。服务器结束后，注册信息会消失。在实际服务中使用前，必须改用密码哈希，并通过环境变量管理 JWT 密钥。

## 1. 创建项目

准备基础应用和 JWT 依赖。后续命令均在 `login-example/` 中运行。

以下命令选择 `main` 通道的正式版依赖。请在生成的 `go.mod` 中确认核心和平台版本。

```sh
spine new login-example --module example.com/login-example --channel main --validator playground --no-interactive
cd login-example
spine doctor
go get github.com/golang-jwt/jwt/v5@v5.3.1
```

### 文件布局

在后续步骤中，在 `src/` 下添加四个文件，并替换生成的 `internal/application/application.go`。继续使用根目录中的 `main.go` 和 `spine.toml`。

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

## 2. 定义用户模型、请求和响应

新建 `src/model/user.go`。`Password` 的 `json:"-"` 标签可防止密码被包含在 JSON 响应中。

```go
// src/model/user.go
package model

type User struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	Password string `json:"-"` // 从 JSON 响应中排除
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

## 3. 添加用户存储库

新建 `src/store/user_store.go`。在内存中保存用户，并通过邮箱和 ID 查询用户。再次使用相同邮箱注册时返回错误。

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

	// 检查邮箱是否重复
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

## 4. 添加认证拦截器

新建 `src/interceptor/auth_interceptor.go`。从 `Authorization: Bearer <token>` 请求头中读取 JWT，并验证签名和过期时间。将验证后的 `user_id` 保存到执行上下文中，供控制器读取。

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

var JWTSecret = []byte("your-secret-key") // 实际环境中请使用环境变量

type AuthInterceptor struct{}

func (*AuthInterceptor) Constructor() *AuthInterceptor { return &AuthInterceptor{} }

func (i *AuthInterceptor) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	// 从 Authorization 请求头中提取令牌
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return httperr.Unauthorized("HTTP request required")
	}
	authHeader := request.Header("Authorization")
	if authHeader == "" {
		return httperr.Unauthorized("需要令牌。")
	}

	// 解析 "Bearer {token}" 格式
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return httperr.Unauthorized("令牌格式无效。")
	}

	tokenString := parts[1]

	// 验证 JWT 令牌
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, httperr.Unauthorized("签名方法无效。")
		}
		return JWTSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

	if err != nil || !token.Valid {
		return httperr.Unauthorized("令牌无效。")
	}

	// 从令牌中提取用户 ID
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return httperr.Unauthorized("无法读取令牌声明。")
	}

	rawID, ok := claims["user_id"].(float64)
	if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
		return httperr.Unauthorized("Invalid user ID claim.")
	}
	userID := int64(rawID)

	// 在 ExecutionContext 中保存用户 ID
	ctx.ExecutionContext().Set("userID", userID)

	return nil
}

func (i *AuthInterceptor) PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error {
	return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error) {}
```

## 5. 添加认证控制器

新建 `src/controller/auth_controller.go`。注册时保存用户，登录时检查邮箱和密码后签发 JWT。查询个人信息时，使用拦截器保存的用户 ID 查询存储库。

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
	// 注册账户 — 无需身份验证
	r.POST("/signup", func(req input.Body[model.SignupRequest]) (httpx.Response[model.User], error) {
		user, err := c.userStore.Create(req.Email, req.Password, req.Name)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
		}

		return httpx.Response[model.User]{Body: *user}, nil
	})

	// 登录 — 无需身份验证
	r.POST("/login", func(req input.Body[model.LoginRequest]) (httpx.Response[model.LoginResponse], error) {
		user, err := c.userStore.FindByEmail(req.Email)
		if err != nil {
			return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("邮箱或密码不正确。")
		}

		// 检查密码（实际应用中使用 bcrypt 等比较哈希）
		if user.Password != req.Password {
			return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("邮箱或密码不正确。")
		}

		// 生成 JWT 令牌
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

	// 查询我的信息 — 需要身份验证
	r.GET("/me", func(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
		// 读取 AuthInterceptor 保存的 userID
		userIDValue, ok := ctx.ExecutionContext().Get("userID")
		if !ok {
			return httpx.Response[model.User]{}, httperr.Unauthorized("未找到身份验证信息。")
		}

		userID, valid := userIDValue.(int64)
		if !valid {
			return httpx.Response[model.User]{}, httperr.Unauthorized("invalid authentication context")
		}
		user, err := c.userStore.FindByID(userID)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.NotFound("未找到用户。")
		}

		return httpx.Response[model.User]{Body: *user}, nil
	}, api.Interceptors((*interceptor.AuthInterceptor)(nil)))
}
```

## 6. 注册构造函数和认证路由

将 `internal/application/application.go` 的全部内容替换为以下代码。注册存储库和控制器的构造函数，并仅为 `/me` 连接认证拦截器。生成的根目录 `main.go` 会依次执行 `BuildApplication`、`Validate` 和 `Run`。

内置 CORS 拦截器没有 `Constructor` 方法，因此通过 `app.Constructor` 注册 `constructor.Custom` 工厂。注册前验证配置，由工厂创建对象。应用时使用 `(*cors.CORSInterceptor)(nil)` 从容器获取实例。

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

	corsConfig := cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}
	if err := cors.ValidateConfig(corsConfig); err != nil {
		return nil, boot.Options{}, err
	}
	app.Constructor(constructor.Custom(func() *cors.CORSInterceptor {
		return cors.New(corsConfig)
	}))
	app.InterceptorFor(boot.InterceptorHTTP, (*cors.CORSInterceptor)(nil))

	return app, boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP:                   &boot.HTTPOptions{},
	}, nil
}
```

## 7. 验证并启动服务器

在项目根目录中格式化代码，检查依赖和代码，然后启动服务器。

```sh
gofmt -w src internal/application
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

`contract check` 检查静态契约。`verify` 检查静态契约，并运行 gofmt、go vet 和 Go 测试。接下来通过 HTTP 请求确认实际的注册、登录和认证行为。

## 8. 确认注册和认证请求

保持服务器运行，在另一个终端中依次发送以下请求。新启动的服务器中，第一个注册用户的 ID 为 `1`。

### 注册

```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```

服务器会返回 HTTP 200 和注册的用户信息。响应中不包含密码。

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

### 登录

```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234"}'
```

服务器会返回 HTTP 200 和 JWT。下方响应示例缩短了令牌。请求 `/me` 时，请使用实际响应中的 `token` 值。

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

### 不携带令牌查询个人信息

请求 `/me` 时不携带认证请求头。

```bash
curl http://localhost:8080/me
```

服务器会返回 HTTP 401 和以下错误消息。

```json
{
  "message": "需要令牌。"
}
```

### 携带令牌查询个人信息

完整复制登录响应中的 `token` 值。先运行下面的 `read` 命令，在等待输入时粘贴令牌并按 Enter。接着使用 `curl` 命令请求 `/me`。

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

如果令牌有效，服务器会返回 HTTP 200 和该用户的信息。

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

## 认证拦截器的执行顺序

CORS 拦截器在所有路由中执行。认证拦截器在 `/me` 中验证令牌，然后向控制器传递用户 ID。

```
POST /signup (公开)
   │
   ├─→ CORS.PreHandle (全局)
   ├─→ AuthController.Signup
   └─→ 响应 200

POST /login (公开)
   │
   ├─→ CORS.PreHandle (全局)
   ├─→ AuthController.Login
   └─→ 响应 200 + JWT 令牌

GET /me (受保护)
   │
   ├─→ CORS.PreHandle (全局)
   ├─→ Auth.PreHandle (路由) ← 验证令牌
   │       │
   │       ├─ 无令牌 → 401 Unauthorized
   │       └─ 令牌有效 → ctx.ExecutionContext().Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ 响应 200 + 用户信息
```

## 各路由的认证范围

| 路由 | 方法 | 拦截器 | 说明 |
|--------|--------|----------|------|
| `/signup` | POST | CORS | 无需令牌即可注册 |
| `/login` | POST | CORS | 无需令牌即可登录并获取 JWT |
| `/me` | GET | CORS, Auth | 验证 JWT 后查询个人信息 |

## 后续步骤

请在[拦截器 API](/zh-Hans/reference/api/interceptor)中查看执行顺序和各方法的职责。如需持久化保存用户信息，请参阅[连接数据库](/zh-Hans/learn/tutorial/5-database)。
