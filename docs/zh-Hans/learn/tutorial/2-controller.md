# 控制器

在 CLI 生成的 `hello-spine` 项目中添加用户查询控制器。安装和生成项目请先参考[第一个应用](/zh-Hans/learn/getting-started/first-app)。如果已经生成了 `resource user`，请直接查看文件，不要重复生成。

## 使用 CLI 生成控制器

```bash
spine generate resource user --dry-run
```

在预览中检查生成文件与注册代码的变更，然后执行下方命令生成。

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

生成的 `src/user/user_controller.go` 如下。它与 `UserService` 位于同一个 `user` 包中，因此不需要单独导入 `service` 包。

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
`resource` 只生成查询骨架，不实现数据库、领域模型、DTO 或完整 CRUD。下文的输入和响应代码是手动扩展骨架的独立处理函数示例。请按示例需要自行实现 `UserResponse`、请求 DTO，以及 `UserService.Get/List/Create/Login` 等方法。示例类型放在 `src/user` 的 `package user` 中，并导入需要的标准库和 Spine 包。不要同时粘贴多个同名的替代方法。
:::

## 处理程序签名

Spine 分析处理程序的函数签名并自动绑定输入。

### 支持的参数类型

|类型 |描述 |示例|
|------|------|------|
| `context.Context` | `context.Context`请求上下文 | `ctx context.Context` | `ctx context.Context`
| `query.Values` | `query.Values`查询参数| `q query.Values` | `q query.Values`
| `query.Pagination` | `query.Pagination`分页 | `page query.Pagination` | `page query.Pagination`
| `header.Values` | `header.Values` HTTP 标头 | `headers header.Values` | `headers header.Values`
| `*struct` (DTO) | `*struct` (DTO) | JSON 请求正文 | `req *CreateUserRequest` | `req *CreateUserRequest`
| `*struct`（表格）|表格数据| `form *CreatePostForm` | `form *CreatePostForm`
| `multipart.UploadedFiles` | `multipart.UploadedFiles`多部分文件 | `files multipart.UploadedFiles` | `files multipart.UploadedFiles`
| `path.*` | `path.*`路径参数 | `userId path.Int` | `userId path.Int`
| `spine.Ctx` | `spine.Ctx`控制器上下文 | `spineCtx spine.Ctx` | `spineCtx spine.Ctx`

### 支持的返回类型

|类型 |描述 |
|------|------|
| `httpx.Response[T]` | `httpx.Response[T]` JSON 或字符串响应（包括状态代码、标头、cookie）|
| `httpx.Redirect` | `httpx.Redirect`重定向响应 |
| `error` | `error`错误响应 |
| `httpx.Binary` | 字节响应 |

还支持指针响应和 `(支持的响应类型, error)`。`httpx.Binary` 返回字节和明确的 Content-Type。

## 获取输入

### 查询参数

使用 `query.Values` 解析查询字符串。

```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64, 默认值 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, 默认值 false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### query.Values方法

|方法|返回类型 |描述 |
|--------|----------|------|
| `Get(key)` | `Get(key)` `string` | `string`第一个值（如果没有则为空字符串）|
| `String(key)` | `String(key)` `string` | `string`字符串值 |
| `Int(key, default)` | `Int(key, default)` `int64` | `int64`整数值|
| `GetBoolByKey(key, default)` | `GetBoolByKey(key, default)` `bool` | `bool`布尔值 |
| `Has(key)` | `Has(key)` `bool` | `bool`关键存在|

### 分页

使用 `query.Pagination` 自动解析 `page` 和 `size` 查询参数。

```go
// 获取 /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // 页.页 = 2 （默认值：1）
    // 页面大小 = 10（默认值：20）
    users, _ := c.service.List(ctx, page.Page, page.Size)
    return httpx.Response[[]UserResponse]{Body: users}
}
```

### HTTP 标头

使用 `header.Values` 访问 HTTP 标头。

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

#### header.Values方法

|方法|返回类型 |描述 |
|--------|----------|------|
| `Get(key)` | `Get(key)` `string` | `string`标头值 |
| `Has(key)` | `Has(key)` `bool` | `bool`标题存在 |

### 路径参数

路径参数按照声明顺序绑定到 `path.Int`、`path.String` 和 `path.Boolean`。

使用`path`包的类型绑定路由路径的参数。

```go
// 获取/用户/：id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### 路径包结构

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

DTO 必须使用指针。JSON/Form 绑定由 DTO 的 `form` 标签与请求 Content-Type 决定。

如果将 DTO 结构声明为指针，它将自动绑定到 JSON。

```go
// 发布/用户
// 正文：{“姓名”：“Alice”，“电子邮件”：“alice@example.com”}

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

### 控制器上下文 (spine.Ctx)

当引用从控制器中的拦截器注入的值时，使用 `spine.Ctx` 。

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // 检查拦截器中设置的值
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```

## 返回响应


### 1. httpx.Response[T] — JSON/字符串响应

`httpx.Response[T]` 为您提供对状态代码、标头和 cookie 的细粒度控制。

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
        Body: user,  // 200 OK (默认值)
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

