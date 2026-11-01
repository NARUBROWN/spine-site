# 控制器

在 CLI 產生的 `hello-spine` 專案中加入使用者查詢控制器。安裝與產生專案請先參考[第一個應用程式](/zh-Hant/learn/getting-started/first-app)。如果已經產生 `resource user`，請直接查看檔案，不要重複產生。

## 使用 CLI 產生控制器

```bash
spine generate resource user --dry-run
```

在預覽中檢查產生檔案與註冊程式碼的變更，再執行下方命令產生。

```bash
spine generate resource user
```

### 產生的檔案

```text
src/user/
├── user_controller.go
├── user_service.go
├── user_repository.go
└── user_route.go
```

產生的 `src/user/user_controller.go` 如下。它與 `UserService` 位於同一個 `user` 套件中，因此不需要另外匯入 `service` 套件。

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
`resource` 只產生查詢骨架，不實作資料庫、領域模型、DTO 或完整 CRUD。下文的輸入與回應程式碼是手動擴充骨架的獨立處理函式範例。請依範例需要自行實作 `UserResponse`、請求 DTO，以及 `UserService.Get/List/Create/Login` 等方法。範例型別放在 `src/user` 的 `package user` 中，並匯入需要的標準函式庫與 Spine 套件。不要同時貼上多個同名的替代方法。
:::

## 處理程式簽名

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
| `httpx.Response[T]` | `httpx.Response[T]` JSON 或字符串回應（包括狀態代码、标头、cookie）|
| `httpx.Redirect` | `httpx.Redirect`重定向回應 |
| `error` | `error`錯誤回應 |
| `httpx.Binary` | 位元組回應 |

也支援指標回應和 `(支援的回應型別, error)`。`httpx.Binary` 回傳位元組與明確的 Content-Type。

## 取得輸入

### 查詢參數

使用 `query.Values` 解析查詢字串。

```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64, 預設值 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, 預設值 false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
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
// 取得 /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // 頁.頁 = 2 （預設值：1）
    // 頁面大小 = 10（預設值：20）
    users, _ := c.service.List(ctx, page.Page, page.Size)
    return httpx.Response[[]UserResponse]{Body: users}
}
```

### HTTP 標頭

使用 `header.Values` 存取 HTTP 標頭。

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

|方法|傳回類型 |描述 |
|--------|----------|------|
| `Get(key)` | `Get(key)` `string` | `string`標頭值 |
| `Has(key)` | `Has(key)` `bool` | `bool`標題存在 |

### 路徑參數

路徑參數依宣告順序繫結到 `path.Int`、`path.String` 和 `path.Boolean`。

使用`path`套件的類型綁定路由路徑的參數。

```go
// 獲取/用戶/：id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
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

DTO 必須使用指標。JSON/Form 繫結由 DTO 的 `form` 標籤與請求 Content-Type 決定。

如果將 DTO 結構宣告為指針，它將自動綁定到 JSON。

```go
// 發布/用戶
// 正文：{“姓名”：“Alice”，“電子郵件”：“alice@example.com”}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← 宣告為指针
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

當引用從控制器中的攔截器注入的值時，使用 `spine.Ctx` 。

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // 檢查攔截器中設定的值
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```

## 回傳回應


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
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

    return httpx.Response[UserResponse]{
        Body: user,  // 200 OK (預設值)
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

#### 新增自訂標頭

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

#### Cookie 設定

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
    c.service.ProcessOAuthCode(ctx, code)

    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (預設值)
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
    _, err := c.service.Get(ctx, int(userId.Value))
    if err != nil {
        return httperr.NotFound("找不到使用者。")
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

錯誤回應格式：

```json
{
  "message": "找不到使用者。"
}
```

#### 與 httpx.Response[T] 和錯誤一起使用

使用 `(httpx.Response[T], error)` 回傳成功回應或錯誤。使用 `httperr` 對應服務錯誤，成功時回傳 nil 錯誤。

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

#### 請求範例（curl）

```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. Multipart 文件上傳範例

文件上傳是作為語義類型處理，而不是 **DTO**。

#### 多部分語意類型

使用 `github.com/NARUBROWN/spine/pkg/multipart` 套件的類型。

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

### 4. Spine DTO規則總結

```
*Struct  → DTO (JSON / Form)
 Struct  → 語意型別（Query / Path / Multipart）
```

遵循此規則可確保簽章中揭示執行流程。

## 自動註冊與手動擴充

CLI 產生 `src/user/user_route.go`，並在 `BuildApplication()` 中加入檢查錯誤的 `user.Register(app)` 呼叫。下方說明產生結果，請勿重複加入註冊。

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

實作新處理函式後，在 `user_route.go` 的 `Register` 中加入對應路由。其他套件的控制器由各自的註冊函式組裝。保留 `main.go` 中產生的 `BuildApplication → Validate → Run` 流程。

## 驗證與執行

```bash
spine doctor
spine contract check
spine verify
spine dev
```

```bash
curl http://localhost:8080/user/1
```

分別檢查契約、本機驗證與實際 HTTP 回應。`GET /user/1` 的產生回應為 `{"id":1}`，不會執行真實使用者查詢或持久化。

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
