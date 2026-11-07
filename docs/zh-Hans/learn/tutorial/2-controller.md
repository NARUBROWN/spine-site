# 控制器

::: warning Preview
本页包含稳定版 `v0.6.5` 示例。Preview 中的 `app.Route` 已标记为 Deprecated。请参阅[控制器与路由迁移](/zh-Hans/learn/migration/preview-controller-routes)。
:::

::: warning v0.7.0 Preview 输入 API 迁移
本页现有 API 说明和示例以稳定版 `v0.6.5` 为基准。从 `v0.7.0-preview.1` 起，可按输入来源使用独立的 Path、Query 和 Header DTO。`query.Values`、`header.Values` 及其构造和读取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均标记为 Deprecated。

新的 DTO 方式不能直接用于 `v0.6.5`。在 Preview 中，同一处理器混用新 DTO 和 Deprecated 输入也会在启动时被拒绝。现有请求体 DTO 和上下文仍可与任一方式一起使用。

适用版本和迁移示例见 [Preview 处理器输入迁移](/zh-Hans/learn/migration/v0.7.0-preview)，规范选项见 [运行时 OpenAPI](/zh-Hans/reference/api/openapi)。
:::

在使用 CLI 创建的 `my-app` 项目中添加 `GET /user/:id` 控制器，并将请求路径中的整数作为 JSON 响应返回。随后了解如何接收查询参数、请求头和请求体，以及如何选择响应类型。

