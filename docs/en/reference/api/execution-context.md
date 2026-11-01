# core.ExecutionContext

API reference for Spine's execution and protocol-specific context contracts.

Application controller examples are manual extensions to `src/user/user_controller.go` in a [CLI project](/en/learn/tutorial/1-project-structure). Define application types such as `User` yourself, import `httpx` from `github.com/NARUBROWN/spine/pkg/httpx` and `spine.Ctx` from `github.com/NARUBROWN/spine/pkg/spine`, and keep the generated `BuildApplication`, checked `user.Register(app)` call, and root `main.go`.

## Base carriers

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() EventBus
}
```

`context.Context` carries cancellation and deadlines. `EventBus` collects domain events for post-execution dispatch.

## ExecutionContext

```go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier

    Method() string
    Path() string
    Params() map[string]string
    Header(name string) string
    PathKeys() []string
    Queries() map[string][]string
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

The router, pipeline, and interceptors use this mutable request-scoped contract. Collection-returning methods return defensive views; do not rely on mutating them to change framework state.

| Method | Meaning |
|---|---|
| `Context` | standard cancellation/deadline context |
| `EventBus` | request/message event collector |
| `Method` | HTTP method, `EVENT`, or `WS` |
| `Path` | request path or event route |
| `Header` | one header value when supported |
| `Params`, `PathKeys` | matched path values and declaration order |
| `Queries` | multi-value query map |
| `Set`, `Get` | interceptor/pipeline request store |

Use namespaced application keys such as `myapp.auth.user`; keys beginning with `spine.` are reserved for framework internals.

## ControllerContext

```go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

Controllers receive the read-only `spine.Ctx` facade rather than the mutable `ExecutionContext`:

```go
func (c *UserController) Me(ctx spine.Ctx) (httpx.Response[User], error) {
    value, ok := ctx.Get("myapp.auth.user")
    if !ok {
        return httpx.Response[User]{}, httperr.Unauthorized("authentication required")
    }
    return httpx.Response[User]{Body: value.(User)}, nil
}
```

Interfaces that extend `ControllerContext` are resolved using safe assignability and conversion. Unsupported types return an error instead of panicking.

## HttpRequestContext

```go
type HttpRequestContext interface {
    ContextCarrier
    EventBusCarrier

    Param(name string) string
    Query(name string) string
    Header(name string) string
    Params() map[string]string
    Queries() map[string][]string
    Headers() map[string][]string
    Bind(out any) error
    MultipartForm() (*multipart.Form, error)
}
```

HTTP argument resolvers assert this interface to bind path/query/header semantic types, JSON/form DTOs, and multipart uploads.

## ConsumerRequestContext

```go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string
    Payload() []byte
}
```

Consumer resolvers use this narrow interface for the event name, raw payload, and decoded DTOs.

## WebSocket contexts

### Message execution

```go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string
    MessageType() int
    Payload() []byte
}
```

`MessageType` is the Gorilla WebSocket frame type (`1` for text, `2` for binary). `Payload` is the current message body.

### Immutable upgrade request

```go
type WebSocketRequestContext interface {
    ContextCarrier

    Path() string
    Header(name string) string
    Headers() map[string][]string
    Query(name string) string
    Queries() map[string][]string
    Cookie(name string) (string, bool)
    Cookies() map[string]string
    RemoteAddr() string
    Host() string
    RequestURI() string
}

type WebSocketHandshakeContext interface {
    WebSocketRequestContext
}

type WebSocketMessageContext interface {
    WebSocketContext
    WebSocketRequestContext
}
```

`WebSocketHandshakeContext` is supplied to `WebSocketHandshakeInterceptor.PreHandshake` before HTTP upgrade. Spine has already reserved a capacity slot, so pending authentication counts toward `MaxConnections`.

The request data is snapshotted and exposed again during message processing through `WebSocketMessageContext`. Read it from a message interceptor, for example with the helper below called from `PreHandle`. `core.WebSocketContext` is not a supported controller handler parameter:

```go
func websocketRequestInfo(ctx core.ExecutionContext) (string, string, error) {
    request, ok := ctx.(core.WebSocketMessageContext)
    if !ok {
        return "", "", errors.New("handshake request snapshot unavailable")
    }
    tenant := request.Query("tenant")
    token, _ := request.Cookie("session")
    return tenant, token, nil
}
```

Header, query, and cookie maps are defensive copies. Mutating them does not alter the stored handshake snapshot.

## Interceptor usage

The following is a complete minimal `core.Interceptor` implementation. Only `PreHandle` uses the context; the other required lifecycle methods are explicit no-ops.

```go
func (i *AuthInterceptor) PreHandle(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
) error {
    user, err := i.auth.Validate(ctx.Header("Authorization"))
    if err != nil {
        return httperr.Unauthorized("invalid credentials")
    }
    ctx.Set("myapp.auth.user", user)
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

Global HTTP `PreHandle` executes before route selection. Do not dereference handler metadata there without first checking whether it is populated.

## Protocol behavior

| Capability | HTTP | Consumer | WebSocket message |
|---|---|---|---|
| `Method()` | HTTP method | `EVENT` | `WS` |
| `Path()` | request path | event name | route path |
| headers/queries | native request data | empty views | handshake snapshot via `WebSocketMessageContext` |
| payload | bound HTTP body | event payload | frame payload |
| mutable store | yes | yes | yes, concurrency-protected |

## See also

- [Execution Context concept](/en/learn/core-concepts/execution-context)
- [Interceptor API](/en/reference/api/interceptor)
- [WebSocket example](/en/reference/examples/websocket)
