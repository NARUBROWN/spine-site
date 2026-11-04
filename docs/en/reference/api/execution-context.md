# core.ExecutionContext

::: warning v0.7.0 Preview input API migration
The existing API descriptions and examples on this page target stable `v0.6.5`. From `v0.7.0-preview.1`, source-specific Path, Query, and Header DTOs are supported. `query.Values`, `header.Values` and their construction and lookup APIs, `query.Pagination`, `path.Int`, `path.String`, and `path.Boolean` are Deprecated.

The new DTO approach cannot be applied unchanged to `v0.6.5`. In Preview, mixing new DTOs with Deprecated inputs in one handler fails during boot. Existing body DTOs and contexts can still be used alongside either approach.

See [Preview handler input migration](/en/learn/migration/v0.7.0-preview) for versions and migration examples, and [Runtime OpenAPI](/en/reference/api/openapi) for specification options.
:::

`ExecutionContext` is an interface for reading request information and sharing values between processing stages in interceptors and the execution pipeline. It is used for HTTP requests, events, and WebSocket messages, with separate interfaces providing additional information for each transport.

```go
import "github.com/NARUBROWN/spine/core"
```

## Choosing an interface

To read values stored by an interceptor in an HTTP controller, declare a `core.ControllerContext` parameter. Use `core.ExecutionContext` in interceptors. Use `HttpRequestContext` and `ConsumerRequestContext` to resolve HTTP and event inputs, respectively.

| Interface | Embedded interfaces | Provides |
| --- | --- | --- |
| `ContextCarrier` | None | Go standard `context.Context` |
| `EventBusCarrier` | None | Request-scoped event bus |
| `ExecutionContext` | `ContextCarrier`, `EventBusCarrier` | Request method and path, headers and parameters, value storage and retrieval |
| `ControllerContext` | None | Retrieval of values stored by interceptors |
| `HttpRequestContext` | `ContextCarrier`, `EventBusCarrier` | HTTP input access, body binding, multipart forms |
| `ConsumerRequestContext` | `ContextCarrier`, `EventBusCarrier` | Event name and raw body |
| `WebSocketContext` | `ExecutionContext` | Connection ID, message type, and raw body |
| `WebSocketRequestContext` | `ContextCarrier` | Information from the HTTP request that initiated the connection |
| `WebSocketHandshakeContext` | `WebSocketRequestContext` | Request information for authentication and authorization before the HTTP upgrade |
| `WebSocketMessageContext` | `WebSocketContext`, `WebSocketRequestContext` | Message and original connection request information |

`ControllerContext` does not embed `ExecutionContext` and provides only `Get`. `HttpRequestContext` and `ConsumerRequestContext` do not embed `ExecutionContext` either. The implementations provided by the runtime implement the required interfaces together.

## Interface definitions

### Base interfaces

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() EventBus
}
```

`EventBus()` returns `core.EventBus`. It provides `Publish(events ...publish.DomainEvent)` to collect events and `Drain() []publish.DomainEvent` to retrieve the collected events.

### ExecutionContext

```go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier

    Method() string
    Path() string
    Params() map[string]string
    Header(name string) string
    PathKeys() []string
    SetRoute(params map[string]string, pathKeys []string)
    Queries() map[string][]string
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

### ControllerContext

An interface dedicated to reading values in HTTP controllers. Use `Get()` to retrieve values stored by interceptors with `Set()`. The default consumer and WebSocket input resolvers do not inject this type.

