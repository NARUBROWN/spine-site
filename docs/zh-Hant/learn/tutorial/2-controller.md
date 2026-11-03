# 控制器

在 CLI 建立的 `my-app` 專案中新增 `GET /user/:id` 控制器，將請求路徑中的整數以 JSON 回應傳回。接著說明如何接收查詢參數、標頭和請求主體，以及各種回應型別。

本頁依功能劃分的 `src/user` 範例使用[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中以 `--layout legacy` 建立的 `my-app`。CLI `v0.4.2` 預設產生依角色劃分的 `layered-v1` 結構。兩種布局都使用 Spine `v0.6.5` 與 Echo 平台 `v0.1.0`。

完成[第一個應用程式](/zh-Hant/learn/tutorial/1-project-structure)的安裝與專案建立後，請在專案根目錄進行操作。如果已執行過 `spine generate resource user`，請略過產生步驟並確認檔案。

## 使用 CLI 產生控制器

```bash
spine generate resource user --dry-run
```

在預覽中確認將產生的檔案與註冊程式碼的變更後，執行下列命令產生檔案。

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

產生的 `src/user/user_controller.go` 會接收路徑中的 `id`，並傳回 `{"id":1}` 格式的回應。由於它與 `UserService` 同屬 `user` 套件，因此不需要另外匯入服務套件。

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
`resource` 會產生包含查詢路由與相依性註冊的基本結構。資料庫、領域模型、資料傳輸物件（DTO），以及新增或修改功能，都需要自行實作。
:::

## 確認產生的路由註冊

CLI 會在 `src/user/user_route.go` 中註冊建構函式與路由，並在 `BuildApplication()` 中加入 `user.Register(app)` 呼叫和錯誤處理。下列程式碼顯示的是已產生的註冊內容，請勿重複新增。

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

保留 `main.go` 中的 `BuildApplication → Validate → Run` 流程。之後實作新的處理器時，請在所屬套件的 `Register` 中新增路由。

## 驗證產生結果並執行

在專案根目錄檢查契約與本機程式碼後，啟動伺服器。

```bash
spine doctor
spine contract check
spine verify
spine dev
```

在另一個終端機呼叫產生的路由。

```bash
curl http://localhost:8080/user/1
```

`GET /user/1` 應傳回 HTTP 200 和 `{"id":1}`。這個回應用於確認路徑繫結與路由執行，並非從資料庫查詢使用者的結果。請分別確認 `spine contract check`、`spine verify` 是否成功，以及實際 HTTP 回應。

## 擴充範例的前提

以下程式碼是彼此獨立的輸入與回應擴充範例，並非用來取代整個產生的應用程式。如果一次貼上多個同名方法，會發生重複宣告錯誤。請選擇一個需要的處理器實作，並將其註冊到路由。

`UserResponse`、請求 DTO、`HeaderInfo`，以及服務的 `Get`、`List`、`Create`、`Login` 等方法，都需要依照各範例自行實作。請將型別放在與對應控制器相同的套件中，並匯入必要的 Go 標準套件與 Spine 套件。下列服務呼叫省略的錯誤處理，請參考[錯誤回應](#error-response)範例實作。

## 處理器簽章

Spine 會根據處理器的參數型別傳入請求值，這稱為輸入繫結。回傳型別則決定建立回應的方式。

### 支援的參數型別

| 型別 | 說明 | 範例 |
|------|------|------|
| `context.Context` | 請求內容 | `ctx context.Context` |
| `query.Values` | 查詢參數 | `q query.Values` |
| `query.Pagination` | 分頁 | `page query.Pagination` |
| `header.Values` | HTTP 標頭 | `headers header.Values` |
| `*struct`（DTO） | JSON 請求主體 | `req *CreateUserRequest` |
| `*struct`（表單 DTO） | 表單的文字欄位 | `form *CreatePostForm` |
| `multipart.UploadedFiles` | 多部分上傳檔案 | `files multipart.UploadedFiles` |
| `path.*` | 路徑參數 | `userId path.Int` |
| `spine.Ctx` | 控制器內容 | `spineCtx spine.Ctx` |

### 支援的回傳型別

| 型別 | 說明 |
|------|------|
| `httpx.Response[T]` | JSON 或字串回應（包含狀態碼、標頭、Cookie） |
| `httpx.Redirect` | 重新導向回應 |
| `error` | 錯誤回應 |
| `httpx.Binary` | 位元組回應 |

也可以使用回應型別的指標，以及 `(支援的回應型別, error)` 組合。`httpx.Binary` 用於指定 `Content-Type` 和位元組主體。


## 接收輸入

### 查詢參數

從 `query.Values` 讀取查詢字串。在下列請求中，`id` 為 `1`、`name` 為 `alice`、`active` 為 `true`。

```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64, 기본값 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, 기본값 false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### query.Values 方法

| 方法 | 回傳型別 | 說明 |
|--------|----------|------|
| `Get(key)` | `string` | 第一個值（不存在時為空字串） |
| `String(key)` | `string` | 字串值 |
| `Int(key, default)` | `int64` | 值不存在或無法轉換為整數時，使用指定的預設值 |
| `GetBoolByKey(key, default)` | `bool` | 值不存在或無法轉換為布林值時，使用指定的預設值 |
| `Has(key)` | `bool` | 索引鍵是否存在 |


### 分頁

`query.Pagination` 會將 `page` 和 `size` 查詢參數轉換為整數。值不存在或無法轉換為整數時，分別使用 `1` 和 `20`。負數與 `0` 也會視為整數處理，因此請在應用程式中驗證允許的範圍。

```go
// GET /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // page.Page = 2 (기본값: 1)
    // page.Size = 10 (기본값: 20)
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

| 方法 | 回傳型別 | 說明 |
|--------|----------|------|
| `Get(key)` | `string` | 標頭值 |
| `Has(key)` | `bool` | 標頭是否存在 |


### 路徑參數

使用 `path.Int`、`path.String`、`path.Boolean` 接收路由路徑中的參數。路徑中宣告的參數順序，對應到處理器中 `path` 型別參數的順序。Go 變數名稱可以與路徑參數名稱不同。

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

#### path 套件的結構體

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


### JSON 請求主體

用來接收 JSON 請求主體的 DTO 必須宣告為結構體指標，並在欄位加上 `json` 標籤。下列範例會將 `Content-Type: application/json` 請求中的 `name` 和 `email` 繫結到 `CreateUserRequest`，再以 HTTP 201 回應。

DTO 只要有任一個 `form` 標籤，就會歸類為表單 DTO。實際的主體解析也會受到請求 `Content-Type` 的影響，因此請讓 JSON 與表單的標籤和請求格式一致。

```go
// POST /user
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← 포인터로 선언
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


### 控制器內容 `spine.Ctx`

攔截器透過 `ctx.Set` 儲存的值，可在控制器中透過 `spine.Ctx.Get` 讀取。控制器只提供讀取功能。下列範例的前提是 `userRole` 索引鍵儲存了字串，因此在實際應用程式中，請確保儲存端與讀取端的型別一致。

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // 인터셉터에서 Set한 값 조회
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```


## 傳回回應


### 1. 使用 httpx.Response[T] 傳回 JSON 與字串回應

將回應主體放入 `httpx.Response[T]` 的 `Body`，並在 `Options` 中設定狀態碼、標頭與 Cookie。省略狀態碼時，會使用 HTTP 200。

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
        Body: user,  // 200 OK (기본값)
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

#### 新增回應標頭

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

#### 設定 Cookie

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

#### httpx.Cookie 結構體

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

#### Cookie 輔助函式

| 函式 | 說明 |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | 建立存取權杖 Cookie |
| `httpx.RefreshTokenCookie(token, ttl)` | 建立更新權杖 Cookie |
| `httpx.DefaultRefreshTokenCookie(token)` | 建立有效期限為 7 天的更新權杖 Cookie |
| `httpx.ClearAccessTokenCookie()` | 刪除存取權杖 Cookie |
| `httpx.ClearRefreshTokenCookie()` | 刪除更新權杖 Cookie |


### 2. 使用 httpx.Redirect 傳回重新導向回應

使用 `httpx.Redirect` 將用戶端重新導向至其他 URL。

#### 基本重新導向（302 Found）

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.service.ProcessOAuthCode(ctx, code)

    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (기본값)
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

#### 重新導向時設定 Cookie

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

#### 登出（刪除 Cookie 後重新導向）

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


### 3. 使用 error 傳回錯誤回應 {#error-response}

使用 `httperr` 傳回錯誤時，會建立包含指定 HTTP 狀態碼與 `message` 欄位的 JSON 回應。下列範例將服務錯誤視為使用者查詢失敗，並傳回 HTTP 404。在實際應用程式中，請區分錯誤原因，再轉換成適當的狀態碼。

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

#### httperr 函式

| 函式 | 狀態碼 |
|------|----------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.NotFound(msg)` | 404 |

上述範例的錯誤回應主體如下。

```json
{
  "message": "유저를 찾을 수 없습니다."
}
```

#### 同時使用 httpx.Response[T] 與 error

若要同時傳回成功回應與錯誤，請使用 `(httpx.Response[T], error)`。失敗時傳回空的回應值與錯誤，成功時則傳回包含主體的回應與 `nil`。有錯誤時，不會使用成功回應的主體。

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


### 選擇回應型別

| 情境 | 建議的回傳型別 |
|------|---------------|
| JSON 回應（包含狀態碼、標頭、Cookie） | `httpx.Response[T]` |
| 字串回應 | `httpx.Response[string]` |
| 重新導向 | `httpx.Redirect` |
| 指定位元組主體與 Content-Type | `httpx.Binary` |
| 只傳回錯誤 | `error` |


## 表單 DTO 與多部分檔案

表單的文字欄位透過結構體指標形式的表單 DTO 接收，上傳檔案則透過 `multipart.UploadedFiles` 接收。在同一處理器的參數中宣告這兩種型別，即可在單一請求中同時處理文字與檔案。

以下範例中的 `PostController` 和 `FileController` 需要自行實作，並註冊建構函式與路由。必須先註冊 `/posts` 和 `/upload`，才能執行下列 `curl` 請求；檔案上傳請求也需要在指定路徑中有實際檔案。

### 1. 接收表單文字欄位

表單 DTO 接收 `multipart/form-data` 或 `application/x-www-form-urlencoded` 請求中的文字欄位。在 DTO 欄位上以 `form` 標籤指定請求欄位名稱。

#### 定義表單 DTO

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### 實作處理器

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

### 2. 接收上傳檔案

上傳檔案不放入 DTO 欄位，而是透過獨立的 `multipart.UploadedFiles` 參數接收。下列範例將檔案的欄位名稱、檔名與大小輸出至日誌。

#### 上傳檔案型別

使用 `github.com/NARUBROWN/spine/pkg/multipart` 套件中的型別。

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### 實作處理器

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

#### UploadedFile 結構體

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

### 3. 同時接收表單、檔案與查詢參數

同一個處理器可以同時接收表單 DTO、上傳檔案與分頁資訊。下列範例會讀取並輸出各個值，但不會儲存檔案。

#### 實作處理器

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

### 區分輸入型別的依據

JSON 與表單 DTO 以結構體指標接收。查詢參數、路徑與上傳檔案則使用 Spine 支援的值型別接收，例如 `query.Pagination`、`path.Int`、`multipart.UploadedFiles`。宣告任意的結構體值並不會自動繫結。


## 處理輸入錯誤時的注意事項

無法將路徑值轉換為整數，或無法解析 JSON 主體時，輸入繫結會在呼叫控制器之前失敗。在 Spine v0.6.5 中，這類失敗不一定會轉換為 HTTP 400。格式錯誤的 JSON 與非整數的路徑值，在預設執行路徑中可能以 HTTP 500 回應，因此請先實作需要的錯誤處理政策，再以實際請求確認。

## 下一步

- [教學：相依性注入](/zh-Hant/learn/tutorial/3-dependency-injection) — 註冊建構函式與解析相依性
- [教學：攔截器](/zh-Hant/learn/tutorial/4-interceptor) — 請求前後的處理
