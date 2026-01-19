# spine.App

API Reference for the main Application interface.

## Overview

`App` is the entry point of a Spine application. It is responsible for registering constructors, defining routes, setting up Interceptors, and running the server.

```go
import "github.com/NARUBROWN/spine"
```

## Interface Definition

```go
type App interface {
    Constructor(constructors ...any)
    Route(method string, path string, handler any)
    Interceptor(interceptors ...core.Interceptor)
    Run(address string) error
}
```

## Constructors

### New

```go
func New() App
```

Creates a new Spine application instance.

**Returns**
- `App` - Application instance

**Example**
```go
app := spine.New()
```

## Methods

### Constructor

```go
Constructor(constructors ...any)
```

Registers constructor functions to the IoC Container. Registered constructors are used for dependency injection.

**Parameters**
- `constructors` - Constructor functions (variadic)

**Constructor Rules**
- Must be a function
- Must return exactly one value
- Parameters must be other registered types (dependencies)

**Example**
```go
// Constructor without dependency
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// Constructor with dependency
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

app.Constructor(
    NewUserRepository,
    NewUserController,
)
```

### Route

```go
Route(method string, path string, handler any)
```

Registers an HTTP route.

**Parameters**
- `method` - HTTP method (`"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, etc.)
- `path` - URL path pattern. Define path parameters with `:param` format.
- `handler` - Controller method expression

**Path Patterns**
- `/users` - Static path
- `/users/:id` - Single parameter
- `/users/:userId/posts/:postId` - Multiple parameters

**Example**
```go
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// Nested Path
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

### Interceptor

```go
Interceptor(interceptors ...core.Interceptor)
```

Registers Interceptors. `PreHandle` is executed in registration order, while `PostHandle` and `AfterCompletion` are executed in reverse order.

**Parameters**
- `interceptors` - Interceptor instances (variadic)

**Example**
```go
app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "OPTIONS"},
        AllowHeaders: []string{"Content-Type"},
    }),
    &LoggingInterceptor{},
    &AuthInterceptor{},
)
```

### Run

```go
Run(address string) error
```

Starts the HTTP server. This method blocks.

**Parameters**
- `address` - Listening address (e.g., `":8080"`, `"127.0.0.1:3000"`)

**Returns**
- `error` - Error if server start fails

**Example**
```go
if err := app.Run(":8080"); err != nil {
    log.Fatal(err)
}
```

## Complete Example

```go
package main

import (
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
)

func main() {
    app := spine.New()

    // Register Constructors
    app.Constructor(
        NewUserRepository,
        NewUserController,
    )

    // Register Routes
    app.Route("GET", "/users", (*UserController).List)
    app.Route("GET", "/users/:id", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)

    // Register Interceptors
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
        }),
        &LoggingInterceptor{},
    )

    // Run Server
    app.Run(":8080")
}
```

## Bootstrap Order

When `Run()` is called, initialization occurs in the following order:

1. IoC Container Creation
2. Constructor Registration
3. Router Configuration and HandlerMeta Creation
4. Controller Warm-up (Pre-resolve dependencies)
5. Pipeline Configuration
6. ArgumentResolver Registration
7. ReturnValueHandler Registration
8. Interceptor Registration
9. HTTP Server Start

## See Also

- [Interceptor](/en/reference/api/interceptor) - Interceptor Interface
- [Execution Pipeline](/en/learn/core-concepts/pipeline) - Request Processing Flow
- [IoC Container](/en/learn/getting-started/intro#ioc-container) - Dependency Injection