```go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

### HttpRequestContext

An interface for reading HTTP inputs. It embeds `ContextCarrier` and `EventBusCarrier`.

```go
type HttpRequestContext interface {
    ContextCarrier
    EventBusCarrier

    // Access individual values
    Param(name string) string
    Query(name string) string
    Header(name string) string

    // Access the complete view
    Params() map[string]string
    Queries() map[string][]string
    Headers() map[string][]string

    // Request body
    Bind(out any) error

    // Multipart
    MultipartForm() (*multipart.Form, error)
}
```

### HTTPResponseContext

```go
type HTTPResponseContext interface {
    ResponseWriter() ResponseWriter
    SetResponseWriter(ResponseWriter)
}
```

`HTTPResponseContext.ResponseWriter()` returns the HTTP response writer. The pipeline swaps it for a staging writer while preparing a response and restores it before transmission. Controllers normally return `httpx.Response[T]`, `httpx.Redirect`, or `httpx.Binary` instead of accessing a writer directly.

### ConsumerRequestContext

An interface for reading event consumer inputs. It embeds `ContextCarrier` and `EventBusCarrier`.

```go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string
    Payload() []byte
}
```

### WebSocketContext

An interface for reading WebSocket messages. It embeds `ExecutionContext`.

```go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string
    MessageType() int
    Payload() []byte
}
```

### WebSocket connection request information {#websocket-request-context}

v0.6.5 copies and preserves HTTP upgrade request information. The following interfaces provide access to headers, queries, cookies, the remote address, the host, and the request URI.

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

type WebSocketHandshakeContext interface { WebSocketRequestContext }

type WebSocketMessageContext interface {
    WebSocketContext
    WebSocketRequestContext
}
```

Use `WebSocketHandshakeContext` in `PreHandshake`. During message processing, assert `ExecutionContext` to `WebSocketMessageContext` to read the original connection request information. `Headers()`, `Queries()`, and `Cookies()` return copies, so modifying the returned maps does not change the preserved request information.

## ExecutionContext methods

### Context

```go
Context() context.Context
```

Returns a `context.Context` from the Go standard library.

**Returns**

- `context.Context` - Request-scoped context

**Example**

```go
func (i *TimeoutInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    select {
    case <-ctx.Context().Done():
        return ctx.Context().Err()
    default:
        return nil
    }
}
```

### EventBus

```go
EventBus() core.EventBus
```

Returns the request-scoped event bus. Used to publish domain events.

**Returns**

- `core.EventBus` - Event bus instance

In a controller that publishes events, accept `context.Context` as a parameter and call `publish.Event(ctx, event)`. The runtime attaches the event bus to the standard context. See the [event publishing example](/en/reference/api/spine-app#event-publishing).

### Method

```go
Method() string
```

Returns the request method.

**Returns**

- HTTP: `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, etc.
- Event consumer: `"EVENT"`
- WebSocket: `"WS"`

**Example**

```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // Handle CORS preflight requests
    }
    return nil
}
```

### Path

```go
Path() string
```

Returns the request path.

**Returns**

- HTTP: Request path (for example, `"/users/123"`)
- Event consumer: Event name (for example, `"order.created"`)
- WebSocket: WebSocket path (for example, `"/ws/chat"`)

**Example**

```go
log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
// HTTP:      [REQ] GET /users/123
// Consumer:  [REQ] EVENT order.created
// WebSocket: [REQ] WS /ws/chat
```

### Header

```go
Header(name string) string
```

Returns the value of the HTTP header with the specified name.

**Parameters**

- `name` - Header name (case-insensitive)

**Returns**

- `string` - Header value, or an empty string if absent
- Event consumer: Empty string
- WebSocket: Header value preserved from the HTTP upgrade request

**Example**

```go
origin := ctx.Header("Origin")
auth := ctx.Header("Authorization")
```

### Params

```go
Params() map[string]string
```

Returns all path parameters as a map.

**Returns**

- `map[string]string` - Map of path parameters
- Event consumer: `nil`
- WebSocket: Path parameters resolved by the router. An empty map before routing

**Example**

```go
// Route: /users/:userId/posts/:postId
// Request: /users/123/posts/456

params := ctx.Params()  // {"userId": "123", "postId": "456"}
```

### PathKeys

```go
PathKeys() []string
```

Returns path parameter keys in declaration order.

**Returns**

- `[]string` - Slice of keys
- Event consumer: `nil`
- WebSocket: Key order resolved by the router. An empty slice before routing

**Example**

```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```

### SetRoute

```go
SetRoute(params map[string]string, pathKeys []string)
```

Stores the parameters and key order found by the router. Implementations copy the inputs and keep them separate from user Set/Get storage. Custom ExecutionContext implementations must provide this method.

### Queries

```go
Queries() map[string][]string
```

Returns all query parameters as a map.

**Returns**

- `map[string][]string` - Map of query parameters
- Event consumer: `nil`
- WebSocket: Query parameters preserved from the HTTP upgrade request

**Example**

```go
// Request: /users?status=active&tag=go&tag=web

