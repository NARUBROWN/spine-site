# core.Interceptor

An interface for adding authentication, logging, CORS, and transaction handling before and after controller execution. In Spine v0.7.1, you implement separate methods for preprocessing, processing after success, processing before the response, and final cleanup.

## Interface

```go
import "github.com/NARUBROWN/spine/core"

type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| Method | When called | Return value |
| --- | --- | --- |
| `PreHandle` | Before controller execution. In registration order | Continue on `nil`; stop on error |
| `PostHandle` | After the controller, response preparation, and post-execution hooks succeed. In reverse registration order | None |
| `BeforeResponse` | Before writing the actual response. Runs interceptors whose `PreHandle` succeeded, in reverse order | Errors are included in the final execution error |
| `AfterCompletion` | After response processing. In reverse registration order, regardless of success or failure | None |

## Lifecycle and implementation examples

Your application provides `auth`, `transactionFrom`, and the transaction implementation in the following examples. You must implement all four method signatures to register a type as `core.Interceptor`.

### PreHandle

Runs before the controller call in registration order. Returning `nil` continues to the next stage; returning a regular error causes failure. Returning `core.ErrAbortPipeline` stops processing normally without calling the controller.

Global interceptors run before routing and receive an empty `HandlerMeta{}`. Route interceptors run after routing and input resolution and receive information about the handler.

```go
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("Authentication required")
    }
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("Invalid token")
    }
    ctx.Set("auth.user", user)
    return nil
}
```

### PostHandle

Runs in reverse order after the controller's return value has been prepared as a response and the post-execution hooks have succeeded. It cannot return errors, so use it for success logs or observation.

```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s prepared", ctx.Method(), ctx.Path())
}
```

### BeforeResponse

Runs in reverse order before the response is written to the actual transport layer. `executionErr` contains errors raised up to this point during preprocessing, routing, input resolution, controller execution, response preparation, and post-execution hooks. Errors returned by earlier `BeforeResponse` calls are also combined and passed to the next interceptor.

Commit or roll back request-scoped transactions at this stage. v0.7.1 performs response serialization and cookie and status code validation first, so you can roll back if response preparation fails.

```go
func (i *TxInterceptor) BeforeResponse(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    executionErr error,
) error {
    tx, ok := transactionFrom(ctx)
    if !ok {
        return nil
    }
    if executionErr != nil {
        return tx.Rollback()
    }
    return tx.Commit()
}
```

### AfterCompletion

Called in reverse order after response processing, regardless of success or failure. It receives the final `err`; use it for logging, collecting metrics, and releasing resources. You can also check the result of sending the response at this stage. The decision to commit a transaction must already have been made in the previous stage.

```go
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

## Registration and scopes

`app.Interceptor` is equivalent to `app.InterceptorFor(boot.InterceptorAll, ...)`. It applies to both HTTP requests and WebSocket messages, but not event consumers. Specify a scope if the interceptor depends on a particular transport, as CORS does when handling HTTP responses.

| Scope | Applies to |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP requests |
| `boot.InterceptorWebSocket` | WebSocket messages and optional processing before connection establishment |
| `boot.InterceptorAll` | Both scopes |

A new controller assigns route interceptors with `api.Interceptors` in `RegisterRoutes`. In the excerpt, `r` is a `*api.Registry` and `handler` is defined by the application. Register the interceptor constructor when using DI. See the [complete runnable example](/en/learn/tutorial/4-interceptor).

```go
app.InterceptorFor(boot.InterceptorAll, auth)
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsRateLimiter)

r.GET("/admin/users/:id", handler,
    api.Interceptors((*AuthInterceptor)(nil)),
)
```

If you register a typed nil pointer such as `(*AuthInterceptor)(nil)`, the container looks up and uses an instance of that type. Nil pointers of the same type use the container's shared instance.

If you register the same pointer as a global interceptor in multiple scopes, the scopes are combined and the instance runs once. Different pointers run separately, even if they have the same type. Value types also run separately for each registration.

### Register a route interceptor with DI

This standalone app registers the construction contract using `constructor.Interceptor` and passes a typed nil pointer to `api.Interceptors`. Run it in a separate Go module with Spine `v0.7.1` and a compatible Echo platform. The token is for demonstration only.

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
	"log"
)

type Auth struct{}

func (*Auth) Constructor() *Auth { return &Auth{} }

func (*Auth) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
	if ctx.Header("Authorization") != "Bearer demo-token" {
		return httperr.Unauthorized("unauthorized")
	}
	return nil
}
func (*Auth) PostHandle(core.ExecutionContext, core.HandlerMeta)                  {}
func (*Auth) BeforeResponse(core.ExecutionContext, core.HandlerMeta, error) error { return nil }
func (*Auth) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error)      {}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/users/:id", func(id input.Path[int64]) httpx.Response[map[string]int64] {
		return httpx.Response[map[string]int64]{Body: map[string]int64{"id": *id}}
	}, api.Interceptors((*Auth)(nil)))
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Interceptor(&Auth{}))
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

An unauthenticated request returns 401; the demo token returns 200 and the user ID.

```bash
curl -i http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/users/1
```

## Processing before a WebSocket connection

Interceptors that need to authenticate connections implement the following optional interface in addition to `core.Interceptor`.

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

A connection slot is reserved first, then `PreHandshake` runs before the HTTP upgrade. Connection requests waiting for authentication therefore count toward `MaxConnections`. `PreHandle` continues to run for every WebSocket message rather than once per connection. Read request headers, queries, cookies, and other information through [`WebSocketHandshakeContext`](/en/reference/api/execution-context#websocket-request-context).

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

## Execution order

The normal HTTP flow is as follows.

```text
Global.PreHandle → Router → ArgumentResolver → Route.PreHandle
→ Controller → Response preparation → Post-execution hooks
→ Route.PostHandle → Global.PostHandle
→ Route.BeforeResponse → Global.BeforeResponse
→ Write the actual response
→ Route.AfterCompletion → Global.AfterCompletion
```

Each stage that runs in reverse order starts with route interceptors, then continues with global interceptors. Calls after routing receive the resolved `HandlerMeta`.

## Constraints and errors

- `BeforeResponse` is called only for interceptors whose `PreHandle` returned `nil`. Interceptors that returned an error or `core.ErrAbortPipeline` are excluded.
- `AfterCompletion` runs for global interceptors and route interceptors identified during routing. It may be called even if that interceptor's `PreHandle` did not run, so check that resources exist before releasing them.
- Authentication in route interceptors runs after input resolution. Use a global interceptor if authentication must run before input resolution.
- When stopping with `core.ErrAbortPipeline`, the interceptor must prepare the required response. The controller and subsequent success processing stages do not run.
- Sending the actual response can fail after the DB commit. `BeforeResponse` does not make DB operations and network transmission atomic.

For details on early termination and error propagation, see the [v0.7.1 pipeline implementation](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/pipeline/pipeline.go). For the order of processing before connection establishment, see the [WebSocket runtime implementation](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/ws/runtime.go).

## See also

- [Execution pipeline](/en/learn/core-concepts/pipeline)
- [Transaction management](/en/learn/tutorial/6-transaction)
- [Current release](/en/community/changelog)
