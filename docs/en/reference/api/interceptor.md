# core.Interceptor

API reference for Spine interceptors.

## Interface

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

Every interceptor implementation must define all four methods. An interceptor may additionally implement `WebSocketHandshakeInterceptor` when a WebSocket connection must be authenticated before the HTTP upgrade.

## Lifecycle

### PreHandle

Runs before controller invocation. Returning an error stops normal execution. `core.ErrAbortPipeline` is an intentional stop for an interceptor that has already prepared a response, such as a CORS preflight.

Global HTTP `PreHandle` runs before routing and receives an empty `HandlerMeta`. Route interceptors run after routing and argument resolution and receive the resolved handler metadata. For WebSocket, `PreHandle` runs for every message.

### PostHandle

Runs in reverse order after the controller result has been successfully converted into a prepared response and post-execution hooks complete. It is skipped when execution or response preparation fails.

### BeforeResponse

```go
BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
```

Runs in reverse order for every interceptor whose `PreHandle` succeeded. The HTTP response has been fully prepared in memory but has not yet been flushed. `executionErr` contains controller, serialization, cookie/status validation, hook, or earlier finalizer failures.

This is the correct place to commit or roll back a request transaction. An error returned here is joined into the final execution error and prevents a prepared success response from being flushed.

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

Runs last, in reverse order, with the final pipeline error. Use it for observation and cleanup, not transaction commit: by this point the response may already have been flushed.

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

## HTTP execution order

```text
global PreHandle
route lookup and argument resolution
route PreHandle
controller
prepare return value (serialization, cookies, status)
post-execution hooks
route PostHandle, then global PostHandle (reverse order)
route BeforeResponse, then global BeforeResponse (reverse order)
flush prepared response
route AfterCompletion, then global AfterCompletion (reverse order)
```

Only interceptors whose `PreHandle` succeeded participate in the finalizer phases. When `PreHandle` aborts, the controller and `PostHandle` are skipped; `BeforeResponse` and `AfterCompletion` still run for the already-entered interceptors.

## Global scopes

`App.Interceptor` is shorthand for both built-in transports:

```go
app.Interceptor(&LoggingInterceptor{})

// Equivalent explicit registration:
app.InterceptorFor(boot.InterceptorAll, &LoggingInterceptor{})
```

Use `InterceptorFor` when a policy belongs to only one transport:

```go
app.InterceptorFor(boot.InterceptorHTTP, httpAudit)
app.InterceptorFor(boot.InterceptorWebSocket, wsAuth)
```

Available scopes are `boot.InterceptorHTTP`, `boot.InterceptorWebSocket`, and `boot.InterceptorAll`.

### Registration identity

- Registering the same pointer instance for multiple scopes merges its scopes and executes it once.
- Different pointer instances execute independently even when they have the same concrete type.
- Repeated typed-nil placeholders of the same type merge and resolve one container singleton.
- Value-type registrations remain independent.

```go
shared := &AuditInterceptor{}
app.InterceptorFor(boot.InterceptorHTTP, shared)
app.InterceptorFor(boot.InterceptorWebSocket, shared) // one shared instance

app.Interceptor(&AuditInterceptor{}, &AuditInterceptor{}) // two instances
```

## Route interceptors and DI

```go
app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

A typed-nil pointer is resolved from the container at bootstrap. A non-nil value is used directly. Nil constructors and invalid nil provider results now fail bootstrap with explicit DI errors.

## WebSocket handshake interception

Message-stage `PreHandle` runs after the WebSocket is connected. Authentication that must reject the HTTP upgrade belongs in the optional interface:

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}

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

Spine reserves a connection slot before `PreHandshake`, and calls `PreHandshake` before the HTTP upgrade. Pending unauthenticated handshakes therefore count against `MaxConnections`. Only route interceptors and interceptors registered for `boot.InterceptorWebSocket` participate in this phase.

The immutable handshake view exposes headers, query values, cookies, remote address, host, request URI, path, and `context.Context`. Message handlers can access the same snapshot through `core.WebSocketMessageContext`.

## Complete interceptor skeleton

```go
type AuthInterceptor struct {
    auth *AuthService
}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("invalid token")
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

## See also

- [ExecutionContext](/en/reference/api/execution-context)
- [Execution pipeline](/en/learn/core-concepts/pipeline)
- [Security configuration](/en/reference/security-configuration)
- [Current Release](/en/community/changelog)