queries := ctx.Queries()
// {"status": ["active"], "tag": ["go", "web"]}
```

### Set

```go
Set(key string, value any)
```

Stores a value in the internal store.

**Parameters**

- `key` - Key to store
- `value` - Value to store

**Example**

```go
ctx.Set("auth.user", authenticatedUser)
ctx.Set("request.startTime", time.Now())
```

### Get

```go
Get(key string) (any, bool)
```

Retrieves a value from the internal store.

**Parameters**

- `key` - Key to retrieve

**Returns**

- `any` - Stored value
- `bool` - Whether the key exists

**Example**

```go
value, exists := ctx.Get("auth.user")
```

## ControllerContext

An interface for reading values stored by interceptors in controllers.

### Get

```go
Get(key string) (any, bool)
```

Delegates to `ExecutionContext.Get()`. It does not provide a `Set()` method.

The following code extends `src/user/user_controller.go` in a [CLI project](/en/learn/tutorial/1-project-structure). Define `User`, `AuthUser`, and the repository field in your application. Keep the generated `user.Register(app)` and root `main.go`.

```go
func (c *UserController) GetUser(ctx core.ControllerContext, userId path.Int) (httpx.Response[User], error) {
    // Read the value stored by the interceptor with Set("auth.user", ...)
    if authUser, ok := ctx.Get("auth.user"); ok {
        _ = authUser.(*AuthUser)
        // ...
    }
    user, err := c.repo.FindByID(userId.Value)
    if err != nil {
        return httpx.Response[User]{}, err
    }
    return httpx.Response[User]{Body: user}, nil
}
```

## HttpRequestContext methods

Additional methods used to resolve HTTP inputs.

### Param

```go
Param(name string) string
```

Returns the value of a specific path parameter.

**Example**

```go
userId := ctx.Param("id")  // "123"
```

### Query

```go
Query(name string) string
```

Returns the first value of a specific query parameter.

**Example**

```go
page := ctx.Query("page")  // "1"
```

### Headers

```go
Headers() map[string][]string
```

Returns all HTTP headers as a map.

**Example**

```go
headers := ctx.Headers()
// {"Content-Type": ["application/json"], "Accept": ["text/html", "application/json"]}
```

### Bind

```go
Bind(out any) error
```

Binds the HTTP request body to a struct.

**Example**

```go
var req CreateUserRequest
if err := ctx.Bind(&req); err != nil {
    return err
}
```

### MultipartForm

```go
MultipartForm() (*multipart.Form, error)
```

Provides access to multipart form data.

**Example**

```go
form, err := ctx.MultipartForm()
if err != nil {
    return err
}
for _, file := range form.File["upload"] {
    // Handle files
}
```

## ConsumerRequestContext methods

Methods used to resolve event inputs.

### EventName

```go
EventName() string
```

Returns the name of the received event.

**Example**

```go
name := ctx.EventName()  // "order.created"
```

### Payload

```go
Payload() []byte
```

Returns the event's raw payload.

**Example**

```go
payload := ctx.Payload()  // []byte (JSON)
var event OrderCreated
json.Unmarshal(payload, &event)
```

## WebSocketContext methods

Methods used to resolve WebSocket inputs.

### ConnID

```go
ConnID() string
```

Returns the unique identifier of the WebSocket connection.

**Example**

```go
connID := ctx.ConnID()  // "a1b2c3d4-..."
```

### MessageType

```go
MessageType() int
```

Returns the WebSocket message type.

**Returns**

- `1` - TextMessage
- `2` - BinaryMessage

**Example**

```go
if ctx.MessageType() == ws.TextMessage {
    // Handle text messages
}
```

### Payload

```go
Payload() []byte
```

Returns the WebSocket message's raw payload.

**Example**

```go
payload := ctx.Payload()  // []byte
var msg ChatMessage
json.Unmarshal(payload, &msg)
```

## Routing and response contracts

Routing state and the HTTP response writer use typed contracts separate from user Set/Get storage. The router stores path values through `SetRoute`, and the HTTP pipeline selects its writer through `HTTPResponseContext`.

| API | Type | Description |
|----|------|------|
| `HTTPResponseContext.ResponseWriter()` | `core.ResponseWriter` | Response output interface |
| `Params()` | `map[string]string` | Path parameters |
| `PathKeys()` | `[]string` | Path parameter key order |

## Using ExecutionContext in interceptors

`ExecutionContext` is passed as the first argument to every interceptor method.

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### Logging example

```go
type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

