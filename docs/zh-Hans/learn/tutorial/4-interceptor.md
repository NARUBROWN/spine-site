# 拦截器

拦截器用于认证、日志、指标、事务和其他横切逻辑。Spine v0.5.1 的接口包含四个生命周期方法。

## 从 CLI 项目开始

使用[第一个应用](/zh-Hans/learn/getting-started/first-app)和[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中的 `example.com/my-app`。如果用户资源尚未生成，在项目根目录中运行：

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

先查看文本预览中的生成文件，再运行普通生成命令。已有此资源时跳过生成。

CLI 生成 `src/user`，并在 `BuildApplication` 中调用 `user.Register(app)`。CLI 不提供拦截器生成器；下面的 `src/interceptor` 文件、认证逻辑和额外控制器方法需要手动实现。在 `internal/application/application.go` 中注册全局策略，在 `src/user/user_route.go` 中添加路由策略，保留根目录 `main.go` 的构建、验证和运行流程。


## 实现日志拦截器

```go
// src/interceptor/logging_interceptor.go
package interceptor

import (
	"log"

	"github.com/NARUBROWN/spine/core"
)

type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
) error {
	log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
	return nil
}

func (i *LoggingInterceptor) PostHandle(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
) {
	log.Printf("[READY] %s %s", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) BeforeResponse(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
	executionErr error,
) error {
	return nil
}

func (i *LoggingInterceptor) AfterCompletion(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
	err error,
) {
	if err != nil {
		log.Printf("[ERR] %s %s: %v", ctx.Method(), ctx.Path(), err)
	}
}
```

`BeforeResponse` 是可失败的提交点；`AfterCompletion` 仅用于不会改变结果的观察与清理。

## 全局、路由与传输范围

```go
// internal/application/application.go
package application

import (
    "os"

    "example.com/my-app/src/interceptor"
    "example.com/my-app/src/user"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)
    app.Interceptor(&interceptor.LoggingInterceptor{})
    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins:     []string{"https://app.example.com"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Authorization", "Content-Type"},
        AllowCredentials: true,
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)

    if err := user.Register(app); err != nil {
        return nil, boot.Options{}, err
    }

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

```go
// 등록 위치별 정책 예시
app.Interceptor(&interceptor.LoggingInterceptor{})

app.InterceptorFor(
	boot.InterceptorHTTP,
	corsInterceptor,
)

app.Route(
	"GET",
	"/user/:id",
	(*UserController).Get,
	route.WithInterceptors(&interceptor.AuthInterceptor{}),
)
```

`app.Interceptor` 覆盖 HTTP 和 WebSocket。仅需要 HTTP 或 WebSocket 时使用 `InterceptorFor`；路由专用策略继续用 `route.WithInterceptors`。

同一指针实例在多个范围重复注册会合并范围并执行一次；同类型的不同指针实例独立执行。需要共享状态时复用同一指针，需要独立策略时创建不同实例。

CORS 代码放在 `BuildApplication` 中，并导入 `github.com/NARUBROWN/spine/interceptor/cors`。路由片段放在 `src/user/user_route.go`；`AuthInterceptor` 需要先手动实现四个生命周期方法。全局 HTTP `PreHandle` 执行时路由尚未解析，`HandlerMeta` 可能为空。

## 可运行的本地认证示例

创建下面的认证文件，并替换生成的用户路由文件。保留 `BuildApplication` 中的 `user.Register(app)`，不要重复注册。`demo-token` 是公开的本地演示 token，实际应用需要替换为自己的认证策略。

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
)

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Header("Authorization") != "Bearer demo-token" {
        return httperr.Unauthorized("invalid demo token")
    }
    ctx.Set("currentUser", map[string]string{"id": "1", "name": "Alice"})
    return nil
}

func (i *AuthInterceptor) PostHandle(core.ExecutionContext, core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(core.ExecutionContext, core.HandlerMeta, error) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error) {}

```

```go
// src/user/user_route.go
package user

import (
    "example.com/my-app/src/interceptor"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/route"
)

func Register(app spine.App) error {
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    app.Route(
        "GET",
        "/user/:id",
        (*UserController).Get,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )
    return nil
}
```

## 安全 CORS 配置

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
	AllowOrigins:     []string{"https://app.example.com"},
	AllowMethods:     []string{"GET", "POST"},
	AllowHeaders:     []string{"Authorization", "Content-Type"},
	AllowCredentials: true,
})
if err != nil {
	return nil, boot.Options{}, err
}

app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
```

带凭据的 CORS 不能使用 `"*"` 来源。`NewValidated` 会在启动前返回结构化错误；旧的 `cors.New` 只用于源码兼容，并在写响应头前报告无效策略。

## WebSocket 握手认证

消息级 `PreHandle` 对每条 WebSocket 消息执行，不能取代 upgrade 前认证。保护连接时实现可选接口：

```go
func (i *AuthInterceptor) PreHandshake(
	ctx core.WebSocketHandshakeContext,
	meta core.HandlerMeta,
) error {
	token := ctx.Header("Authorization")
	if token == "" {
		return httperr.Unauthorized("missing credentials")
	}
	if token != "Bearer demo-token" {
        return httperr.Unauthorized("invalid demo token")
    }
    return nil
}
```

以 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 或 WebSocket 路由拦截器注册。连接槽位先保留，随后执行 `PreHandshake`，最后才 upgrade；因此未认证握手也受 `MaxConnections` 限制。

## 验证契约

在项目根目录中执行。静态契约和本地 Go 验证与真实 HTTP、WebSocket 认证和数据库 E2E 检查是独立的。

```sh
gofmt -w src/interceptor/*.go src/user/user_route.go internal/application/application.go
spine contract check
spine verify
spine dev
```

在另一个终端中检查。health 返回 HTTP 200，无 token 的用户请求返回 401，携带演示 token 的请求返回 200，并包含已配置 origin 的 CORS 响应头。

```bash
curl -i http://localhost:8080/health
curl -i http://localhost:8080/user/1
curl -i http://localhost:8080/user/1 \
  -H 'Authorization: Bearer demo-token' \
  -H 'Origin: https://app.example.com'
```

## 下一步

- [事务管理](/zh-Hans/learn/tutorial/6-transaction)
- [`core.Interceptor` API](/zh-Hans/reference/api/interceptor)
- [当前版本](/zh-Hans/community/changelog)
