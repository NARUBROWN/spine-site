# Controllers

::: warning Preview
This page includes stable `v0.6.5` examples. `app.Route` is Deprecated in Preview. See [controller and route migration](/en/learn/migration/preview-controller-routes).
:::

::: warning v0.7.0 Preview input API migration
The existing API descriptions and examples on this page target stable `v0.6.5`. From `v0.7.0-preview.1`, source-specific Path, Query, and Header DTOs are supported. `query.Values`, `header.Values` and their construction and lookup APIs, `query.Pagination`, `path.Int`, `path.String`, and `path.Boolean` are Deprecated.

The new DTO approach cannot be applied unchanged to `v0.6.5`. In Preview, mixing new DTOs with Deprecated inputs in one handler fails during boot. Existing body DTOs and contexts can still be used alongside either approach.

See [Preview handler input migration](/en/learn/migration/v0.7.0-preview) for versions and migration examples, and [Runtime OpenAPI](/en/reference/api/openapi) for specification options.
:::

Add a `GET /user/:id` controller to the CLI-generated `my-app` project and return the integer from the request path in a JSON response. Then explore how to accept queries, headers, and request bodies, and how to choose response types.

The feature-based `src/user` examples on this page use the `my-app` project created with `--layout legacy` in [Project Structure](/en/learn/tutorial/1-project-structure). CLI `v0.4.2` defaults to the role-based `layered-v1` layout. Both layouts use Spine `v0.6.5` and Echo platform `v0.1.0`.

Complete the installation and project creation steps in [Your first app](/en/learn/tutorial/1-project-structure), then work from the project root. If you have already run `spine generate resource user`, skip generation and check the files.

## Generate a controller with the CLI

```bash
spine generate resource user --dry-run
```

Review the files to be generated and the registration code changes in the preview, then generate them with the following command.

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

The generated `src/user/user_controller.go` accepts the `id` from the path and returns a response such as `{"id":1}`. It belongs to the same `user` package as `UserService`, so you do not need to import a separate service package.

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
`resource` generates a basic structure with a read route and dependency registration. You must implement the database, domain models, data transfer objects (DTOs), and create or update operations yourself.
:::

## Check the generated route registration

The CLI registers constructors and routes in `src/user/user_route.go`. It adds a `user.Register(app)` call and error handling to `BuildApplication()`. The following code shows the registration that has already been generated; do not add it again.

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

Keep the `BuildApplication → Validate → Run` flow in `main.go`. When you implement new handlers, add their routes inside the package's `Register` function.

## Verify and run the generated code

Check the contract and local code from the project root, then start the server.

```bash
spine doctor
spine contract check
spine verify
spine dev
```

Call the generated route from another terminal.

```bash
curl http://localhost:8080/user/1
```

`GET /user/1` should return HTTP 200 and `{"id":1}`. This response confirms path binding and route execution; it does not represent a user retrieved from a database. Check the results of `spine contract check` and `spine verify` separately from the actual HTTP response.

## Prerequisites for the extension examples

The examples below independently extend inputs and responses. They do not replace the entire generated app. Pasting multiple methods with the same name at once causes duplicate declaration errors. Choose one handler you need, implement it, and register its route.

