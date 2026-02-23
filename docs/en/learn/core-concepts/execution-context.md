# Execution Context

The core of Spine requests.

## Overview

`ExecutionContext` is a request-scoped context shared throughout the Spine pipeline. When an HTTP request arrives, the Transport adapter creates an `ExecutionContext`, which passes through all stages of the pipeline, carrying request information and execution state.

```mermaid
graph TD
    Request["HTTP Request / Event Message / WebSocket Message"]
    
    Transport["Transport Adapter<br>• Echo (HTTP)<br>• Kafka/RabbitMQ (Event)<br>• WebSocket"]
    
    Context["ExecutionContext<br>• Method, Path, Headers<br>• Path Parameters<br>• Query Parameters<br>• EventBus<br>• Internal Store"]
    
    Router["Router"]
    Interceptor["Interceptor"]
    ArgResolver["ArgumentResolver"]
    Invoker["Invoker"]
    ReturnHandler["ReturnValueHandler"]

    Request --> Transport
    Transport --> Context
    
    Context --> Router
    Context --> Interceptor
    Context --> ArgResolver
    Context --> Invoker
    Context --> ReturnHandler
```

## Context Hierarchy

Spine **separates Context hierarchically**. This design allows HTTP, Event Consumers, and WebSocket to be handled by the same pipeline model.

```mermaid
graph TB
    subgraph "Base Contracts"
        ContextCarrier["ContextCarrier<br>Context() context.Context"]
        EventBusCarrier["EventBusCarrier<br>EventBus() core.EventBus"]
    end
    
    subgraph "Execution Contract"
        ExecutionContext["ExecutionContext<br>• Method(), Path()<br>• Params(), Queries()<br>• Set(), Get()"]
    end
    
    subgraph "Controller Specific"
        ControllerContext["ControllerContext<br>• Get()"]
    end
    
    subgraph "Protocol-specific Extensions"
        HttpRequestContext["HttpRequestContext<br>• Param(), Query()<br>• Bind(), Headers()<br>• MultipartForm()"]
        ConsumerRequestContext["ConsumerRequestContext<br>• EventName()<br>• Payload()"]
        WebSocketContext["WebSocketContext<br>• ConnID()<br>• MessageType()<br>• Payload()"]
    end
    
    ContextCarrier --> ExecutionContext
    EventBusCarrier --> ExecutionContext
    ExecutionContext --> ControllerContext
    ContextCarrier --> HttpRequestContext
    EventBusCarrier --> HttpRequestContext
    ExecutionContext --> WebSocketContext
    ContextCarrier --> ConsumerRequestContext
    EventBusCarrier --> ConsumerRequestContext
```

### Why separation?

| Layer | Responsibility | Usage Location |
|------|------|----------|
| `ContextCarrier` | Carry Go standard context | Everywhere |
| `EventBusCarrier` | Publish domain events (`core.EventBus`) | Controller, Consumer |
| `ExecutionContext` | Control execution flow | Router, Pipeline, Interceptor |
| `ControllerContext` | Read-only Facade for ExecutionContext | Controller (Access values injected by Interceptors) |
| `HttpRequestContext` | Interpret HTTP input | HTTP ArgumentResolver |
| `ConsumerRequestContext` | Interpret Event input | Consumer ArgumentResolver |
| `WebSocketContext` | Interpret WebSocket input | WebSocket ArgumentResolver |

**Goal**: Enable HTTP, Event Consumers, and WebSocket to share the same pipeline model while allowing input interpretation tailored to each protocol's characteristics.

## Base Interfaces

### ContextCarrier

Minimal contract for carrying Go standard `context.Context`.

```go
// core/context.go
type ContextCarrier interface {
    Context() context.Context
}
```

### EventBusCarrier

Contract for accessing EventBus to publish domain events. The return type is `core.EventBus`.

```go
// core/context.go
type EventBusCarrier interface {
    EventBus() EventBus
}
```

`core.EventBus` is the minimal contract for collecting domain events and publishing them all at once after execution.

```go
// core/event_bus.go
type EventBus interface {
    Publish(events ...publish.DomainEvent)
    Drain() []publish.DomainEvent
}
```

> **Note**: `internal/event/publish.EventBus` is a type alias for `core.EventBus` (`type EventBus = core.EventBus`), and the internal implementation is configured to satisfy this type.

## ExecutionContext Interface

Interface for execution flow control used throughout the pipeline.