#### 添加自定义标头

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

#### Cookie 设置

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

#### httpx.Cookie 结构

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

|功能|描述 |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | `httpx.AccessTokenCookie(token, ttl)`创建访问令牌 Cookie |
| `httpx.RefreshTokenCookie(token, ttl)` | `httpx.RefreshTokenCookie(token, ttl)`创建刷新令牌 Cookie |
| `httpx.DefaultRefreshTokenCookie(token)` | `httpx.DefaultRefreshTokenCookie(token)` 7 天 TTL 刷新令牌 Cookie |
| `httpx.ClearAccessTokenCookie()` | `httpx.ClearAccessTokenCookie()`删除访问令牌 Cookie |
| `httpx.ClearRefreshTokenCookie()` | `httpx.ClearRefreshTokenCookie()`删除刷新令牌 cookie |

### 2. httpx.Redirect — 重定向响应

使用 `httpx.Redirect` 将客户端重定向到不同的 URL。

#### 默认重定向（302 Found）

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.service.ProcessOAuthCode(ctx, code)

    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (默认值)
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

#### 使用重定向设置 cookie

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

#### 注销（删除cookie后重定向）

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

### 3. error — 错误响应

使用 `httperr` 包返回 HTTP 状态代码和消息。

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) error {
    _, err := c.service.Get(ctx, int(userId.Value))
    if err != nil {
        return httperr.NotFound("找不到用户。")
    }
    return nil
}
```

#### httperr 函数

|功能|状态码|
|------|----------|
| `httperr.BadRequest(msg)` | `httperr.BadRequest(msg)` 400 |
| `httperr.Unauthorized(msg)` | `httperr.Unauthorized(msg)` 401 | 401
| `httperr.NotFound(msg)` | `httperr.NotFound(msg)` 404 | 404

错误响应格式：

```json
{
  "message": "找不到用户。"
}
```

#### 与 httpx.Response[T] 和错误一起使用

使用 `(httpx.Response[T], error)` 返回成功响应或错误。使用 `httperr` 映射服务错误，成功时返回 nil 错误。

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


### 选择响应方法指南

|情况|推荐退货类型 |
|------|----------------|
| JSON 响应（带有状态代码/标头/cookie）| `httpx.Response[T]` | `httpx.Response[T]`
|字符串响应 | `httpx.Response[string]` | `httpx.Response[string]`
|重定向 | `httpx.Redirect` | `httpx.Redirect`
|仅返回错误 | `error` | `error`

## 使用表单 DTO 和 Multipart

Spine 支持**Form DTO**、**Multipart** 以及将两者结合使用的**标准模式**。

Spine 的核心原则是：

- DTO 必须作为 `*Struct` （指针）接收
- 值类型 `Struct` 是语义类型。
- 文件上传作为单独的语义类型处理，而不是作为 DTO。
- 解析器只有一个含义

### 1. 表单 DTO 示例（multipart/form-data）

表单 DTO 是用于 **仅绑定 `multipart/form-data` 或 `application/x-www-form-urlencoded` 请求中的文本字段**的 DTO。

#### 表单DTO定义

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### 控制器

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

### 2. 分段文件上传示例

文件上传作为语义类型处理，而不是 **DTO**。

#### 多部分语义类型

使用 `github.com/NARUBROWN/spine/pkg/multipart` 包的类型。

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### 控制器

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

#### 上传文件结构

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

### 3. 结合使用Form DTO + Multipart + Query

#### 控制器

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

### 4. Spine DTO规则总结

```
*Struct  → DTO (JSON / Form)
 Struct  → 语义类型（Query / Path / Multipart）
```

遵循此规则可确保签名中揭示执行流程。

## 自动注册与手动扩展

CLI 生成 `src/user/user_route.go`，并在 `BuildApplication()` 中添加检查错误的 `user.Register(app)` 调用。下面说明生成结果，请勿重复添加注册。

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

实现新处理函数后，在 `user_route.go` 的 `Register` 中添加对应路由。其他包的控制器由各自的注册函数组装。保留 `main.go` 中生成的 `BuildApplication → Validate → Run` 流程。

## 验证与运行

```bash
spine doctor
spine contract check
spine verify
spine dev
```

```bash
curl http://localhost:8080/user/1
```

分别检查契约、本地验证和实际 HTTP 响应。`GET /user/1` 的生成响应为 `{"id":1}`，并不执行真实用户查询或持久化。

## 主要摘要

|概念|描述 |
|------|------|
| **无注释** | Pure Go 结构和方法 |
| **构造函数=依赖** |参数声明依赖关系 |
| **签名 = API 规范** |输入/输出类型是明确的 |
| **自动绑定** |查询、JSON body、header自动解析 |
| **httpx.Response[T]** |控制状态代码、标头和 cookie |
| **httpx.Redirect** |重定向响应 |

## 后续步骤

- [教程：依赖注入](/zh-Hans/learn/tutorial/3-dependency-injection) — DI 的工作原理
- [教程：拦截器](/zh-Hans/learn/tutorial/4-interceptor) — 请求前/请求后处理
