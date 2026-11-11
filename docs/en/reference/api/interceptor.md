# Interceptor API

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
func (c *UserController) RegisterRoutes(r *api.Registry) {
	auth := (*AuthInterceptor)(nil)
	audit := (*AuditInterceptor)(nil)
	users := r.Group("/users", api.Interceptors(auth))
	users.GET("/", c.List)
	users.DELETE("/:id", c.Delete, api.Interceptors(audit))
	r.GET("/profile", c.Profile, api.Interceptors(auth))
}
```

Apply this fragment in an app with the required constructors, handlers, and both interceptors; register Audit in DI too. Avoid applying the same policy globally and locally. Role registration provides DI; scope is separate. Groups and subgroups inherit options and route options append to them. Global scopes are InterceptorHTTP, InterceptorWebSocket, and InterceptorAll; All and app.Interceptor apply to HTTP and WS messages.

## Errors and transactions {#errors}

When both handler and interceptor fail, the interceptor error takes priority for the HTTP response. The last failing BeforeResponse determines the response, while earlier errors remain available to completion hooks. HTTPError accepts only 400–599; ordinary errors and invalid statuses produce a sanitized 500. DB commit, event publication, and socket transmission are not one atomic transaction.

[Complete example](/en/learn/tutorial/4-interceptor) | [Transactions](/en/learn/tutorial/6-transaction)
