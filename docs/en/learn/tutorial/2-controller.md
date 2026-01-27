# Controller

Writing controllers in Spine.


## What is a Controller?

A controller is a layer that accepts HTTP requests and delegates them to a service.

A Spine controller is a **pure Go struct**. No annotations, decorators, or special interface implementations are required.

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
// Constructor parameter = Dependency declaration
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 3. Write Handler Method

```go
// Function signature is the API spec
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

### 4. Register Route

```go
app.Route("GET", "/users/:id", (*UserController).GetUser)
```


## Handler Signature

Spine analyzes the handler's function signature to automatically bind inputs.

### Supported Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `context.Context` | Request Context | `ctx context.Context` |
| `query.Values` | Query Parameters | `q query.Values` |
| `query.Pagination` | Pagination | `page query.Pagination` |
| `header.Values` | HTTP Headers | `headers header.Values` |
| `*struct` (DTO) | JSON Request Body | `req *CreateUserRequest` |
| `*struct` (Form) | Form Data | `form *CreatePostForm` |
| `multipart.UploadedFiles` | Multipart Files | `files multipart.UploadedFiles` |
| `path.*` | Path Parameters | `userId path.Int` |
| `spine.Ctx` | Controller Context | `spineCtx spine.Ctx` |

### Supported Return Types

| Type | Description |
|------|-------------|
| `httpx.Response[T]` | JSON or String response (including status code, headers, cookies) |
| `httpx.Redirect` | Redirect response |
| `error` | Error response |


## Receiving Input

### Query Parameters

Use `query.Values` to parse the query string.

```go
// GET /users?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[dto.UserResponse] {
    id := q.Int("id", 0)                      // int64, default 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, default false
    
    user, _ := c.svc.Get(ctx, int(id))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

#### query.Values Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `Get(key)` | `string` | First value (empty string if missing) |
| `String(key)` | `string` | String value |
| `Int(key, default)` | `int64` | Integer value |
| `GetBoolByKey(key, default)` | `bool` | Boolean value |
| `Has(key)` | `bool` | Existence check |


### Pagination

Using `query.Pagination` automatically parses `page` and `size` query parameters.

```go
// GET /users?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]dto.UserResponse] {
    // page.Page = 2 (default: 1)
    // page.Size = 10 (default: 20)
    users, _ := c.svc.List(ctx, page.Page, page.Size)
    return httpx.Response[[]dto.UserResponse]{Body: users}
}
```


### HTTP Headers

Use `header.Values` to access HTTP headers.

```go
import "github.com/NARUBROWN/spine/pkg/header"

func (c *CommonController) CheckHeader(
    headers header.Values,
) httpx.Response[dto.HeaderInfo] {
    return httpx.Response[dto.HeaderInfo]{
        Body: dto.HeaderInfo{
            UserAgent:   headers.Get("User-Agent"),
            ContentType: headers.Get("Content-Type"),
        },
    }
}
```

#### header.Values Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `Get(key)` | `string` | Header value |
| `Has(key)` | `bool` | Header existence check |


### Path Parameters

Use types from the `path` package to bind route path parameters.

```go
// GET /users/:id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

#### path Package Structs

```go
package path

type Int struct {
    Value int64
}

type String struct {
    Value string
}

type Boolean struct {
    Value bool
}
```


### JSON Request Body

Declaring a DTO struct as a pointer automatically binds JSON.

```go
// POST /users
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,  // ← Declare as pointer
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201,
        },
    }
}
```

```go
// dto/user_request.go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}
```


### Controller Context (spine.Ctx)

Use `spine.Ctx` when referencing values injected by interceptors.

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[dto.UserResponse] {
    // Retrieve value set in interceptor
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }
    
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```


## Returning Responses

Spine supports three return types: `httpx.Response[T]`, `httpx.Redirect`, and `error`.

### 1. httpx.Response[T] — JSON/String Response

`httpx.Response[T]` allows fine-grained control over status codes, headers, and cookies.

```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### Basic JSON Response

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    
    return httpx.Response[dto.UserResponse]{
        Body: user,  // 200 OK (default)
    }
}
```

#### String Response

```go
func (c *UserController) Health() httpx.Response[string] {
    return httpx.Response[string]{
        Body: "OK",
    }
}
```

#### Specifying Status Code

```go
func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201, // Created
        },
    }
}
```