```go
// core/context.go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier

    // HTTP Request Info (Different meaning in Consumer/WebSocket)
    Method() string                    // HTTP: GET, POST... / Consumer: "EVENT" / WS: "WS"
    Path() string                      // HTTP: /users/123 / Consumer: EventName / WS: path
    Header(name string) string         // HTTP Header (Empty string for Consumer, WS)
    
    // Parameter Access
    Params() map[string]string         // Path parameters
    PathKeys() []string                // Path key order
    Queries() map[string][]string      // Query parameters
    
    // Internal Store
    Set(key string, value any)         // Store value
    Get(key string) (any, bool)        // Retrieve value
}
```

### Method Details

#### Context()

Returns Go standard `context.Context`. Used for request cancellation, timeouts, and value passing.

```go
func (e *echoContext) Context() context.Context {
    return e.reqCtx  // HTTP request context
}
```

#### EventBus()

Returns the request-scoped EventBus. Used when publishing domain events from the Controller.

```go
func (c *echoContext) EventBus() publish.EventBus {
    return c.eventBus
}
```

#### Method() / Path()

Returns the method and path of the HTTP request. Used with different meanings in Consumers and WebSockets.

```go
// HTTP
ctx.Method()  // "GET"
ctx.Path()    // "/users/123/posts/456"

// Consumer
ctx.Method()  // "EVENT"
ctx.Path()    // "order.created" (EventName)

// WebSocket
ctx.Method()  // "WS"
ctx.Path()    // WebSocket path
```

#### Params() / PathKeys()

Provides Path parameter information.

```go
// Route: /users/:userId/posts/:postId
// Request: /users/123/posts/456

ctx.Params()    // {"userId": "123", "postId": "456"}
ctx.PathKeys()  // ["userId", "postId"]
```

`PathKeys()` guarantees the **declaration order** of parameters. Essential for Spine's order-based binding.

#### Queries()

Returns Query parameters in a multi-value format.

```go
// Request: /users?status=active&tag=go&tag=web

ctx.Queries()  // {"status": ["active"], "tag": ["go", "web"]}
```

#### Set() / Get()

Storage for sharing values within the pipeline.

```go
// Store path params in Router
ctx.Set("spine.params", params)
ctx.Set("spine.pathKeys", keys)

// Store ResponseWriter in Adapter
ctx.Set("spine.response_writer", NewEchoResponseWriter(c))

// Retrieve in Interceptor
rw, ok := ctx.Get("spine.response_writer")
```

## ControllerContext Interface

Controller-specific Context View. It is a read-only Facade of `ExecutionContext`, acting as the official channel for the Controller to reference values injected by Interceptors.

```go
// core/context.go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

### Implementation

```go
// internal/runtime/controller_ctx.go
type controllerCtxView struct {
    ec core.ExecutionContext
}

func NewControllerContext(ec core.ExecutionContext) core.ControllerContext {
    return controllerCtxView{ec: ec}
}

func (v controllerCtxView) Get(key string) (any, bool) {
    return v.ec.Get(key)
}
```

### Usage Example

```go
// Reference value injected by Interceptor in Controller
func (c *UserController) GetUser(ctx context.Context, cc core.ControllerContext, userId path.Int) User {
    authInfo, _ := cc.Get("auth.user")
    // ...
}
```

> **Note**: In `pkg/spine/types.go`, the `Ctx` interface (`Get(key string) (any, bool)`) is defined, allowing user code to access it via `spine.Ctx` as well.

## HttpRequestContext Interface

HTTP-specific extension interface. Used in HTTP ArgumentResolvers.

```go
// core/context.go
type HttpRequestContext interface {
    ContextCarrier
    EventBusCarrier

    // Access individual parameters
    Param(name string) string          // Specific path param
    Query(name string) string          // Specific query param (first value)
    Header(name string) string         // Specific header
    
    // Access full view
    Params() map[string]string         // All path params
    Queries() map[string][]string      // All query params
    Headers() map[string][]string      // All headers
    
    // Body Binding
    Bind(out any) error                // JSON body → struct
    
    // Multipart
    MultipartForm() (*multipart.Form, error)
}
```

> **Note**: `HttpRequestContext` does not embed `RequestContext`. It directly embeds `ContextCarrier` and `EventBusCarrier`. Additionally, the `Headers() map[string][]string` method is added to access the full header map.

### Method Details

#### Param() / Query()

Conveniently access individual parameters.

```go
// Route: /users/:id?page=1&size=20

