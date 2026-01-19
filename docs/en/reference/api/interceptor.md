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

**Always** executed at the end regardless of success/failure. Called in reverse order. Used for resource cleanup, metrics collection, etc.

**Parameters**
- `ctx` - Request context
- `meta` - Information about the executed Controller method
- `err` - Error occurred during pipeline execution (`nil` if none)

**Example**
```go
func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

## Execution Order

```
Interceptor A.PreHandle()
    ↓
Interceptor B.PreHandle()
    ↓
Controller Call
    ↓
ReturnValueHandler
    ↓
Interceptor B.PostHandle()    ← Reverse
    ↓
Interceptor A.PostHandle()    ← Reverse
    ↓
Interceptor B.AfterCompletion()  ← Reverse, Always Executed
    ↓
Interceptor A.AfterCompletion()  ← Reverse, Always Executed
```

## Aborting Pipeline

Returning `core.ErrAbortPipeline` in `PreHandle` terminates the pipeline without calling the Controller. This is treated as a normal termination, not an error.

```go
import "github.com/NARUBROWN/spine/core"

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Respond to Preflight request without calling Controller
    if ctx.Method() == "OPTIONS" {
        rw, _ := ctx.Get("spine.response_writer")
        rw.(core.ResponseWriter).WriteStatus(204)
        return core.ErrAbortPipeline  // Normal termination
    }
    return nil
}
```

## Registration

```go
app := spine.New()

app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
    }),
    &LoggingInterceptor{},
    &AuthInterceptor{},
)
```

`PreHandle` is executed in registration order, while `PostHandle` and `AfterCompletion` are executed in reverse order.

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

## See Also

- [ExecutionContext](/en/reference/api/execution-context) - Request Context Interface
- [HandlerMeta](/en/learn/core-concepts/handler-meta) - Handler Metadata
- ResponseWriter - Response Writer Interface
