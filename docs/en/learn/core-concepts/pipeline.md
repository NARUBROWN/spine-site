# Execution pipeline

::: info 0.7.5
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

## Execution order {#order}

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

Both global and route PreHandle run before body binding, allowing authentication to fail before parsing. PostHandle handles successful execution. BeforeResponse runs in reverse only for interceptors whose PreHandle succeeded, including serialization, cookie, and status validation failures. Commit or roll back there and return failures. AfterCompletion can also run for an interceptor whose PreHandle was never reached, so check whether its resources exist.

## Contract {#contract}

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

## Scope {#scope}

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

Register both the Auth and Audit interceptors in DI to use this example. Avoid applying the same policy globally and locally. Role registration provides DI; scope is separate. Groups and subgroups inherit options and route options append to them. Global scopes are InterceptorHTTP, InterceptorWebSocket, and InterceptorAll; All and app.Interceptor apply to HTTP and WS messages.

<span id="error-responses"></span>

## Errors and transactions {#errors}

When both handler and interceptor fail, the interceptor error takes priority for the HTTP response. The last failing BeforeResponse determines the response, while earlier errors remain available to completion hooks. HTTPError accepts only 400–599; ordinary errors and invalid statuses produce a sanitized 500. DB commit, event publication, and socket transmission are not one atomic transaction.

[Complete example](/en/learn/tutorial/4-interceptor) | [Transactions](/en/learn/tutorial/6-transaction)