#### Adding Custom Headers

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Headers: map[string]string{
                "X-Custom-Header": "custom-value",
                "Cache-Control":   "max-age=3600",
            },
        },
    }
}
```

#### Setting Cookies

```go
func (c *AuthController) Login(
    ctx context.Context,
    req *dto.LoginRequest,
) httpx.Response[dto.LoginResponse] {
    token, refreshToken, _ := c.svc.Login(ctx, req.Email, req.Password)
    
    return httpx.Response[dto.LoginResponse]{
        Body: dto.LoginResponse{Success: true},
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
                httpx.RefreshTokenCookie(refreshToken, 7*24*time.Hour),
            },
        },
    }
}
```

#### httpx.Cookie Struct

```go
type Cookie struct {
    Name     string
    Value    string
    Path     string
    Domain   string
    MaxAge   int
    Expires  *time.Time
    HttpOnly bool
    Secure   bool
    SameSite SameSite  // SameSiteLax, SameSiteStrict, SameSiteNone
    Priority string    // "Low" | "Medium" | "High"
}
```

#### Cookie Helper Functions

| Function | Description |
|----------|-------------|
| `httpx.AccessTokenCookie(token, ttl)` | Create Access Token cookie |
| `httpx.RefreshTokenCookie(token, ttl)` | Create Refresh Token cookie |
| `httpx.DefaultRefreshTokenCookie(token)` | 7-day TTL Refresh Token cookie |
| `httpx.ClearAccessTokenCookie()` | Delete Access Token cookie |
| `httpx.ClearRefreshTokenCookie()` | Delete Refresh Token cookie |


### 2. httpx.Redirect — Redirect Response

Use `httpx.Redirect` to redirect the client to another URL.

#### Basic Redirect (302 Found)

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.svc.ProcessOAuthCode(ctx, code)
    
    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (default)
    }
}
```

#### Specifying Status Code

```go
import "net/http"

func (c *UserController) MovedPermanently() httpx.Redirect {
    return httpx.Redirect{
        Location: "/new-location",
        Options: httpx.ResponseOptions{
            Status: http.StatusMovedPermanently, // 301
        },
    }
}
```

#### Redirect with Cookies

```go
func (c *AuthController) Login(
    ctx context.Context,
    req *dto.LoginRequest,
) httpx.Redirect {
    token, _ := c.svc.Login(ctx, req.Email, req.Password)
    
    return httpx.Redirect{
        Location: "/dashboard",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
            },
        },
    }
}
```

#### Logout (Redirect after Deleting Cookies)

```go
func (c *AuthController) Logout() httpx.Redirect {
    return httpx.Redirect{
        Location: "/login",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.ClearAccessTokenCookie(),
                httpx.ClearRefreshTokenCookie(),
            },
        },
    }
}
```


### 3. error — Error Response

Use `httperr` package to return HTTP status codes and messages.

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) error {
    _, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httperr.NotFound("User not found.")
    }
    return nil
}
```

#### httperr Functions

| Function | Status Code |
|----------|-------------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.NotFound(msg)` | 404 |

Error Response Format:
```json
{
  "message": "User not found."
}
```

#### Using httpx.Response[T] with error

If error handling is needed, you can handle it via status code within `httpx.Response[T]` or create a separate error handler method.

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{
                Status: 404,
            },
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
}
```


### Response Method Selection Guide

| Situation | Recommended Return Type |
|-----------|-------------------------|
| JSON response (incl. status code/header/cookie) | `httpx.Response[T]` |
| String response | `httpx.Response[string]` |
| Redirect | `httpx.Redirect` |
| Return only error | `error` |


## Form DTO and Multipart Usage

Spine supports **Form DTO**, **Multipart**, and the **standard pattern** of using them together.

Spine's core principles are:

- DTO must be received as `*Struct` (Pointer)
- Value type `Struct` is a Semantic Type
- File upload is handled by a separate Semantic Type, not DTO
- Resolver handles only one meaning

### 1. Form DTO Example (multipart/form-data)

Form DTO is a DTO for **binding text fields only** in `multipart/form-data` or `application/x-www-form-urlencoded` requests.

#### Form DTO Definition

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### Controller

```go
func (c *PostController) Create(
    form *CreatePostForm, // Form DTO
) httpx.Response[string] {
    fmt.Println("Title  :", form.Title)
    fmt.Println("Content:", form.Content)

    return httpx.Response[string]{Body: "OK"}
}
```

#### Request Example (curl)

```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. Multipart File Upload Example

File uploads are handled by **Semantic Types**, not DTOs.

#### Multipart Semantic Type

Use types from `github.com/NARUBROWN/spine/pkg/multipart` package.

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### Controller