ctx.Param("id")      // "123"
ctx.Query("page")    // "1"
ctx.Query("size")    // "20"
ctx.Query("missing") // "" (returns empty string if missing)
```

#### Bind()

Binds the HTTP body to a struct.

```go
// internal/resolver/dto_resolver.go
func (r *DTOResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not an HTTP request context")
    }

    valuePtr := reflect.New(parameterMeta.Type)

    if err := httpCtx.Bind(valuePtr.Interface()); err != nil {
        return nil, fmt.Errorf("DTO binding failed (%s): %w", parameterMeta.Type.Name(), err)
    }

    return valuePtr.Elem().Interface(), nil
}
```

#### MultipartForm()

Accesses Multipart form data. Used for file upload processing.

```go
// internal/resolver/uploaded_files_resolver.go
func (r *UploadedFilesResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not an HTTP request context")
    }

    form, err := httpCtx.MultipartForm()
    if err != nil {
        return nil, err
    }
    // ...
}
```

## ConsumerRequestContext Interface

Event Consumer-specific extension interface.

```go
// core/context.go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string    // Event name (e.g., "order.created")
    Payload() []byte      // Event payload (JSON, etc.)
}
```

### Method Details

#### EventName()

Returns the name of the received event.

```go
ctx.EventName()  // "order.created"
```

#### Payload()

Returns the raw payload of the event.

```go
payload := ctx.Payload()  // []byte (JSON)
```

### Consumer Resolver Example

```go
// internal/event/consumer/resolver/dto_resolver.go
func (r *DTOResolver) Resolve(ctx core.ExecutionContext, meta resolver.ParameterMeta) (any, error) {
    consumerCtx, ok := ctx.(core.ConsumerRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not a ConsumerRequestContext")
    }

    payload := consumerCtx.Payload()
    if payload == nil {
        return nil, fmt.Errorf("Payload is empty, cannot create DTO")
    }

    dtoPtr := reflect.New(meta.Type)
    if err := json.Unmarshal(payload, dtoPtr.Interface()); err != nil {
        return nil, fmt.Errorf("Failed to deserialize DTO: %w", err)
    }

    return dtoPtr.Elem().Interface(), nil
}
```

## WebSocketContext Interface

WebSocket-specific ExecutionContext extension. It embeds `ExecutionContext` to maintain pipeline compatibility.

```go
// core/context.go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string       // Connection ID
    MessageType() int     // Message type (Text, Binary, etc.)
    Payload() []byte      // Message payload
}
```

### WebSocket Resolver Example

```go
// internal/ws/resolver/dto_resolver.go
func (r *DTOResolver) Resolve(ctx core.ExecutionContext, meta resolver.ParameterMeta) (any, error) {
    wsCtx, ok := ctx.(core.WebSocketContext)
    if !ok {
        return nil, fmt.Errorf("Not a WebSocketContext")
    }

    payload := wsCtx.Payload()
    if payload == nil {
        return nil, fmt.Errorf("Payload is empty, cannot create DTO")
    }

    dtoPtr := reflect.New(meta.Type)
    if err := json.Unmarshal(payload, dtoPtr.Interface()); err != nil {
        return nil, fmt.Errorf("Failed to deserialize DTO: %w", err)
    }

    return dtoPtr.Elem().Interface(), nil
}
```

## Echo Adapter Implementation

Spine uses Echo as the HTTP Transport layer. `echoContext` implements both `ExecutionContext` and `HttpRequestContext`.

```go
// internal/adapter/echo/context_impl.go
type echoContext struct {
    echo     echo.Context           // Original Echo context
    reqCtx   context.Context        // Request scope context
    store    map[string]any         // Internal store
    eventBus publish.EventBus       // Event bus
}