本页按功能划分的 `src/user` 示例使用[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中通过 `--layout legacy` 创建的 `my-app`。CLI `v0.4.2` 默认生成按角色划分的 `layered-v1` 结构。两种布局都使用 Spine `v0.6.5` 和 Echo 平台 `v0.1.0`。

完成[第一个应用](/zh-Hans/learn/tutorial/1-project-structure)中的安装和项目创建后，请在项目根目录中继续操作。如果已经运行过 `spine generate resource user`，请跳过生成步骤，直接检查文件。

## 使用 CLI 生成控制器

```bash
spine generate resource user --dry-run
```

在预览中确认待生成的文件和注册代码的变更后，运行以下命令生成文件。

```bash
spine generate resource user
```

### 生成的文件

```text
src/user/
├── user_controller.go
├── user_service.go
├── user_repository.go
└── user_route.go
```

生成的 `src/user/user_controller.go` 接收路径中的 `id`，并返回 `{"id":1}` 形式的响应。它与 `UserService` 位于同一个 `user` 包中，无需再导入单独的服务包。

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
`resource` 会生成包含查询路由和依赖注册的基本结构。数据库、领域模型、数据传输对象（DTO）以及创建或修改功能需要自行实现。
:::

## 检查生成的路由注册

CLI 在 `src/user/user_route.go` 中注册构造函数和路由，并在 `BuildApplication()` 中添加 `user.Register(app)` 调用及错误处理。以下代码展示的是已经生成的注册内容，请勿重复添加。

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

保留 `main.go` 中的 `BuildApplication → Validate → Run` 流程。后续实现新的处理器时，请在对应包的 `Register` 中添加路由。

## 验证生成结果并运行

在项目根目录检查契约和本地代码，然后启动服务器。

```bash
spine doctor
spine contract check
spine verify
spine dev
```

在另一个终端中调用生成的路由。

```bash
curl http://localhost:8080/user/1
```

`GET /user/1` 应返回 HTTP 200 和 `{"id":1}`。该响应验证了路径绑定和路由执行，并不代表从数据库中查询到了用户。请分别确认 `spine contract check`、`spine verify` 是否成功，以及实际 HTTP 响应是否符合预期。

## 扩展示例的前提

以下代码是彼此独立的输入和响应扩展示例，并非用于替换整个生成的应用。一次粘贴多个同名方法会导致重复声明错误。请选择需要的一个处理器，实现后将其注册到路由。

`UserResponse`、请求 DTO、`HeaderInfo` 以及服务的 `Get`、`List`、`Create`、`Login` 等方法，需要根据各示例自行实现。请将类型放在与对应控制器相同的包中，并导入所需的 Go 标准库包和 Spine 包。以下服务调用中省略的错误处理，可参考[错误响应](#error-response)示例实现。

## 处理器签名

Spine 根据处理器的参数类型传入请求值，这称为输入绑定。返回类型决定了响应的构建方式。

### 支持的参数类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `context.Context` | 请求上下文 | `ctx context.Context` |
| `query.Values` | 查询参数 | `q query.Values` |
| `query.Pagination` | 分页 | `page query.Pagination` |
| `header.Values` | HTTP 请求头 | `headers header.Values` |
| `*struct`（DTO） | JSON 请求体 | `req *CreateUserRequest` |
| `*struct`（表单 DTO） | 表单文本字段 | `form *CreatePostForm` |
| `multipart.UploadedFiles` | multipart 上传文件 | `files multipart.UploadedFiles` |
| `path.*` | 路径参数 | `userId path.Int` |
| `spine.Ctx` | 控制器上下文 | `spineCtx spine.Ctx` |

### 支持的返回类型

| 类型 | 说明 |
|------|------|
| `httpx.Response[T]` | JSON 或字符串响应（包含状态码、响应头和 Cookie） |
| `httpx.Redirect` | 重定向响应 |
| `error` | 错误响应 |
| `httpx.Binary` | 字节响应 |

也可以使用响应类型的指针，或 `(支持的响应类型, error)` 组合。`httpx.Binary` 用于指定 `Content-Type` 和字节响应体。


## 接收输入

### 查询参数

通过 `query.Values` 读取查询字符串。在以下请求中，`id` 为 `1`，`name` 为 `alice`，`active` 为 `true`。

```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64，默认值 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool，默认值 false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### query.Values 方法

| 方法 | 返回类型 | 说明 |
|--------|----------|------|
| `Get(key)` | `string` | 第一个值（不存在时返回空字符串） |
| `String(key)` | `string` | 字符串值 |
| `Int(key, default)` | `int64` | 值不存在或无法转换为整数时，返回指定的默认值 |
| `GetBoolByKey(key, default)` | `bool` | 值不存在或无法转换为布尔值时，返回指定的默认值 |
| `Has(key)` | `bool` | 键是否存在 |


### 分页

`query.Pagination` 将 `page` 和 `size` 查询参数转换为整数。值不存在或无法转换为整数时，分别使用 `1` 和 `20`。负数和 `0` 也会作为整数处理，请在应用中验证允许的范围。

```go
// GET /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // page.Page = 2（默认值：1）
    // page.Size = 10（默认值：20）
    users, _ := c.service.List(ctx, page.Page, page.Size)
    return httpx.Response[[]UserResponse]{Body: users}
}
```


### HTTP 请求头

使用 `header.Values` 访问 HTTP 请求头。

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

#### header.Values 方法

| 方法 | 返回类型 | 说明 |
|--------|----------|------|
| `Get(key)` | `string` | 请求头的值 |
| `Has(key)` | `bool` | 请求头是否存在 |


### 路径参数

使用 `path.Int`、`path.String`、`path.Boolean` 接收路由路径中的参数。路径中声明的参数顺序与处理器中 `path` 类型参数的顺序相对应。Go 变量名可以与路径参数名不同。

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

#### path 包中的结构体

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


### JSON 请求体

用于接收 JSON 请求体的 DTO 应声明为结构体指针，并为字段添加 `json` 标签。以下示例将 `Content-Type: application/json` 请求中的 `name` 和 `email` 绑定到 `CreateUserRequest`，然后返回 HTTP 201。

只要 DTO 中包含一个 `form` 标签，就会被归类为表单 DTO。实际的请求体解析也受请求 `Content-Type` 的影响，因此请确保 JSON 或表单标签与请求格式一致。

```go
// POST /user
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← 声明为指针
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


### 控制器上下文 `spine.Ctx`

拦截器通过 `ctx.Set` 保存的值，可在控制器中通过 `spine.Ctx.Get` 读取。控制器仅提供读取功能。以下示例假定 `userRole` 键中保存的是字符串；在实际应用中，请确保写入端与读取端使用的类型一致。

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // 读取拦截器通过 Set 保存的值
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```


## 返回响应


### 1. 使用 httpx.Response[T] 返回 JSON 和字符串响应

将响应体放入 `httpx.Response[T]` 的 `Body` 中，并在 `Options` 中设置状态码、响应头和 Cookie。省略状态码时使用 HTTP 200。

```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### 基本 JSON 响应

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

    return httpx.Response[UserResponse]{
        Body: user,  // 200 OK（默认值）
    }
}
```

#### 字符串响应

```go
func (c *UserController) Health() httpx.Response[string] {
    return httpx.Response[string]{
        Body: "OK",
    }
}
```

#### 指定状态码

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

#### 添加响应头

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

#### 设置 Cookie

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

#### httpx.Cookie 结构体

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

#### Cookie 辅助函数

| 函数 | 说明 |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | 创建访问令牌 Cookie |
| `httpx.RefreshTokenCookie(token, ttl)` | 创建刷新令牌 Cookie |
| `httpx.DefaultRefreshTokenCookie(token)` | 创建有效期为 7 天的刷新令牌 Cookie |
| `httpx.ClearAccessTokenCookie()` | 删除访问令牌 Cookie |
| `httpx.ClearRefreshTokenCookie()` | 删除刷新令牌 Cookie |


### 2. 使用 httpx.Redirect 返回重定向响应

使用 `httpx.Redirect` 将客户端重定向到其他 URL。

#### 基本重定向（302 Found）

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.service.ProcessOAuthCode(ctx, code)

    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found（默认值）
    }
}
```

