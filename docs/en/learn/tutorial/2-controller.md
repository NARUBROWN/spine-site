# Controller

Add a user lookup controller to the CLI-generated `hello-spine` project. Follow [First App](/en/learn/getting-started/first-app) for installation and project creation. If you already generated `resource user`, inspect those files instead of generating them again.

## Generate a controller with the CLI

```bash
spine generate resource user --dry-run
```

Review the generated files and registration changes in the preview, then run the command below to generate them.

```bash
spine generate resource user
```

### Generated files

```text
src/user/
├── user_controller.go
├── user_service.go
├── user_repository.go
└── user_route.go
```

The generated `src/user/user_controller.go` contains the following code. It shares `package user` with `UserService`, so there is no separate `service` package import.

```go
package user

import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct { service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) Get(id path.Int) httpx.Response[map[string]any] {
    return httpx.Response[map[string]any]{Body: map[string]any{"id": id.Value}}
}
```

::: info
`resource` generates a lookup skeleton. It does not implement a database, domain models, DTOs, or full CRUD. The input and response snippets below are independent examples of manually extending that skeleton. Implement `UserResponse`, request DTOs, and service methods such as `UserService.Get/List/Create/Login` as needed for each example. Put example types in `package user` under `src/user` and import the required standard and Spine packages. Do not paste multiple alternative methods with the same name together.
:::

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
| `httpx.Binary` | Byte response |

Pointer responses and `(supportedResponse, error)` are also supported. `httpx.Binary` returns bytes with an explicit content type.


## Receiving Input

### Query Parameters

Use `query.Values` to parse the query string.

```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64, default 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, default false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
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
// GET /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // page.Page = 2 (default: 1)
    // page.Size = 10 (default: 20)
    users, _ := c.service.List(ctx, page.Page, page.Size)
    return httpx.Response[[]UserResponse]{Body: users}
}
```


### HTTP Headers

Use `header.Values` to access HTTP headers.

```go
import "github.com/NARUBROWN/spine/pkg/header"

func (c *CommonController) CheckHeader(
    headers header.Values,
) httpx.Response[HeaderInfo] {
    return httpx.Response[HeaderInfo]{
        Body: HeaderInfo{
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

Path parameters bind to `path.Int`, `path.String`, and `path.Boolean` in declaration order.

Use types from the `path` package to bind route path parameters.

```go
// GET /user/:id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
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

DTOs must be pointers. JSON/Form binding depends on DTO `form` tags and the request Content-Type.

Declaring a DTO struct as a pointer automatically binds JSON.

```go
// POST /user
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← Declare as pointer
) httpx.Response[UserResponse] {
    user, _ := c.service.Create(ctx, req.Name, req.Email)
    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201,
        },
    }
}
```

```go
// src/user/user_request.go
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
) httpx.Response[UserResponse] {
    // Retrieve value set in interceptor
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```


## Returning Responses


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
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

    return httpx.Response[UserResponse]{
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
    req *CreateUserRequest,
) httpx.Response[UserResponse] {
    user, _ := c.service.Create(ctx, req.Name, req.Email)

    return httpx.Response[UserResponse]{
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
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

    return httpx.Response[UserResponse]{
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
    req *LoginRequest,
) httpx.Response[LoginResponse] {
    token, refreshToken, _ := c.service.Login(ctx, req.Email, req.Password)

    return httpx.Response[LoginResponse]{
        Body: LoginResponse{Success: true},
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

Built-in response handlers validate all cookie fields before writing any response output. Invalid names, values, domains, paths, `SameSite`, priority, or related combinations return an error instead of being silently rewritten. For arbitrary Unicode, spaces, delimiters, or binary string data, encode explicitly:

```go
encoded := httpx.EncodeCookieValue(rawValue)
decoded, err := httpx.DecodeCookieValue(encoded)
```


### 2. httpx.Redirect — Redirect Response

Use `httpx.Redirect` to redirect the client to another URL.

#### Basic Redirect (302 Found)

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.service.ProcessOAuthCode(ctx, code)

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
    req *LoginRequest,
) httpx.Redirect {
    token, _ := c.service.Login(ctx, req.Email, req.Password)

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
    _, err := c.service.Get(ctx, int(userId.Value))
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

Use `(httpx.Response[T], error)` to return either a success response or an error. Map service errors with `httperr` and return a nil error on success.

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userID path.Int,
) (httpx.Response[UserResponse], error) {
    user, err := c.service.Get(ctx, int(userID.Value))
    if err != nil {
        return httpx.Response[UserResponse]{}, httperr.NotFound("user not found")
    }
    return httpx.Response[UserResponse]{Body: user}, nil
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


## Automatic registration and manual extensions

The CLI creates `src/user/user_route.go` and adds a checked `user.Register(app)` call to `BuildApplication()`. The following explains the generated result; do not add duplicate registrations.

```go
// src/user/user_route.go
package user

import "github.com/NARUBROWN/spine"

func Register(app spine.App) error {
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    app.Route("GET", "/user/:id", (*UserController).Get)
    return nil
}
```

```go
// internal/application/application.go: BuildApplication
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

After implementing another handler, add its route inside `Register` in `user_route.go`. Assemble controllers from other packages in their own registration functions. Keep the generated `BuildApplication → Validate → Run` flow in `main.go`.

## Verify and run

```bash
spine doctor
spine contract check
spine verify
spine dev
```

```bash
curl http://localhost:8080/user/1
```

Check contract/local verification and the actual HTTP response separately. The generated response for `GET /user/1` is `{"id":1}`; this does not perform a real user lookup or persist data.

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