func NewContext(c echo.Context) core.ExecutionContext {
    return &echoContext{
        echo:     c,
        reqCtx:   c.Request().Context(),
        store:    make(map[string]any),
        eventBus: publish.NewEventBus(),
    }
}
```

### Key Implementations

#### Path Parameters

Uses results matched by the Router first, then falls back to Echo's values.

```go
func (e *echoContext) Param(name string) string {
    // Priority: Value stored by Spine Router
    if raw, ok := e.store["spine.params"]; ok {
        if m, ok := raw.(map[string]string); ok {
            if v, ok := m[name]; ok {
                return v
            }
        }
    }
    // Fallback to Echo
    return e.echo.Param(name)
}
```

#### Params() - Defensive Copy

Returns a copy to prevent modification of the original map from outside. Uses `maps.Copy`.

```go
func (e *echoContext) Params() map[string]string {
    if raw, ok := e.store["spine.params"]; ok {
        if m, ok := raw.(map[string]string); ok {
            // return a shallow copy to avoid mutation
            copyMap := make(map[string]string, len(m))
            maps.Copy(copyMap, m)
            return copyMap
        }
    }
    // Construct directly from Echo
    names := e.echo.ParamNames()
    values := e.echo.ParamValues()
    params := make(map[string]string, len(names))
    for i, name := range names {
        if i < len(values) {
            params[name] = values[i]
        }
    }
    return params
}
```

#### Headers()

Returns all HTTP headers as a map.

```go
func (e *echoContext) Headers() map[string][]string {
    return e.echo.Request().Header
}
```

#### EventBus

Returns the request-scoped EventBus.

```go
func (c *echoContext) EventBus() publish.EventBus {
    return c.eventBus
}
```

## Consumer Adapter Implementation

Context implementation for Event Consumers.

```go
// internal/event/consumer/request_context_impl.go
type ConsumerRequestContextImpl struct {
    ctx      context.Context
    msg      *Message
    eventBus publish.EventBus
    store    map[string]any
}

func NewRequestContext(
    ctx context.Context,
    msg *Message,
    eventBus publish.EventBus,
) core.ExecutionContext {
    return &ConsumerRequestContextImpl{
        ctx:      ctx,
        msg:      msg,
        eventBus: eventBus,
        store:    make(map[string]any),
    }
}
```

### Special Behaviors of Consumer Context

Since Consumers are not HTTP, some methods behave differently.

```go
func (c *ConsumerRequestContextImpl) Method() string {
    // Consumer execution has no concept of HTTP Method
    // We use "EVENT" for routing distinction
    return "EVENT"
}

func (c *ConsumerRequestContextImpl) Path() string {
    // In Consumer routing, Path directly uses the EventName
    return c.msg.EventName
}

func (c *ConsumerRequestContextImpl) Header(key string) string {
    // Consumer has no concept of HTTP Headers
    return ""
}

func (c *ConsumerRequestContextImpl) Params() map[string]string {
    // Consumer has no concept of Path Parameters
    return map[string]string{}
}

func (c *ConsumerRequestContextImpl) PathKeys() []string {
    // Consumer has no concept of Path Keys
    return []string{}
}

func (c *ConsumerRequestContextImpl) Queries() map[string][]string {
    // Consumer has no concept of Query Parameters
    return map[string][]string{}
}
```

## WebSocket Adapter Implementation

Context implementation for WebSocket. Implements `core.WebSocketContext`.

```go
// internal/ws/context_impl.go
type WSExecutionContext struct {
    ctx         context.Context
    connID      string
    path        string
    messageType int
    payload     []byte
    eventBus    publish.EventBus
    store       map[string]any
}

func NewWSExecutionContext(
    ctx context.Context,
    connID string,
    path string,
    messageType int,
    payload []byte,
    eventBus publish.EventBus,
    sendFn func(int, []byte) error,
) core.WebSocketContext {
    ctx = context.WithValue(ctx, pkgws.SenderKey, &connSender{send: sendFn})

    return &WSExecutionContext{
        ctx:         ctx,
        connID:      connID,
        path:        path,
        messageType: messageType,
        payload:     payload,
        eventBus:    eventBus,
        store:       make(map[string]any),
    }
}
```

### Special Behaviors of WebSocket Context

```go
func (w *WSExecutionContext) Method() string {
    return "WS"
}

func (w *WSExecutionContext) ConnID() string {
    return w.connID
}

func (w *WSExecutionContext) MessageType() int {
    return w.messageType
}

func (w *WSExecutionContext) Payload() []byte {
    return w.payload
}

