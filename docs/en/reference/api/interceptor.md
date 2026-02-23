# core.Interceptor

API Reference for Interceptor interface.

## Overview

`Interceptor` is an interface for handling cross-cutting concerns before and after Controller calls. It is used for logging, authentication, CORS, transaction management, etc.

```go
import "github.com/NARUBROWN/spine/core"
```

## Interface Definition

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

## Methods

### PreHandle

```go
PreHandle(ctx ExecutionContext, meta HandlerMeta) error
```

Executed **before** Controller call.

**Parameters**
- `ctx` - Request context
- `meta` - Information about the Controller method to be executed

**Returns**
- `error` - Aborts pipeline if error is returned
- `nil` - Proceeds to next step
- `core.ErrAbortPipeline` - Aborts pipeline (Not an error, response completed state)

**Example**
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

```go
PostHandle(ctx ExecutionContext, meta HandlerMeta)
```

Executed **after** Controller call and ReturnValueHandler processing. Called in reverse order.

**Parameters**
- `ctx` - Request context
- `meta` - Information about the executed Controller method

**Example**
```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}
```

### AfterCompletion

```go
AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
```

**Always** executed at the end regardless of success/failure. Guaranteed by `defer`. Called in reverse order. Used for resource cleanup, metrics collection, etc.

**Parameters**
- `ctx` - Request context
- `meta` - Information about the executed Controller method
- `err` - Final error occurred during pipeline execution (`nil` if none)

**Example**
```go
func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

## Global vs Route Interceptors

### Global Interceptors

Applied to all requests. `PreHandle` is executed **before routing**.

```go
app := spine.New()

app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
    }),
    &LoggingInterceptor{},
)
```

In `PreHandle` of a Global Interceptor, an empty `HandlerMeta{}` is passed because routing hasn't completed yet.

### Route Interceptors

Applied only to specific routes. `PreHandle` is executed **after routing, before Controller invocation**. Actual `HandlerMeta` is passed.

```go
import "github.com/NARUBROWN/spine/pkg/route"

app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

### Container Resolution via nil Pointer

Registering a Route Interceptor as a nil pointer automatically resolves it from the IoC Container at bootstrap time. This makes it easy to use interceptors with dependencies.

```go
// nil pointer → Resolves from Container
app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// Passing instance directly
app.Route("GET", "/public/users/:id", (*UserController).GetUser,
    route.WithInterceptors(&RateLimitInterceptor{Limit: 100}),
)
```

| Registration Method | Behavior |
|----------|------|
| `(*AuthInterceptor)(nil)` | Resolve from Container (Dependency Injection possible) |
| `&RateLimitInterceptor{Limit: 100}` | Use instance directly |


## Execution Order

The actual execution order verified by tests.

### Normal Flow

```
Global.PreHandle()
    ↓
  [Router]
    ↓
  [ArgumentResolver]
    ↓
Route.PreHandle()
    ↓
  [Controller Call]
    ↓
  [ReturnValueHandler]
    ↓
  [PostExecutionHook]
    ↓
Route.PostHandle()        ← Reverse
    ↓
Global.PostHandle()       ← Reverse
    ↓
Route.AfterCompletion()   ← Reverse, Always Executed
    ↓
Global.AfterCompletion()  ← Reverse, Always Executed
```

### Abort in Route Interceptor

```
Global.PreHandle()
    ↓
  [Router]
    ↓
  [ArgumentResolver]
    ↓
Route.PreHandle() → ErrAbortPipeline
    ↓
Route.AfterCompletion()   ← Always Executed
    ↓
Global.AfterCompletion()  ← Always Executed
```

Controller and PostHandle are not called, but `AfterCompletion` is always guaranteed.

### Abort in Global Interceptor

```
Global.PreHandle() → ErrAbortPipeline
    ↓
Global.AfterCompletion()  ← Always Executed
```

The Router isn't called either, so Route Interceptors are not executed.


## Aborting Pipeline

Returning `core.ErrAbortPipeline` in `PreHandle` terminates the pipeline without calling the Controller. This is treated as a normal termination, not an error.

```go
import "github.com/NARUBROWN/spine/core"

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return nil
    }
    rw := rwAny.(core.ResponseWriter)
    
    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
        rw.SetHeader("Vary", "Origin")
    }
    
    // Respond to Preflight request without calling Controller
    if ctx.Method() == "OPTIONS" {
        rw.WriteStatus(204)
        return core.ErrAbortPipeline  // Normal termination
    }
    return nil
}
```

## Interceptor Handling in Bootstrap

### Global Interceptor Deduplication

If the same type of Global Interceptor is registered multiple times, only the first registration is kept.

```go
// internal/bootstrap/bootstrap.go
seen := make(map[reflect.Type]struct{})
ordered := make([]core.Interceptor, 0, len(config.Interceptors))
for _, interceptor := range config.Interceptors {
    t := reflect.TypeOf(interceptor)
    if _, ok := seen[t]; ok {
        continue  // Ignore duplicate type
    }
    seen[t] = struct{}{}
    ordered = append(ordered, interceptor)
}
```

### Global Interceptor nil Pointer Resolution

Registering a Global Interceptor as a nil pointer also resolves it from the Container.

```go
app.Interceptor((*LoggingInterceptor)(nil))  // Resolves from Container
```

## Implementation Examples

### Logging Interceptor

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

### Timing Interceptor

```go
type TimingInterceptor struct{}

func (i *TimingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    ctx.Set("timing.start", time.Now())
    return nil
}

func (i *TimingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TimingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if start, ok := ctx.Get("timing.start"); ok {
        elapsed := time.Since(start.(time.Time))
        log.Printf("[TIMING] %s %s took %v", ctx.Method(), ctx.Path(), elapsed)
    }
}
```

### Auth Interceptor (Route Level)

```go
type AuthInterceptor struct {
    auth *AuthService  // Injected from Container
}

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

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```

Applying to a route:

```go
// Registering as nil pointer → Resolves from Container with AuthService dependency
app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

## Summary

| Distinction | Global Interceptor | Route Interceptor |
|------|---------------|---------------|
| Registration | `app.Interceptor()` | `route.WithInterceptors()` |
| Scope | All requests | Specific routes only |
| PreHandle timing | **Before** routing | **After** routing |
| meta content | Empty `HandlerMeta{}` | Actual `HandlerMeta` |
| nil pointer | Supports Container Resolve | Supports Container Resolve |
| Deduplication | Keeps only the first registration of the same type | N/A |


## See Also

- [ExecutionContext](/en/reference/api/execution-context) - Request Context Interface
- [HandlerMeta](/en/learn/core-concepts/handler-meta) - Handler Metadata
- ResponseWriter - Response Writer Interface
