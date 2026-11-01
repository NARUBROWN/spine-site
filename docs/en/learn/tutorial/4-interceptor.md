# Interceptors

Interceptors implement cross-cutting policies around HTTP requests and WebSocket messages.

## Start from a CLI project

Use `example.com/my-app` from the [first app](/en/learn/getting-started/first-app) and [project structure](/en/learn/tutorial/1-project-structure) guides. Generate the user resource from the project root if it does not exist:

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

Review the generated files in the text preview, then run the normal generation command. Skip generation if the resource already exists.

The CLI creates `src/user` and calls `user.Register(app)` in `BuildApplication`. There is no interceptor generator; write the files under `src/interceptor` yourself. Authentication services and additional controller methods are manual extensions. Add application registrations in `internal/application/application.go` and route policies in `src/user/user_route.go`. Keep the generated root `main.go` for construction, validation, and execution.


## Four-phase lifecycle

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| Method | Timing | Typical use |
|---|---|---|
| `PreHandle` | before controller/message handler | authentication, validation, begin transaction |
| `PostHandle` | success path after response preparation and hooks | success-only observation |
| `BeforeResponse` | after preparation, before HTTP flush | commit/rollback, final validation |
| `AfterCompletion` | after response handling | logging, metrics, cleanup |

`BeforeResponse` and `AfterCompletion` run in reverse order. `BeforeResponse` is invoked only for interceptors whose `PreHandle` succeeded. A `BeforeResponse` error prevents a prepared success response from being flushed.

## A complete logging interceptor

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
    log.Printf("[PREPARED] %s %s", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) BeforeResponse(
    core.ExecutionContext,
    core.HandlerMeta,
    error,
) error {
    return nil
}

func (i *LoggingInterceptor) AfterCompletion(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    err error,
) {
    log.Printf("[DONE] %s %s err=%v", ctx.Method(), ctx.Path(), err)
}
```

Global HTTP `PreHandle` runs before routing, so do not assume `meta.ControllerType` or `meta.Method` is populated there. Later phases receive the resolved metadata when routing succeeded.

## Global registration and transport scope

`App.Interceptor` applies to both HTTP and WebSocket:

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

Select a built-in transport explicitly when the policy is protocol-specific:

```go
app.InterceptorFor(boot.InterceptorHTTP, &HTTPAuditInterceptor{})
app.InterceptorFor(boot.InterceptorWebSocket, &WebSocketAuthInterceptor{})
```

The available scopes are `boot.InterceptorHTTP`, `boot.InterceptorWebSocket`, and `boot.InterceptorAll`.

## Route interceptors

Replace the generated `src/user/user_route.go` with this registration. Keep the checked `user.Register(app)` call in `BuildApplication` and do not register the same route twice:

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

A typed-nil pointer resolves one DI singleton after its constructor is registered. See the [transaction tutorial](/en/learn/tutorial/6-transaction) for a complete example.

Pass a non-nil instance when it does not need DI.

## Registration identity

```go
shared := &AuditInterceptor{}
app.InterceptorFor(boot.InterceptorHTTP, shared)
app.InterceptorFor(boot.InterceptorWebSocket, shared)
```

The same pointer registered for multiple scopes is merged and executes once. Different pointer instances of the same type execute independently. Repeated typed-nil placeholders share the DI singleton; value-type registrations remain independent.

## Authentication interceptor

Create `src/interceptor/auth_interceptor.go` below. This public demo token is for the local example; replace its validation with your application authentication policy.

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

Controllers can read `currentUser` through the injected read-only `spine.Ctx` facade.

## WebSocket handshake authentication

For WebSocket routes, message-stage `PreHandle` is too late to reject the HTTP upgrade. Implement the optional handshake interface on the same interceptor:

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

Spine reserves a capacity slot before this hook, then calls the hook before upgrade. Pending unauthenticated handshakes count toward `HTTP.WebSocket.MaxConnections`. Register the interceptor for `boot.InterceptorWebSocket` or on the WebSocket route.

The handshake context provides immutable headers, queries, cookies, path, host, remote address, request URI, and `context.Context`. The message-stage context provides the same snapshot through `core.WebSocketMessageContext`.

## Transactions

Begin a database transaction in `PreHandle` and finish it in `BeforeResponse`:

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

See the [transaction tutorial](/en/learn/tutorial/6-transaction) for a complete example.

## Error handling

Return a deliberate `httperr.HTTPError` when the client should receive a specific status and public message. Ordinary errors become a generic 500 response.

`core.ErrAbortPipeline` is for intentional early completion after an interceptor has prepared a response, such as a successful CORS preflight. It is not a replacement for an authentication error.

## Verify the contract

Run from the project root. Static contract and local Go verification are separate from live HTTP/WebSocket authentication and database E2E checks.

```sh
gofmt -w src/interceptor/*.go src/user/user_route.go internal/application/application.go
spine contract check
spine verify
spine dev
```

Check from another terminal. Health returns HTTP 200, the unauthenticated user request returns 401, and the demo-token request returns 200 with the configured CORS origin header.

```bash
curl -i http://localhost:8080/health
curl -i http://localhost:8080/user/1
curl -i http://localhost:8080/user/1 \
  -H 'Authorization: Bearer demo-token' \
  -H 'Origin: https://app.example.com'
```

## Next steps

- [Interceptor API](/en/reference/api/interceptor)
- [Execution pipeline](/en/learn/core-concepts/pipeline)
- [WebSocket example](/en/reference/examples/websocket)