func (w *WSExecutionContext) EventBus() core.EventBus {
    return w.eventBus
}
```

## ArgumentResolver and Context

`ArgumentResolver` receives `ExecutionContext` and type-asserts to protocol-specific Context as needed.

```go
// internal/resolver/argument.go
type ArgumentResolver interface {
    Supports(parameterMeta ParameterMeta) bool
    Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error)
}
```

### HTTP Resolver Example

```go
// internal/resolver/path_int_resolver.go
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
// internal/event/consumer/resolver/event_name_resolver.go
func (r *EventNameResolver) Resolve(ctx core.ExecutionContext, meta resolver.ParameterMeta) (any, error) {
    // Type assert to ConsumerRequestContext
    consumerCtx, ok := ctx.(core.ConsumerRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not a ConsumerRequestContext")
    }

    name := consumerCtx.EventName()
    if name == "" {
        return nil, fmt.Errorf("EventName not found in RequestContext")
    }

    return name, nil
}
```

### Common Resolver Example

`StdContextResolver` works for HTTP, Consumer, and WebSocket.

```go
// internal/resolver/std_context_resolver.go
func (r *StdContextResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    baseCtx := ctx.Context()
    bus := ctx.EventBus()
    if bus != nil {
        return context.WithValue(baseCtx, publish.PublisherKey, bus), nil
    }
    return baseCtx, nil
}
```

### ControllerContext Resolver

`ControllerContextResolver` wraps the `ExecutionContext` in a read-only `ControllerContext`.

```go
// internal/resolver/controller_context_resolver.go
func (r *ControllerContextResolver) Resolve(ctx core.ExecutionContext, _ ParameterMeta) (any, error) {
    return runtime.NewControllerContext(ctx), nil
}
```

## Usage in Pipeline

### Router

```go
// internal/router/router.go
func (r *DefaultRouter) Route(ctx core.ExecutionContext) (core.HandlerMeta, error) {
    for _, route := range r.routes {
        if route.Method != ctx.Method() {
            continue
        }
        
        ok, params, keys := matchPath(route.Path, ctx.Path())
        if !ok {
            continue
        }
        
        // Store matched info in Context
        ctx.Set("spine.params", params)
        ctx.Set("spine.pathKeys", keys)
        
        return route.Meta, nil
    }
    return core.HandlerMeta{}, httperr.NotFound("Handler not found.")
}
```

### Pipeline - Execute Flow

```go
// internal/pipeline/pipeline.go
func (p *Pipeline) Execute(ctx core.ExecutionContext) (finalErr error) {
    // 1. Global Interceptor PreHandle (Before routing)
    // 2. Router determines the execution target
    // 3. Route Interceptor PreHandle
    // 4. ArgumentResolver chain execution
    // 5. Controller Method invocation (Invoker)
    // 6. ReturnValueHandler processing
    // 7. PostExecutionHook (Event dispatch, etc.)
    // 8. Route Interceptor PostHandle (Reverse order)
    // 9. Global Interceptor PostHandle (Reverse order)
    // 10. AfterCompletion (Guaranteed regardless of success/failure, reverse order)
}
```

### Pipeline - Calling ArgumentResolver

```go
// internal/pipeline/pipeline.go
func (p *Pipeline) resolveArguments(ctx core.ExecutionContext, paramMetas []resolver.ParameterMeta) ([]any, error) {
    args := make([]any, 0, len(paramMetas))

    for _, paramMeta := range paramMetas {
        resolved := false

        for _, r := range p.argumentResolvers {
            if !r.Supports(paramMeta) {
                continue
            }

            // Pass ExecutionContext directly
            // Type assertion happens inside Resolver if needed
            val, err := r.Resolve(ctx, paramMeta)
            if err != nil {
                return nil, err
            }

            args = append(args, val)
            resolved = true
            break
        }

        if !resolved {
            return nil, fmt.Errorf(
                "No ArgumentResolver for parameter %d (%s)",
                paramMeta.Index,
                paramMeta.Type.String(),
            )
        }
    }
    return args, nil
}
```

### Interceptor

```go
// interceptor/cors/cors.go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Acquire ResponseWriter
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return nil
    }
    rw := rwAny.(core.ResponseWriter)
    
    // Check request info
    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
    }
    
    // Handle Preflight
    if ctx.Method() == "OPTIONS" {
        rw.WriteStatus(204)
        return core.ErrAbortPipeline
    }
    
    return nil
}
```

## Internal Store Conventions

There are clear conventions for keys used with `Set()`/`Get()`.

### Spine Reserved Keys

| Key | Type | Set Location | Purpose |
|----|------|----------|------|
| `spine.params` | `map[string]string` | Router | Path parameter values |
| `spine.pathKeys` | `[]string` | Router | Path key order |
| `spine.response_writer` | `core.ResponseWriter` | Adapter | Output response |

### Usage Example

```go
// Using ResponseWriter in ReturnValueHandler
func (h *JSONReturnHandler) Handle(value any, ctx core.ExecutionContext) error {
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return fmt.Errorf("ResponseWriter not found in ExecutionContext.")
    }
    
    rw, ok := rwAny.(core.ResponseWriter)
    if !ok {
        return fmt.Errorf("Invalid ResponseWriter type.")
    }
    
    return rw.WriteJSON(200, value)
}
```

## EventBus Integration

`core.EventBus` is integrated into `ExecutionContext`.

### Publishing Events in Controller

```go
// cmd/demo/controller.go
func (c *UserController) CreateOrder(ctx context.Context, orderId path.Int) string {
    // Extract EventBus from context.Context and publish event
    publish.Event(ctx, OrderCreated{
        OrderID: orderId.Value,
        At:      time.Now(),
    })

    return "OK"
}
```

### EventBus Injection Flow

```go
// internal/resolver/std_context_resolver.go
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