### CORS example

The following example accesses the response output interface. Define `Config` and `isAllowedOrigin` in your application. For a complete CORS configuration, use the [validatable built-in interceptor](/en/reference/security-configuration#cors-cookies).

```go
type CORSInterceptor struct {
    config Config
}

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    httpCtx, ok := ctx.(core.HTTPResponseContext)
    if !ok || httpCtx.ResponseWriter() == nil {
        return nil
    }
    rw := httpCtx.ResponseWriter()

    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
        rw.SetHeader("Vary", "Origin")
    }

    if ctx.Method() == "OPTIONS" {
        if err := rw.WriteStatus(204); err != nil {
            return err
        }
        return core.ErrAbortPipeline
    }

    return nil
}
```

## Using ExecutionContext in input resolution

Input resolution components receive `core.ExecutionContext` and assert it to the interface for the relevant transport. For example, reading an HTTP path parameter requires `core.HttpRequestContext`, reading an event name requires `core.ConsumerRequestContext`, and reading a WebSocket connection ID requires `core.WebSocketContext`. The type assertion fails if the context does not implement the required interface.

For an HTTP controller's `context.Context` parameter, the runtime passes the standard context with a request-scoped event bus. For its `core.ControllerContext` parameter, it passes a view that provides only `Get()`. The default consumer and WebSocket input resolvers do not inject `ControllerContext`. The runtime's input resolution code is available in the following sources.

- [HTTP path parameter resolution](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/resolver/path_int_resolver.go)
- [Standard context injection](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/resolver/std_context_resolver.go)
- [Controller read context injection](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/resolver/controller_context_resolver.go)
- [Event input resolution](https://github.com/NARUBROWN/spine/tree/v0.6.5/internal/event/consumer/resolver)
- [WebSocket input resolution](https://github.com/NARUBROWN/spine/tree/v0.6.5/internal/ws/resolver)

## Behavior by protocol

| Method | HTTP | Event consumer | WebSocket |
|--------|------|----------|-----------|
| `Method()` | `"GET"`, `"POST"`, etc. | `"EVENT"` | `"WS"` |
| `Path()` | `/users/123` | `order.created` | `/ws/chat` |
| `Header()` | Header value | Empty string | Header value from the connection request |
| `Params()` | Path parameters | `nil` | Path parameters resolved by the router |
| `PathKeys()` | Path parameter key order | `nil` | Path parameter key order |
| `Queries()` | Query parameters | `nil` | Query parameters from the connection request |
| `EventBus()` | EventBus | EventBus | EventBus |
| `Context()` | Request context | Event processing context | Message processing context |

## Implementations

| Implementation | Interfaces | Location |
|--------|-----------|------|
| `echoContext` | `ExecutionContext` + `HttpRequestContext` | `internal/adapter/echo/context_impl.go` |
| `ConsumerRequestContextImpl` | `ExecutionContext` + `ConsumerRequestContext` | `internal/event/consumer/request_context_impl.go` |
| `WSExecutionContext` | `WebSocketMessageContext` | `internal/ws/context_impl.go` |
| `controllerCtxView` | `ControllerContext` | `internal/runtime/controller_ctx.go` |

## Constraints and errors

- Global interceptors' `PreHandle` runs before routing. `HandlerMeta{}` is empty at this point, so do not access the controller type or method directly. Read path parameters only after routing as well.
- `Get` returns `(nil, false)` when the key is absent. Check the type of the stored value before using it. `ControllerContext` does not prevent changes to the stored objects themselves.
- `Header` and `Query` return an empty string when the value is absent. WebSocket's `Cookie` returns both the value and whether it exists.
- `Bind` and `MultipartForm` return errors if body parsing fails. Return the error to the caller and stop processing.
- The runtime uses reserved keys that start with `spine.`. Use separate names such as `auth.user` for values shared by your application.

## See also

- [Interceptors](/en/reference/api/interceptor): Shared processing such as authentication and logging
- [Execution context concepts](/en/learn/core-concepts/execution-context) - Detailed explanation
