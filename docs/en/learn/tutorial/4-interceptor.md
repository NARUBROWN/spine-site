# Interceptors

Interceptors implement cross-cutting policies around HTTP requests and WebSocket messages.

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
app.Interceptor(&LoggingInterceptor{})
```

Select a built-in transport explicitly when the policy is protocol-specific:

```go
app.InterceptorFor(boot.InterceptorHTTP, &HTTPAuditInterceptor{})
app.InterceptorFor(boot.InterceptorWebSocket, &WebSocketAuthInterceptor{})
```

The available scopes are `boot.InterceptorHTTP`, `boot.InterceptorWebSocket`, and `boot.InterceptorAll`.

## Route interceptors

Attach a policy to a route with `route.WithInterceptors`:

```go
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

A typed-nil pointer resolves one container singleton, so register its constructor first:

```go
app.Constructor(NewAuthService, NewAuthInterceptor, NewUserController)
```

Pass a non-nil instance when it does not need DI.

## Registration identity

```go
shared := &AuditInterceptor{}
app.InterceptorFor(boot.InterceptorHTTP, shared)
app.InterceptorFor(boot.InterceptorWebSocket, shared)
```

The same pointer registered for multiple scopes is merged and executes once. Different pointer instances of the same type execute independently. Repeated typed-nil placeholders share the DI singleton; value-type registrations remain independent.

## Authentication interceptor

```go
type AuthInterceptor struct {
    auth *AuthService
}

func (i *AuthInterceptor) PreHandle(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
) error {
    token := ctx.Header("Authorization")
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("invalid credentials")
    }
    ctx.Set("auth.user", user)
    return nil
}

func (i *AuthInterceptor) PostHandle(core.ExecutionContext, core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(
    core.ExecutionContext,
    core.HandlerMeta,
    error,
) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(
    core.ExecutionContext,
    core.HandlerMeta,
    error,
) {}
```

Controllers can read `auth.user` through the injected read-only `spine.Ctx` facade.

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
    return i.auth.Verify(token)
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

## Next steps

- [Interceptor API](/en/reference/api/interceptor)
- [Execution pipeline](/en/learn/core-concepts/pipeline)
- [WebSocket example](/en/reference/examples/websocket)