### Event Dispatch in PostExecutionHook

Dispatches all collected events at once after the Pipeline execution completes.

```go
// internal/event/hook/post_execution.go
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

## Design Principles

### 1. Controllers Do Not Know ExecutionContext

Controllers do not directly receive `ExecutionContext` or `HttpRequestContext`. Instead, they receive only necessary values via semantic types (`path.Int`, `query.Values`, etc.), `context.Context`, and `ControllerContext` if needed.

```go
// ❌ Anti-pattern
func (c *UserController) GetUser(ctx core.ExecutionContext) User

// ✓ Spine way
func (c *UserController) GetUser(ctx context.Context, userId path.Int) User

// ✓ When injected values from Interceptors are needed
func (c *UserController) GetUser(ctx context.Context, cc core.ControllerContext, userId path.Int) User
```

### 2. Resolvers Receive ExecutionContext and Assert Types

ArgumentResolvers receive `ExecutionContext`. If protocol-specific features are needed, they type assert to `HttpRequestContext`, `ConsumerRequestContext`, or `WebSocketContext`.

```go
func (r *PathIntResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not an HTTP request context")
    }
    // ...
}
```

### 3. Single Pipeline, Multiple Protocols

HTTP, Event Consumers, and WebSocket share the same pipeline structure. Context hierarchy separation supports protocol-specific characteristics while maximizing code reuse.

```go
// HTTP Pipeline
httpPipeline.AddArgumentResolver(
    &resolver.StdContextResolver{},           // Common
    &resolver.ControllerContextResolver{},    // Common
    &resolver.HeaderResolver{},               // HTTP specific
    &resolver.PathIntResolver{},              // HTTP specific
    &resolver.PathStringResolver{},           // HTTP specific
    &resolver.PathBooleanResolver{},          // HTTP specific
    &resolver.PaginationResolver{},           // HTTP specific
    &resolver.QueryValuesResolver{},          // HTTP specific
    &resolver.DTOResolver{},                  // HTTP specific
    &resolver.FormDTOResolver{},              // HTTP specific
    &resolver.UploadedFilesResolver{},        // HTTP specific
)

// Consumer Pipeline
consumerPipeline.AddArgumentResolver(
    &resolver.StdContextResolver{},           // Common
    &eventResolver.EventNameResolver{},       // Consumer specific
    &eventResolver.DTOResolver{},             // Consumer specific
)

// WebSocket Pipeline
wsPipeline.AddArgumentResolver(
    &resolver.StdContextResolver{},           // Common
    &wsResolver.ConnectionIDResolver{},       // WebSocket specific
    &wsResolver.DTOResolver{},                // WebSocket specific
)
```

## Summary

| Interface | Role | Main Methods | Usage Location |
|-----------|------|------------|----------|
| `ContextCarrier` | Carry Go context | `Context()` | Everywhere |
| `EventBusCarrier` | Publish events (`core.EventBus`) | `EventBus()` | Controller, Consumer |
| `ExecutionContext` | Control execution flow | `Method()`, `Path()`, `Header()`, `Set()`, `Get()` | Router, Pipeline, Interceptor |
| `ControllerContext` | Read-only Facade for ExecutionContext | `Get()` | Controller |
| `HttpRequestContext` | Interpret HTTP input | `Param()`, `Query()`, `Header()`, `Headers()`, `Bind()`, `MultipartForm()` | HTTP ArgumentResolver |
| `ConsumerRequestContext` | Interpret Event input | `EventName()`, `Payload()` | Consumer ArgumentResolver |
| `WebSocketContext` | Interpret WebSocket input | `ConnID()`, `MessageType()`, `Payload()` | WebSocket ArgumentResolver |

**Core Principle**: With Context hierarchy separation, HTTP, Event Consumers, and WebSockets share the same pipeline model. Controllers are completely unaware of the execution model and focus solely on business logic.