You must implement `UserResponse`, request DTOs, `HeaderInfo`, and service methods such as `Get`, `List`, `Create`, and `Login` for each example. Place the types in the same package as the controller, and import the required Go standard library and Spine packages. For error handling omitted from the service calls below, follow the [error response](#error-response) examples.

## Handler signatures

Spine passes request values according to the handler's parameter types. This is called input binding. The return type determines how the response is created.

### Supported parameter types

| Type | Description | Example |
|------|------|------|
| `context.Context` | Request context | `ctx context.Context` |
| `query.Values` | Query parameters | `q query.Values` |
| `query.Pagination` | Pagination | `page query.Pagination` |
| `header.Values` | HTTP headers | `headers header.Values` |
| `*struct` (DTO) | JSON request body | `req *CreateUserRequest` |
| `*struct` (form DTO) | Text fields in a form | `form *CreatePostForm` |
| `multipart.UploadedFiles` | Multipart uploaded files | `files multipart.UploadedFiles` |
| `path.*` | Path parameters | `userId path.Int` |
| `spine.Ctx` | Controller context | `spineCtx spine.Ctx` |

### Supported return types

| Type | Description |
|------|------|
| `httpx.Response[T]` | JSON or string response, including status code, headers, and cookies |
| `httpx.Redirect` | Redirect response |
| `error` | Error response |
| `httpx.Binary` | Byte response |

You can also use pointers to response types and `(supported response type, error)` combinations. Use `httpx.Binary` to specify a `Content-Type` and a byte body.


## Accept inputs

### Query parameters

Read query strings with `query.Values`. In the request below, `id` is `1`, `name` is `alice`, and `active` is `true`.

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

#### query.Values methods

| Method | Return type | Description |
|--------|----------|------|
| `Get(key)` | `string` | First value, or an empty string if absent |
| `String(key)` | `string` | String value |
| `Int(key, default)` | `int64` | Specified default if the value is absent or cannot be converted to an integer |
| `GetBoolByKey(key, default)` | `bool` | Specified default if the value is absent or cannot be converted to a boolean |
| `Has(key)` | `bool` | Whether the key exists |


### Pagination

`query.Pagination` converts the `page` and `size` query parameters to integers. If a value is absent or cannot be converted to an integer, it uses `1` and `20`, respectively. Negative values and `0` are also treated as integers, so validate the allowed range in your app.

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


### HTTP headers

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

#### header.Values methods

| Method | Return type | Description |
|--------|----------|------|
| `Get(key)` | `string` | Header value |
| `Has(key)` | `bool` | Whether the header exists |


### Path parameters

Accept route path parameters with `path.Int`, `path.String`, and `path.Boolean`. The order of parameters declared in the path corresponds to the order of `path`-typed parameters in the handler. Go variable names can differ from the path parameter names.

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

#### path package structs

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


### JSON request bodies

Declare a DTO for a JSON request body as a struct pointer, and add `json` tags to its fields. The example below binds `name` and `email` from a request with `Content-Type: application/json` to `CreateUserRequest`, then responds with HTTP 201.

A DTO with even one `form` tag is classified as a form DTO. The request's `Content-Type` also affects body parsing, so match the JSON or form tags to the request format.

```go
// POST /user
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← Declare as a pointer
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


### Controller context: `spine.Ctx`

In a controller, use `spine.Ctx.Get` to read values an interceptor stored with `ctx.Set`. Controllers have read access only. The example below assumes a string was stored under the `userRole` key. In your app, make sure the writer and reader use matching types.

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // Read the value set by the interceptor
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```


## Return responses


### 1. Return JSON and string responses with httpx.Response[T]

Put the response body in `Body` of `httpx.Response[T]`, and set the status code, headers, and cookies in `Options`. If you omit the status code, HTTP 200 is used.

```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### Basic JSON response

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

#### String response

```go
func (c *UserController) Health() httpx.Response[string] {
    return httpx.Response[string]{
        Body: "OK",
    }
}
```

#### Specify the status code

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

#### Add response headers

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

#### Set cookies

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

#### httpx.Cookie struct

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

#### Cookie helper functions

| Function | Description |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | Create an access token cookie |
| `httpx.RefreshTokenCookie(token, ttl)` | Create a refresh token cookie |
| `httpx.DefaultRefreshTokenCookie(token)` | Create a refresh token cookie that expires in 7 days |
| `httpx.ClearAccessTokenCookie()` | Delete the access token cookie |
| `httpx.ClearRefreshTokenCookie()` | Delete the refresh token cookie |


### 2. Return redirect responses with httpx.Redirect

Use `httpx.Redirect` to redirect the client to another URL.

#### Basic redirect (302 Found)

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

#### Specify the status code

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

#### Set cookies with a redirect

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

#### Log out (delete cookies, then redirect)

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


### 3. Return error responses with error {#error-response}

Returning an error with `httperr` creates a JSON response with the specified HTTP status code and a `message` field. The example below treats a service error as a failed user lookup and returns HTTP 404. In your app, distinguish the causes of errors and map them to appropriate status codes.

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) error {
    _, err := c.service.Get(ctx, int(userId.Value))
    if err != nil {
        return httperr.NotFound("유저를 찾을 수 없습니다.")
    }
    return nil
}
```

#### httperr functions

| Function | Status code |
|------|----------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.NotFound(msg)` | 404 |

The error response body for the example above is:

```json
{
  "message": "유저를 찾을 수 없습니다."
}
```

#### Use httpx.Response[T] with error

Use `(httpx.Response[T], error)` to return both a success response and an error. On failure, return an empty response value and the error. On success, return a response with a body and `nil`. If an error is present, the success response body is not used.

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


### Choose a response type

| Situation | Recommended return type |
|------|---------------|
| JSON response with status code, headers, and cookies | `httpx.Response[T]` |
| String response | `httpx.Response[string]` |
| Redirect | `httpx.Redirect` |
| Specify a byte body and Content-Type | `httpx.Binary` |
| Return only an error | `error` |


## Form DTOs and multipart files

Accept form text fields with a form DTO declared as a struct pointer, and uploaded files with `multipart.UploadedFiles`. Declare both types as parameters of the same handler to process text and files in one request.

You must implement the `PostController` and `FileController` in the examples below and register their constructors and routes. The `/posts` and `/upload` routes must be registered before you can run the `curl` requests below. For upload requests, actual files must exist at the specified paths.

### 1. Accept form text fields

A form DTO accepts text fields from `multipart/form-data` or `application/x-www-form-urlencoded` requests. Use `form` tags on DTO fields to specify the request field names.

#### Define the form DTO

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### Implement the handler

```go
func (c *PostController) Create(
    form *CreatePostForm, // Form DTO
) httpx.Response[string] {
    fmt.Println("Title  :", form.Title)
    fmt.Println("Content:", form.Content)

    return httpx.Response[string]{Body: "OK"}
}
```

#### Example request (curl)

```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. Accept uploaded files

Accept uploaded files in a separate `multipart.UploadedFiles` parameter rather than DTO fields. The example below logs each file's field name, file name, and size.

#### Uploaded file type

Use the types from the `github.com/NARUBROWN/spine/pkg/multipart` package.

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### Implement the handler

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

#### UploadedFile struct

```go
type UploadedFile struct {
    FieldName   string
    Filename    string
    ContentType string
    Size        int64
    Open        func() (io.ReadCloser, error)
}
```

#### Example request (curl)

```bash
curl -X POST http://localhost:8080/upload \
  -F "file=@test1.png" \
  -F "file=@test2.jpg"
```

### 3. Accept forms, files, and queries together

A single handler can accept a form DTO, uploaded files, and pagination together. The example below reads and prints each value; it does not save the files.

#### Implement the handler

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

### How input types are distinguished

Accept JSON and form DTOs as struct pointers. Accept queries, paths, and uploaded files as Spine-supported value types such as `query.Pagination`, `path.Int`, and `multipart.UploadedFiles`. Declaring an arbitrary struct value does not make it bind automatically.


## Input error handling considerations

Spine `v0.6.5` with Echo platform `v0.1.0` returns HTTP 400 for malformed JSON and invalid numeric or boolean path values, 415 for unsupported body Content-Type, and 413 when the request-body limit is exceeded. Binding fails before the controller runs. Distinguish these failures from business validation and verify them with actual requests.

## Next steps

- [Tutorial: Dependency injection](/en/learn/tutorial/3-dependency-injection) — Register constructors and resolve dependencies
- [Tutorial: Interceptors](/en/learn/tutorial/4-interceptor) — Process requests before and after handlers