```go
func (c *FileController) Upload(
    files multipart.UploadedFiles, // Multipart files
) httpx.Response[string] {
    fmt.Println("Files count:", len(files.Files))

    for _, f := range files.Files {
        fmt.Println(
            "field:", f.FieldName,
            "name:", f.Filename,
            "size:", f.Size,
        )
    }

    return httpx.Response[string]{Body: "OK"}
}
```

#### UploadedFile Struct

```go
type UploadedFile struct {
    FieldName   string
    Filename    string
    ContentType string
    Size        int64
    Open        func() (io.ReadCloser, error)
}
```

#### Request Example (curl)

```bash
curl -X POST http://localhost:8080/upload \
  -F "file=@test1.png" \
  -F "file=@test2.jpg"
```

### 3. Using Form DTO + Multipart + Query Together

#### Controller

```go
func (c *PostController) Upload(
    ctx context.Context,
    form  *CreatePostForm,           // form fields
    files multipart.UploadedFiles,   // multipart files
    page  query.Pagination,          // query
) httpx.Response[string] {
    fmt.Println("[FORM] Title  :", form.Title)
    fmt.Println("[FORM] Content:", form.Content)

    fmt.Println("[QUERY] Page:", page.Page)
    fmt.Println("[QUERY] Size:", page.Size)

    fmt.Println("[FILES] Count:", len(files.Files))

    return httpx.Response[string]{Body: "OK"}
}
```

### 4. Spine DTO Rules Summary

```
*Struct  → DTO (JSON / Form)
 Struct  → Semantic Type (Query / Path / Multipart)
```

By following these rules, the execution flow is revealed directly in the signature.


## Registering Routes

Connect controller methods to routes.

```go
// routes/user_routes.go
package routes

import (
    "my-app/controller"
    "github.com/NARUBROWN/spine"
)

func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).ListUsers)
    app.Route("GET", "/users/:id", (*controller.UserController).GetUser)
    app.Route("POST", "/users", (*controller.UserController).CreateUser)
    app.Route("PUT", "/users/:id", (*controller.UserController).UpdateUser)
    app.Route("DELETE", "/users/:id", (*controller.UserController).DeleteUser)
}
```

```go
// main.go
func main() {
    app := spine.New()
    app.Constructor(/* ... */)
    routes.RegisterUserRoutes(app)
    app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
    })
}
```


## Complete Example

```go
// controller/user_controller.go
package controller

import (
    "context"
    "net/http"
    "time"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GET /users?page=1&size=20
func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]dto.UserResponse] {
    users, _ := c.svc.List(ctx, page.Page, page.Size)
    
    return httpx.Response[[]dto.UserResponse]{
        Body: users,
        Options: httpx.ResponseOptions{
            Headers: map[string]string{
                "X-Total-Count": "100",
            },
        },
    }
}

// GET /users/:id
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
}

// POST /users
func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: http.StatusCreated, // 201
        },
    }
}

// PUT /users/:id
func (c *UserController) UpdateUser(
    ctx context.Context,
    userId path.Int,
    req *dto.UpdateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Update(ctx, int(userId.Value), req.Name)
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
}

// DELETE /users/:id
func (c *UserController) DeleteUser(
    ctx context.Context,
    userId path.Int,
) error {
    return c.svc.Delete(ctx, int(userId.Value))
}
```

```go
// controller/auth_controller.go
package controller

import (
    "context"
    "time"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type AuthController struct {
    svc *service.AuthService
}

func NewAuthController(svc *service.AuthService) *AuthController {
    return &AuthController{svc: svc}
}

// POST /auth/login
func (c *AuthController) Login(
    ctx context.Context,
    req *dto.LoginRequest,
) httpx.Redirect {
    token, _ := c.svc.Login(ctx, req.Email, req.Password)
    
    return httpx.Redirect{
        Location: "/dashboard",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
            },
        },
    }
}

// POST /auth/logout
func (c *AuthController) Logout() httpx.Redirect {
    return httpx.Redirect{
        Location: "/login",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.ClearAccessTokenCookie(),
                httpx.ClearRefreshTokenCookie(),
            },
        },
    }
}
```


## Key Takeaways

| Concept | Description |
|---------|-------------|
| **No Annotations** | Pure Go structs and methods |
| **Constructor = Dependency** | Parameters are dependency declarations |
| **Signature = API Spec** | Input/Output types are explicit |
| **Auto Binding** | Automtically parses query, JSON body, headers |
| **httpx.Response[T]** | Control status code, headers, cookies |
| **httpx.Redirect** | Redirect response |


## Next Steps

- [Tutorial: Dependency Injection](/en/learn/tutorial/3-dependency-injection) — DI Principles
- [Tutorial: Interceptor](/en/learn/tutorial/4-interceptor) — Pre/Post Request Processing
