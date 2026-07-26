# 拦截器

拦截器用于认证、日志、指标、事务和其他横切逻辑。Spine v0.5.1 的接口包含四个生命周期方法。

## 实现日志拦截器

```go
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
app.Interceptor(&interceptor.LoggingInterceptor{})

app.InterceptorFor(
	boot.InterceptorHTTP,
	corsInterceptor,
)

app.Route(
	"GET",
	"/users/:id",
	(*UserController).GetUser,
	route.WithInterceptors(&interceptor.AuthInterceptor{}),
)
```

`app.Interceptor` 覆盖 HTTP 和 WebSocket。仅需要 HTTP 或 WebSocket 时使用 `InterceptorFor`；路由专用策略继续用 `route.WithInterceptors`。

同一指针实例在多个范围重复注册会合并范围并执行一次；同类型的不同指针实例独立执行。需要共享状态时复用同一指针，需要独立策略时创建不同实例。

## 安全 CORS 配置

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
	AllowOrigins:     []string{"https://app.example.com"},
	AllowMethods:     []string{"GET", "POST"},
	AllowHeaders:     []string{"Authorization", "Content-Type"},
	AllowCredentials: true,
})
if err != nil {
	log.Fatal(err)
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
	return i.verify(token)
}
```

以 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 或 WebSocket 路由拦截器注册。连接槽位先保留，随后执行 `PreHandshake`，最后才 upgrade；因此未认证握手也受 `MaxConnections` 限制。

## 下一步

- [事务管理](/zh-Hans/learn/tutorial/6-transaction)
- [`core.Interceptor` API](/zh-Hans/reference/api/interceptor)
- [当前版本](/zh-Hans/community/changelog)
