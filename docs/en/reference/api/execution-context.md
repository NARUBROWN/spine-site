# core.ExecutionContext

API reference for ExecutionContext.


## Overview

`ExecutionContext` is an interface that allows access to request information within the Spine pipeline and shares data between components. It is a unified execution context that handles both HTTP requests and event messages.

```go
import "github.com/NARUBROWN/spine/core"
```


## Interface Hierarchy

Spine separates Context hierarchically.

```
ContextCarrier ──────┬──► RequestContext ──┬──► HttpRequestContext
                     │                     │
EventBusCarrier ─────┤                     └──► ConsumerRequestContext
                     │
                     └──► ExecutionContext
```

| Interface | Role | Usage Location |
|-----------|------|----------------|
| `ContextCarrier` | Deliver Go context | Everywhere |
| `EventBusCarrier` | Publish events | Controller, Consumer |
| `RequestContext` | Resolver minimum contract | ArgumentResolver base |
| `ExecutionContext` | Control execution flow | Router, Pipeline, Interceptor |
| `HttpRequestContext` | Interpret HTTP input | HTTP ArgumentResolver |
| `ConsumerRequestContext` | Interpret event input | Consumer ArgumentResolver |


## Interface Definition

### Base Interface

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() publish.EventBus
}

type RequestContext interface {
    ContextCarrier
    EventBusCarrier
}
```

### ExecutionContext

```go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier

    Method() string
    Path() string
    Header(name string) string
    Params() map[string]string
    PathKeys() []string
    Queries() map[string][]string
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

### HttpRequestContext

Extended interface dedicated to HTTP.

```go
type HttpRequestContext interface {
    RequestContext

    Param(name string) string
    Query(name string) string
    Params() map[string]string
    Queries() map[string][]string
    Bind(out any) error
    MultipartForm() (*multipart.Form, error)
}
```

### ConsumerRequestContext

Extended interface dedicated to Event Consumers.

```go
type ConsumerRequestContext interface {
    RequestContext

    EventName() string
    Payload() []byte
}
```


## ExecutionContext Methods

### Context

```go
Context() context.Context
```

Returns `context.Context` from the Go standard library.

**Returns**
- `context.Context` - Request scope context

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
EventBus() publish.EventBus
```

Returns the request-scoped EventBus. Used for publishing domain events.

**Returns**
- `publish.EventBus` - Event bus instance

**Example**
```go
// Drain events in PostExecutionHook
func (h *EventDispatchHook) AfterExecution(ctx core.ExecutionContext, results []any, err error) {
    if err != nil {
        return
    }
    
    events := ctx.EventBus().Drain()
    if len(events) == 0 {
        return
    }
    
    h.Dispatcher.Dispatch(ctx.Context(), events)
}
```

### Method

```go
Method() string
```

Returns the request method.

**Returns**
- HTTP: `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, etc.
- Consumer: `"EVENT"`

**Example**
```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // Handle Preflight request
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
- HTTP: Request path (e.g. `"/users/123"`)
- Consumer: Event name (e.g. `"order.created"`)

**Example**
```go
log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
// HTTP: [REQ] GET /users/123
// Consumer: [REQ] EVENT order.created
```


### Header

```go
Header(name string) string
```

Returns the HTTP header value for the specified name.

**Parameters**
- `name` - Header name (case-insensitive)

**Returns**
- `string` - Header value. Empty string if not found.
- Always empty string in Consumer.

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
- `map[string]string` - Path parameter map
- Empty map in Consumer

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
- `[]string` - Key slice
- Empty slice in Consumer

**Example**
```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```


### Queries

```go
Queries() map[string][]string
```

Returns all query parameters as a map.

**Returns**
- `map[string][]string` - Query parameter map
- Empty map in Consumer

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

Stores a value in the internal storage.

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

Retrieves a value from the internal storage.

**Parameters**
- `key` - Key to retrieve

**Returns**
- `any` - Stored value
- `bool` - Whether the key exists

**Example**
```go
if rw, ok := ctx.Get("spine.response_writer"); ok {
    responseWriter := rw.(core.ResponseWriter)
}
```


## HttpRequestContext Methods

Additional methods used in HTTP ArgumentResolver.

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

### Bind

```go
Bind(out any) error
```

Binds the HTTP body to a struct.

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

Accesses Multipart form data.

**Example**
```go
form, err := ctx.MultipartForm()
if err != nil {
    return err
}
for _, file := range form.File["upload"] {
    // Process file
}
```


## ConsumerRequestContext Methods

Methods used in Event Consumer ArgumentResolver.

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

Returns the raw payload of the event.

**Example**
```go
payload := ctx.Payload()  // []byte (JSON)
var event OrderCreated
json.Unmarshal(payload, &event)
```


## Reserved Keys

| Key | Type | Description |
|-----|------|-------------|
| `spine.response_writer` | `core.ResponseWriter` | Response output interface |
| `spine.params` | `map[string]string` | Path parameters |
| `spine.pathKeys` | `[]string` | Path parameter key order |


## Usage in Interceptor

`ExecutionContext` is passed as the first argument in all Interceptor methods.

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### Logging Example

```go
type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s -> %s.%s",
        ctx.Method(),
        ctx.Path(),
        meta.ControllerType.Name(),
        meta.Method.Name,
    )
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

### CORS Example

```go
type CORSInterceptor struct {
    config Config
}

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return nil
    }
    rw := rwAny.(core.ResponseWriter)
    
    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
    }
    
    if ctx.Method() == "OPTIONS" {
        rw.WriteStatus(204)
        return core.ErrAbortPipeline
    }
    
    return nil
}
```


## Usage in ArgumentResolver

ArgumentResolver receives `ExecutionContext` and type assertions it to a protocol-specific Context as needed.

### HTTP Resolver Example

```go
func (r *PathIntResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    // Type assert to HttpRequestContext
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not an HTTP request context")
    }

    raw, ok := httpCtx.Params()[parameterMeta.PathKey]
    if !ok {
        return nil, fmt.Errorf("path param not found: %s", parameterMeta.PathKey)
    }

    value, err := strconv.ParseInt(raw, 10, 64)
    if err != nil {
        return nil, err
    }

    return path.Int{Value: value}, nil
}
```

### Consumer Resolver Example

```go
func (r *EventNameResolver) Resolve(ctx core.ExecutionContext, meta ParameterMeta) (any, error) {
    // Type assert to ConsumerRequestContext
    consumerCtx, ok := ctx.(core.ConsumerRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not a ConsumerRequestContext")
    }

    return consumerCtx.EventName(), nil
}
```

### Common Resolver Example

Resolver that works for both HTTP and Consumer.

```go
func (r *StdContextResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    baseCtx := ctx.Context()
    bus := ctx.EventBus()
    if bus != nil {
        // Inject EventBus into context.Context
        return context.WithValue(baseCtx, publish.PublisherKey, bus), nil
    }
    return baseCtx, nil
}
```


## HTTP vs Consumer Behavior Difference

| Method | HTTP | Consumer |
|--------|------|----------|
| `Method()` | `"GET"`, `"POST"`, etc. | `"EVENT"` |
| `Path()` | `/users/123` | `order.created` |
| `Header()` | Header value | Empty string |
| `Params()` | path params | Empty map |
| `PathKeys()` | key order | Empty slice |
| `Queries()` | query params | Empty map |
| `EventBus()` | EventBus | EventBus |
| `Context()` | Request context | Request context |


## See Also

- [Interceptor](/en/reference/api/interceptor) - Cross-cutting concerns
- [Execution Context Concepts](/en/learn/core-concepts/execution-context) - Detailed explanation
