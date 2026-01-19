# core.ExecutionContext

API Reference for ExecutionContext.

## Overview

`ExecutionContext` is an interface for accessing HTTP request information and sharing data between components in the Spine pipeline. Users use this interface when implementing Interceptors.

```go
import "github.com/NARUBROWN/spine/core"
```

## Interface Definition

```go
type ExecutionContext interface {
    Context() context.Context
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

## Methods

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

### Method

```go
Method() string
```

Returns the HTTP request method.

**Returns**
- `string` - `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, etc.

**Example**
```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // Handle Preflight Request
    }
    return nil
}
```

### Path

```go
Path() string
```

Returns the HTTP request path. Query string is not included.

**Returns**
- `string` - Request path (e.g., `"/users/123"`)

**Example**
```go
log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
// [REQ] GET /users/123
```

### Header

```go
Header(name string) string
```

Returns the value of the specified HTTP header.

**Parameters**
- `name` - Header name (Case-insensitive)

**Returns**
- `string` - Header value. Empty string if not present.

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
- `bool` - Existence of key

**Example**
```go
if rw, ok := ctx.Get("spine.response_writer"); ok {
    responseWriter := rw.(core.ResponseWriter)
}
```

## Reserved Keys

| Key | Type | Description |
|----|------|------|
| `spine.response_writer` | `core.ResponseWriter` | Response Writer Interface |
| `spine.params` | `map[string]string` | Path parameters |
| `spine.pathKeys` | `[]string` | Path parameter key order |


## Usage in Interceptor

`ExecutionContext` is passed as the first argument to all methods of an Interceptor.

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

## See Also

- [Interceptor](/en/reference/api/interceptor) - Cross-cutting concern handling
- core.ResponseWriter - Response Writer Interface
