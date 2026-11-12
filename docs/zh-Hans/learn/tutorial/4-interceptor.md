# 拦截器

全局与路由 PreHandle 都在输入绑定前运行。认证失败会在解析正文前返回 401。

## 运行示例

[控制器依赖](/zh-Hans/learn/tutorial/2-controller)

替换 main.go。固定令牌仅用于学习。constructor.Interceptor 注册 DI，api.Interceptors 指定作用范围。(*Auth)(nil) 表示从 DI 解析已注册类型。

本站示例中，所有拦截器都先通过 `app.Constructor` 注册。实现 `Constructor` 方法的自定义拦截器使用 `constructor.Interceptor(&Auth{})` 注册，应用时传入 `(*Auth)(nil)` 这样的 typed nil，从容器获取实例。不要直接向应用 API 传入 `&Auth{}`：当前实现会跳过构造方法并直接执行该对象。注册和指定应用范围是两个独立步骤。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/core"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type Auth struct{}

func (*Auth) Constructor() *Auth { return &Auth{} }
func (*Auth) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return httperr.InternalServerError("HTTP request context unavailable")
	}
	if request.Header("Authorization") != "Bearer demo-token" {
		return httperr.Unauthorized("unauthorized")
	}
	ctx.ExecutionContext().Set("userID", "demo-user")
	return nil
}
func (*Auth) PostHandle(spinectx.Ctx, core.HandlerMeta)                  {}
func (*Auth) BeforeResponse(spinectx.Ctx, core.HandlerMeta, error) error { return nil }
func (*Auth) AfterCompletion(spinectx.Ctx, core.HandlerMeta, error)      {}

type Controller struct{}
type CreateUser struct {
	Name string `json:"name"`
}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Interceptors((*Auth)(nil)))
	users.GET("/:id", func(ctx spinectx.Ctx, id input.Path[int64]) httpx.Response[map[string]int64] {
		return httpx.Response[map[string]int64]{Body: map[string]int64{"id": *id}}
	})
	users.POST("/", func(ctx spinectx.Ctx, body input.Body[CreateUser]) httpx.Response[string] {
		return httpx.Response[string]{Body: body.Name}
	})
	r.GET("/profile", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: "profile"}
	}, api.Interceptors((*Auth)(nil)))
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Interceptor(&Auth{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
func main() {
	app, options, err := BuildApplication()
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

## 组与路由

```go
app.Constructor(
	constructor.Interceptor(&AuthInterceptor{}),
	constructor.Interceptor(&AuditInterceptor{}),
)
```

```go
func (*UserController) RegisterRoutes(r *api.Registry) {
	auth := (*AuthInterceptor)(nil)
	audit := (*AuditInterceptor)(nil)
	users := r.Group("/users", api.Interceptors(auth))
	users.GET("/", func() httpx.Response[[]int64] {
		return httpx.Response[[]int64]{Body: []int64{1}}
	})
	users.DELETE("/:id", func() httpx.Response[struct{}] {
		return httpx.Response[struct{}]{Options: httpx.ResponseOptions{Status: 204}}
	}, api.Interceptors(audit))
	r.GET("/profile", func() httpx.Response[string] {
		return httpx.Response[string]{Body: "profile"}
	}, api.Interceptors(auth))
}
```

使用此示例前，将 Auth 和 Audit 拦截器注册到 DI。GET /users 执行 Auth，DELETE /users/:id 依次执行 Auth、Audit。子组继承拦截器，路由选项继续追加。HTTP 全局使用 InterceptorFor(boot.InterceptorHTTP, ...)，HTTP 与 WebSocket 全部使用 app.Interceptor 或 InterceptorAll。避免重复应用同一认证。

## 验证请求

```sh
go run .
#
curl -i http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/profile
curl -i -H 'Content-Type: application/json' -d '{' http://localhost:8080/users
curl -i -H 'Authorization: Bearer demo-token' -H 'Content-Type: application/json' -d '{' http://localhost:8080/users
```

依次为 401、200、200、401、400。正文格式错误时，认证失败仍优先返回 401。

## 生命周期

PreHandle 按注册顺序执行；成功后的 PostHandle、写入前的 BeforeResponse、写入尝试后的 AfterCompletion 按逆序执行。BeforeResponse 仅对 PreHandle 成功的对象执行，并接收绑定、处理器、序列化和响应验证错误。AfterCompletion 也可能用于未执行 PreHandle 的对象，须检查资源是否存在。

BeforeResponse 错误优先于处理器错误决定响应。多个钩子失败时使用最后一个失败的错误，完成钩子也会接收到先前错误。

## 公开上下文

四个钩子均接收 spine.Ctx。值使用 ExecutionContext().Set/Get，标准上下文使用 ExecutionContext().Context()；访问 HTTP 前检查 HTTPRequestContext() 的布尔值。处理器仍兼容直接注入 context.Context。

## 下一步

[事务](/zh-Hans/learn/tutorial/6-transaction) / [错误处理](/zh-Hans/learn/tutorial/7-error-handling)
