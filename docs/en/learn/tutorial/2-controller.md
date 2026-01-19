# Controller

Writing Controllers in Spine.

## What is a Controller?

The Controller is the layer that receives HTTP requests and delegates them to the Service.

A Spine Controller is a **pure Go struct**. No annotations, decorators, or special interface implementations are required.

```go
// This is all
type UserController struct {
    svc *service.UserService
}
```

## Basic Structure

### 1. Define Struct

```go
package controller

type UserController struct {
    svc *service.UserService  // Dependency
}
```

### 2. Write Constructor

```go
// Constructor parameters = Dependency declaration
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 3. Write Handler Method

```go
// Function signature IS the API spec
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    return c.svc.Get(ctx, q.Int("id", 0))
}
```

### 4. Register Route

```go
app.Route("GET", "/users", (*UserController).GetUser)
```


## Handler Signature

Spine analyzes the handler's function signature to automatically bind inputs.

### Supported Parameter Types

| Type | Description | Example |
|------|------|------|
| `context.Context` | Request Context | `ctx context.Context` |
| `query.Values` | Query Parameters | `q query.Values` |
| `struct` (DTO) | JSON Request Body | `req CreateUserRequest` |

### Supported Return Types

| Type | Description |
|------|------|
| `(T, error)` | Response object and error |
| `error` | Error only (no response body) |


## Receiving Input

### Query Parameters

Use `query.Values` to parse query strings.

```go
// GET /users?id=1&name=alice

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    id := q.Int("id", 0)           // int64, default 0
    name := q.String("name", "")   // string, default ""
    
    return c.svc.Get(ctx, int(id))
}
```

#### query.Values Methods

| Method | Return Type | Description |
|--------|----------|------|
| `String(key, default)` | `string` | String value |
| `Int(key, default)` | `int64` | Integer value |
| `Bool(key, default)` | `bool` | Boolean value |
| `Float(key, default)` | `float64` | Float value |


### JSON Request Body

Declaring a DTO struct as a parameter automatically binds JSON.

```go
// POST /users
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,  // ← Auto binding
) (dto.UserResponse, error) {
    return c.svc.Create(ctx, req.Name, req.Email)
}
```

```go
// dto/user_request.go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

### Using Query + JSON Body Together

```go
// PUT /users?id=1
// Body: {"name": "Alice Updated"}

func (c *UserController) UpdateUser(
    ctx context.Context,
    q query.Values,
    req dto.UpdateUserRequest,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))
    return c.svc.Update(ctx, id, req.Name)
}
```

## Returning Reponse

### Success Response

Returning a struct automatically results in a JSON response.

```go
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    user, err := c.svc.Get(ctx, int(q.Int("id", 0)))
    if err != nil {
        return dto.UserResponse{}, err
    }
    
    return user, nil  // ← 200 OK + JSON
}
```

```go
// dto/user_response.go
type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

Response:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### Error Response

Use the `httperr` package to return HTTP status codes and messages.

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    user, err := c.svc.Get(ctx, int(q.Int("id", 0)))
    if err != nil {
        // 404 Not Found
        return dto.UserResponse{}, httperr.NotFound("User not found.")
    }
    
    return user, nil
}
```

#### httperr Functions

| Function | Status Code |
|------|----------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.Forbidden(msg)` | 403 |
| `httperr.NotFound(msg)` | 404 |
| `httperr.InternalServerError(msg)` | 500 |


### Returning Without Response Body

If no response body is needed, such as for deletions, return only `error`.

```go
func (c *UserController) DeleteUser(
    ctx context.Context,
    q query.Values,
) error {
    id := int(q.Int("id", 0))
    return c.svc.Delete(ctx, id)  // ← 200 OK on success (no body)
}
```


## Registering Routes

Connect Controller methods to routes.

```go
// routes/user_routes.go
package routes

import (
    "my-app/controller"
    "github.com/NARUBROWN/spine"
)

func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).GetUser)
    app.Route("POST", "/users", (*controller.UserController).CreateUser)
    app.Route("PUT", "/users", (*controller.UserController).UpdateUser)
    app.Route("DELETE", "/users", (*controller.UserController).DeleteUser)
}
```

```go
// main.go
func main() {
    app := spine.New()
    app.Constructor(/* ... */)
    routes.RegisterUserRoutes(app)
    app.Run(":8080")
}
```

## Complete Example

```go
// controller/user_controller.go
package controller

import (
    "context"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GET /users?id=1
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))
    
    user, err := c.svc.Get(ctx, id)
    if err != nil {
        return dto.UserResponse{}, httperr.NotFound("User not found.")
    }
    
    return user, nil
}

// POST /users
func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,
) (dto.UserResponse, error) {
    return c.svc.Create(ctx, req.Name, req.Email)
}

// PUT /users?id=1
func (c *UserController) UpdateUser(
    ctx context.Context,
    q query.Values,
    req dto.UpdateUserRequest,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))
    
    user, err := c.svc.Update(ctx, id, req.Name)
    if err != nil {
        return dto.UserResponse{}, httperr.NotFound("User not found.")
    }
    
    return user, nil
}

// DELETE /users?id=1
func (c *UserController) DeleteUser(
    ctx context.Context,
    q query.Values,
) error {
    id := int(q.Int("id", 0))
    return c.svc.Delete(ctx, id)
}
```


## Key Takeaways

| Concept | Description |
|------|------|
| **No Annotations** | Pure Go structs and methods |
| **Constructor = Dependency** | Parameters dictate dependencies |
| **Signature = API Spec** | Explicit Input/Output types |
| **Auto Binding** | Automatic parsing of query, JSON body |


## Next Steps

- [Tutorial: Dependency Injection](/en/learn/tutorial/3-dependency-injection) — How DI works
- [Tutorial: Interceptor](/en/learn/tutorial/4-interceptor) — Pre/Post request processing
