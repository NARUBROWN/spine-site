＃ 控制器

在 Spine 中編寫控制器。

## 什麼是控制器？

控制器是一個接收 HTTP 請求並將其委託給服務的層。

Spine 的控制器是**純 Go 結構**。不需要註解、裝飾器或特殊的介面實作。

```go
// 就是這個
type UserController struct {
    svc *service.UserService
}
```

## 基本結構

### 1.結構體定義

```go
package controller

type UserController struct {
    svc *service.UserService  // 依赖
}
```

### 2. 寫一個建構函數

```go
// 建構函數參數 = 依賴聲明
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 3.寫處理方法

```go
// 函數簽名是API規範
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

### 4. 路線註冊

```go
app.Route("GET", "/users/:id", (*UserController).GetUser)
```

## 處理程序簽名

Spine 會分析處理器的函式簽章並自動繫結輸入。

### 支援的參數類型

|類型 |描述 |範例|
|------|------|------|
| `context.Context` | `context.Context`請求上下文 | `ctx context.Context` | `ctx context.Context`
| `query.Values` | `query.Values`查詢參數| `q query.Values` | `q query.Values`
| `query.Pagination` | `query.Pagination`分頁 | `page query.Pagination` | `page query.Pagination`
| `header.Values` | `header.Values` HTTP 標頭 | `headers header.Values` | `headers header.Values`
| `*struct` (DTO) | `*struct` (DTO) | JSON 請求正文 | `req *CreateUserRequest` | `req *CreateUserRequest`
| `*struct`（表格）|表格資料| `form *CreatePostForm` | `form *CreatePostForm`
| `multipart.UploadedFiles` | `multipart.UploadedFiles`多重部份檔案 | `files multipart.UploadedFiles` | `files multipart.UploadedFiles`
| `path.*` | `path.*`路徑參數 | `userId path.Int` | `userId path.Int`
| `spine.Ctx` | `spine.Ctx`控制器上下文 | `spineCtx spine.Ctx` | `spineCtx spine.Ctx`

### 支援的回傳類型

|類型 |描述 |
|------|------|
| `httpx.Response[T]` | `httpx.Response[T]` JSON 或字符串响应（包括状态代码、标头、cookie）|
| `httpx.Redirect` | `httpx.Redirect`重定向响应 |
| `error` | `error`错误响应 |

## 取得輸入

### 查詢參數

使用 `query.Values` 解析查詢字串。

```go
// GET /users?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[dto.UserResponse] {
    id := q.Int("id", 0)                      // int64, 默认值 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, 默认值 false
    
    user, _ := c.svc.Get(ctx, int(id))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

#### query.Values方法

|方法|傳回類型 |描述 |
|--------|----------|------|
| `Get(key)` | `Get(key)` `string` | `string`第一個值（若沒有則為空字串）|
| `String(key)` | `String(key)` `string` | `string`字串值 |
| `Int(key, default)` | `Int(key, default)` `int64` | `int64`整數值|
| `GetBoolByKey(key, default)` | `GetBoolByKey(key, default)` `bool` | `bool`布林值 |
| `Has(key)` | `Has(key)` `bool` | `bool`關鍵存在|

### 分頁

使用 `query.Pagination` 可自動解析 `page` 與 `size` 查詢參數。

```go
// 取得 /users?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]dto.UserResponse] {
    // 頁.頁 = 2 （預設值：1）
    // 頁面大小 = 10（預設值：20）
    users, _ := c.svc.List(ctx, page.Page, page.Size)
    return httpx.Response[[]dto.UserResponse]{Body: users}
}
```

### HTTP 標頭

使用 `header.Values` 存取 HTTP 標頭。

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

#### header.Values 方法

|方法|傳回類型 |描述 |
|--------|----------|------|
| `Get(key)` | `Get(key)` `string` | `string`標頭值 |
| `Has(key)` | `Has(key)` `bool` | `bool`標題存在 |

### 路徑參數

使用`path`套件的類型綁定路由路徑的參數。

```go
// 獲取/用戶/：id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

#### path 套件結構

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

### JSON 請求體

如果將 DTO 結構宣告為指針，它將自動綁定到 JSON。

```go
// 發布/用戶
// 正文：{“姓名”：“Alice”，“電子郵件”：“alice@example.com”}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,  // ← 声明为指针
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

### 控制器上下文 (spine.Ctx)

當引用從控制器中的攔截器注入的值時，使用 `spine.Ctx` 。

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[dto.UserResponse] {
    // 檢查攔截器中設定的值
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }
    
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

## 回傳回應

Spine 支援三種回傳類型：`httpx.Response[T]`、`httpx.Redirect` 和 `error`。

### 1. httpx.Response[T] — JSON/字串回應

`httpx.Response[T]` 為您提供對狀態代碼、標頭和 cookie 的細粒度控制。

```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### 基本 JSON 回應

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    
    return httpx.Response[dto.UserResponse]{
        Body: user,  // 200 OK (默认值)
    }
}
```

#### 字串回應

```go
func (c *UserController) Health() httpx.Response[string] {
    return httpx.Response[string]{
        Body: "OK",
    }
}
```

#### 指定狀態碼

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

#### 新增自訂標頭

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

#### Cookie 設定

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

#### httpx.Cookie 結構

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

#### Cookie 輔助函數

|功能|描述 |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | `httpx.AccessTokenCookie(token, ttl)`建立存取令牌 Cookie |
| `httpx.RefreshTokenCookie(token, ttl)` | `httpx.RefreshTokenCookie(token, ttl)`建立刷新令牌 Cookie |
| `httpx.DefaultRefreshTokenCookie(token)` | `httpx.DefaultRefreshTokenCookie(token)` 7 天 TTL 刷新令牌 Cookie |
| `httpx.ClearAccessTokenCookie()` | `httpx.ClearAccessTokenCookie()`刪除存取令牌 Cookie |
| `httpx.ClearRefreshTokenCookie()` | `httpx.ClearRefreshTokenCookie()`刪除刷新令牌 cookie |

### 2. httpx.Redirect — 重定向回應

使用 `httpx.Redirect` 將用戶端重新導向到不同的 URL。

#### 預設重定向（302 Found）

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.svc.ProcessOAuthCode(ctx, code)
    
    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (默认值)
    }
}
```

