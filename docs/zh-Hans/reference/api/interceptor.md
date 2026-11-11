# Interceptor API

::: info 0.7.5
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

## 执行顺序 {#order}

```text
Global PreHandle
→ Route selection
→ Route PreHandle
→ Input binding and validator
→ Handler
→ Response preparation and success hooks
→ PostHandle (reverse)
→ BeforeResponse (reverse)
→ Error rendering and response flush
→ AfterCompletion (reverse)
→ Store and multipart cleanup
```

全局和路由 PreHandle 均在正文绑定前执行，可在解析前拒绝认证失败的请求。PostHandle 用于成功后处理。BeforeResponse 仅对 PreHandle 成功的拦截器逆序执行，并接收序列化、Cookie 和状态码校验错误。在此提交或回滚并返回失败。未执行到 PreHandle 的拦截器也可能收到 AfterCompletion，应先检查资源是否存在。

## 契约 {#contract}

```go
import (
	"github.com/NARUBROWN/spine/core"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type Interceptor interface {
	PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error
	PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta)
	BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error
	AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error)
}
```

## 应用范围 {#scope}

```go
app.Constructor(constructor.Interceptor(&AuthInterceptor{}))
app.InterceptorFor(boot.InterceptorHTTP, (*AuthInterceptor)(nil))
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

使用此示例前，将 Auth 和 Audit 拦截器注册到 DI。避免在全局和路由重复应用同一策略。角色注册用于 DI，应用范围另行指定。组与子组继承选项，路由选项追加其后。全局范围为 InterceptorHTTP、InterceptorWebSocket、InterceptorAll；All 和 app.Interceptor 作用于 HTTP 与 WS 消息。

## 错误与事务 {#errors}

处理器与拦截器同时失败时，HTTP 响应优先使用拦截器错误。最后一个失败的 BeforeResponse 决定响应，先前错误仍保留给完成钩子。HTTPError 仅允许 400～599；普通错误或无效状态返回隐藏内部详情的 500。DB 提交、事件发布与套接字发送不属于同一个原子事务。

[完整示例](/zh-Hans/learn/tutorial/4-interceptor) | [事务](/zh-Hans/learn/tutorial/6-transaction)