#### 指定状态码

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

#### 重定向时设置 Cookie

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

#### 退出登录（删除 Cookie 后重定向）

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


### 3. 使用 error 返回错误响应 {#error-response}

通过 `httperr` 返回错误时，会生成带有指定 HTTP 状态码和 `message` 字段的 JSON 响应。以下示例将服务错误作为用户查询失败处理，返回 HTTP 404。在实际应用中，请区分错误原因，并转换为适当的状态码。

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

#### httperr 函数

| 函数 | 状态码 |
|------|----------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.NotFound(msg)` | 404 |

上述示例的错误响应体如下。

```json
{
  "message": "유저를 찾을 수 없습니다."
}
```

#### 同时使用 httpx.Response[T] 和 error

要同时返回成功响应和错误，请使用 `(httpx.Response[T], error)`。失败时返回空响应值和错误，成功时返回带有响应体的响应和 `nil`。存在错误时，不会使用成功响应体。

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


### 选择响应类型

| 场景 | 推荐的返回类型 |
|------|---------------|
| JSON 响应（包含状态码、响应头和 Cookie） | `httpx.Response[T]` |
| 字符串响应 | `httpx.Response[string]` |
| 重定向 | `httpx.Redirect` |
| 指定字节响应体和 Content-Type | `httpx.Binary` |
| 仅返回错误 | `error` |


## 表单 DTO 和 multipart 文件

通过结构体指针形式的表单 DTO 接收表单文本字段，通过 `multipart.UploadedFiles` 接收上传文件。将这两种类型声明为同一处理器的参数，就可以在一个请求中同时处理文本和文件。

以下示例中的 `PostController` 和 `FileController` 需要自行实现，并注册构造函数和路由。只有注册 `/posts` 和 `/upload` 后，才能执行以下 `curl` 请求；文件上传请求还要求指定路径中存在实际文件。

### 1. 接收表单文本字段

表单 DTO 接收 `multipart/form-data` 或 `application/x-www-form-urlencoded` 请求中的文本字段。通过 DTO 字段上的 `form` 标签指定请求字段名。

#### 定义表单 DTO

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### 实现处理器

```go
func (c *PostController) Create(
    form *CreatePostForm, // Form DTO
) httpx.Response[string] {
    fmt.Println("Title  :", form.Title)
    fmt.Println("Content:", form.Content)

    return httpx.Response[string]{Body: "OK"}
}
```

#### 请求示例（curl）

```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. 接收上传文件

上传文件不放入 DTO 字段，而是通过独立的 `multipart.UploadedFiles` 参数接收。以下示例将文件的字段名、文件名和大小输出到日志。

#### 上传文件类型

使用 `github.com/NARUBROWN/spine/pkg/multipart` 包中的类型。

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### 实现处理器

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

#### UploadedFile 结构体

```go
type UploadedFile struct {
    FieldName   string
    Filename    string
    ContentType string
    Size        int64
    Open        func() (io.ReadCloser, error)
}
```

#### 请求示例（curl）

```bash
curl -X POST http://localhost:8080/upload \
  -F "file=@test1.png" \
  -F "file=@test2.jpg"
```

### 3. 同时接收表单、文件和查询参数

在同一处理器中可以同时接收表单 DTO、上传文件和分页参数。以下示例读取并输出各项值，不会保存文件。

#### 实现处理器

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

### 区分输入类型的依据

JSON 和表单 DTO 通过结构体指针接收。查询参数、路径参数和上传文件通过 Spine 支持的值类型接收，例如 `query.Pagination`、`path.Int` 和 `multipart.UploadedFiles`。声明任意结构体值并不会使其自动绑定。


## 处理输入错误时的注意事项

Spine `v0.6.5` 配合 Echo 平台 `v0.1.0`，对格式错误的 JSON、数字或布尔路径值转换失败返回 HTTP 400，对不支持的正文 Content-Type 返回 415，对超出正文大小限制返回 413。绑定失败发生在控制器调用之前。请区分绑定失败与业务验证，并通过实际请求确认。

## 后续步骤

- [教程：依赖注入](/zh-Hans/learn/tutorial/3-dependency-injection) — 注册构造函数和解析依赖
- [教程：拦截器](/zh-Hans/learn/tutorial/4-interceptor) — 请求前后处理