#### 指定狀態碼

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

#### 使用重定向設定 cookie

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

#### 登出（刪除cookie後重定向）

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

### 3. error — 錯誤回應

使用 `httperr` 套件傳回 HTTP 狀態碼和訊息。

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) error {
    _, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httperr.NotFound("找不到用户。")
    }
    return nil
}
```

#### httperr 函數

|功能|狀態碼|
|------|----------|
| `httperr.BadRequest(msg)` | `httperr.BadRequest(msg)` 400 |
| `httperr.Unauthorized(msg)` | `httperr.Unauthorized(msg)` 401 | 401
| `httperr.NotFound(msg)` | `httperr.NotFound(msg)` 404 | 404

錯誤回應格式：```json
{
  "message": "找不到使用者。"
}
```

#### 與 httpx.Response[T] 和錯誤一起使用

如果需要錯誤處理，您可以將其作為 `httpx.Response[T]` 中的狀態代碼進行處理，或建立單獨的錯誤處理程序方法。

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

### 選擇回應方法指南

|情況|推薦退貨類型 |
|------|----------------|
| JSON 回應（有狀態代碼/標頭/cookie）| `httpx.Response[T]` | `httpx.Response[T]`
|字串回應 | `httpx.Response[string]` | `httpx.Response[string]`
|重定向 | `httpx.Redirect` | `httpx.Redirect`
|只回傳錯誤 | `error` | `error`

## 使用表單 DTO 和 Multipart

Spine 支援**Form DTO**、**Multipart** 以及將兩者結合使用的**標準模式**。

Spine 的核心原則是：

- DTO 必須以 `*Struct` （指標）接收
- 值類型 `Struct` 是語意類型。
- 文件上傳是作為單獨的語意類型處理，而不是作為 DTO。
- 解析器只有一個意義

### 1. 表單 DTO 範例（multipart/form-data）

表單 DTO 是用於 **僅綁定 `multipart/form-data` 或 `application/x-www-form-urlencoded` 請求中的文字欄位**的 DTO。

#### 表單DTO定義

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

＃＃＃＃ 控制器

```go
func (c *PostController) Create(
    form *CreatePostForm, // Form DTO
) httpx.Response[string] {
    fmt.Println("Title  :", form.Title)
    fmt.Println("Content:", form.Content)

    return httpx.Response[string]{Body: "OK"}
}
```

#### 請求範例（curl）

```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. Multipart 文件上传示例

文件上傳是作為語義類型處理，而不是 **DTO**。

#### 多部分語意類型

使用 `github.com/NARUBROWN/spine/pkg/multipart` 套件的類型。

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

＃＃＃＃ 控制器

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

#### 上傳檔案結構

```go
type UploadedFile struct {
    FieldName   string
    Filename    string
    ContentType string
    Size        int64
    Open        func() (io.ReadCloser, error)
}
```

#### 請求範例（curl）

```bash
curl -X POST http://localhost:8080/upload \
  -F "file=@test1.png" \
  -F "file=@test2.jpg"
```

### 3. 結合使用Form DTO + Multipart + Query

＃＃＃＃ 控制器

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

### 4. Spine DTO規則總結

```
*Struct  → DTO (JSON / Form)
 Struct  → 語意型別（Query / Path / Multipart）
```

遵循此規則可確保簽章中揭示執行流程。

## 註冊路線

將控制器方法附加到路由。

```go
// 路線/user_routes.go
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
// 主機程式
func main() {
    app := spine.New()
    app.Constructor(/* ... */)
    routes.RegisterUserRoutes(app)
    app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    })
}
```

## 完整範例

```go
// 控制器/user_controller.go
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

// 取得 /users?page=1&size=20
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

// 取得/用戶/:id
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

// 發布/用戶
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

// PUT /使用者/：id
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

// 刪除/使用者/：id
func (c *UserController) DeleteUser(
    ctx context.Context,
    userId path.Int,
) error {
    return c.svc.Delete(ctx, int(userId.Value))
}
```

```go
// 控制器/auth_controller.go
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

// POST /驗證/登入
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

// POST /驗證/註銷
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

## 主要摘要

|概念|描述 |
|------|------|
| **無註解** | Pure Go 結構與方法 |
| **建構子=依賴** |參數宣告依賴關係 |
| **簽名 = API 規格** |輸入/輸出類型是明確的 |
| **自動綁定** |查詢、JSON body、header自動解析 |
| **httpx.Response[T]** |狀態碼、標頭、cookie 控制 |
| **httpx.Redirect** |重定向回應 |

## 後續步驟

- [教學：依賴注入](/zh-Hant/learn/tutorial/3-dependency-injection) — DI 的工作原理
- [教學：攔截器](/zh-Hant/learn/tutorial/4-interceptor) — 請求前/請求後處理
