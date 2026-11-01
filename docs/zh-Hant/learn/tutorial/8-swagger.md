# Swagger 與 OpenAPI 文件

使用[第一個應用程式](/zh-Hant/learn/getting-started/first-app)中 CLI 產生的專案。依[控制器](/zh-Hant/learn/tutorial/2-controller)的 `spine generate resource user` 產生 `src/user`。CLI 靜態 OpenAPI 匯出和 Swaggo、Swagger UI 整合是獨立功能。

## 使用 CLI 匯出 OpenAPI

CLI 根據已註冊的路由和處理函式簽章產生 OpenAPI 3.1，不需要 Swaggo 註解。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

輸出包含 `/health`、`/user/{id}` 和 `x-spine-*` 分析依據。Spine 的 `/user/:id` 在 OpenAPI 中表示為 `/user/{id}`。執行時選擇的狀態碼等會標為靜態分析邊界。匯出不會安裝 Swagger UI 或註冊 HTTP 端點。只有檢查現有檔案並確認取代時才使用 `--force`。

## 選用：Swaggo 與 Swagger UI

以下使用 Swaggo 產生獨立的 Swagger 2.0 文件，並手動將 UI 掛載到 Echo transport。CLI 不會自動設定此整合。CLI 的 `openapi.json` 與 Swaggo 的 `docs/swagger.json` 是不同產物。

### 1. 安裝工具

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. 加入一般註解

在 `internal/application/application.go` 的 `BuildApplication()` 前加入註解。保留產生的 main 和 `spine.toml` 中的 `composition = "./internal/application"`。

```go
// @title Hello Spine API
// @version 1.0.0
// @description Spine HTTP API
// @host localhost:8080
// @BasePath /
func BuildApplication() (spine.App, boot.Options, error) {
    // ...
}
```

### 3. 為實際查詢處理函式加入文件

手動擴充產生的 `src/user/user_controller.go`，如下所示。`UserIDResponse` 是新增的文件型別，回應 JSON 仍為 `{"id":1}`。此範例不實作資料庫查詢或完整 CRUD。

```go
package user

import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct{ service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

type UserIDResponse struct {
    ID int64 `json:"id" example:"1"`
}

// Get godoc
// @Summary Get user ID
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} UserIDResponse
// @Router /user/{id} [get]
func (c *UserController) Get(id path.Int) httpx.Response[UserIDResponse] {
    return httpx.Response[UserIDResponse]{Body: UserIDResponse{ID: id.Value}}
}
```

### 4. 先產生 docs 套件

在專案根目錄執行。此步驟之前不要匯入尚不存在的 `example.com/hello-spine/docs`。`--parseInternal` 用於解析包含一般註解的 internal 套件。

```bash
swag init -g internal/application/application.go --parseInternal
```

產生 `docs/docs.go`、`docs/swagger.json` 和 `docs/swagger.yaml`。`docs.go` 的 init 函式負責註冊規格，因此在產生後加入空白匯入。請勿手動編輯產生的檔案。

### 5. 掛載 UI

向 `internal/application/application.go` 的 import 區塊加入：

```go
import (
    _ "example.com/hello-spine/docs"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

在同一檔案的 `BuildApplication()` 中，`app := spine.New()` 之後、return 之前加入。保留原有的 health 和 user 註冊。

```go
app.Transport(func(transport any) {
    e := transport.(*echo.Echo)
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})
```

### 6. 驗證並執行

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
spine contract check
spine verify
spine dev
```

在另一個終端機檢查 `http://localhost:8080/swagger/index.html` 和 `/swagger/doc.json`。Try it out 也應請求實際的 `/user/1`。透過 `app.Transport` 直接加入的 Echo 路由不屬於 CLI 靜態 Spine 路由契約，因此需要另外檢查 UI 路徑。

## 手動擴充 CRUD 的註解與 DTO 參考

以下標籤與 DTO 用於自行實作的額外功能。`resource` 不會產生這些請求、回應型別或 POST、PUT、DELETE 處理函式。將型別放在 `src/user` 的同一個 `package user` 中，確保註解與實際路由、回應狀態一致。處理函式必須透過指標接收請求 DTO。`example`、`enums`、`minimum` 等是文件中繼資料，不會自動執行輸入驗證。

## 註解標籤參考

| 標籤 | 用途 | 範例 |
|---|---|---|
| `@title`, `@version`, `@description` | API 一般資訊 | `Hello Spine API` |
| `@host`, `@BasePath` | 主機與根路徑 | `localhost:8080`, `/` |
| `@Summary`, `@Description` | 端點摘要與說明 | `Get user` |
| `@Tags` | 分組 | `users` |
| `@Router` | 路徑與方法 | `/user/{id} [get]` |
| `@Accept`, `@Produce` | Content-Type | `json` |
| `@Param` | 請求參數 | `id path int true "User ID"` |
| `@Success`, `@Failure` | 回應狀態與型別 | `200 {object} UserIDResponse` |

## @Param 格式

```text
@Param [name] [in] [type] [required] "[description]"
```

| 位置 | 用途 |
|---|---|
| `path` | 路徑中的 `{id}`，必須為 required |
| `query` | 查詢字串 |
| `body` | JSON 請求 DTO |
| `header` | 如 Authorization |
| `formData` | 表單或檔案 |

可使用 `int`/`integer`、`string`、`bool`/`boolean`、`number`、`object`、`array` 型別。

```go
// @Param name query string false "User name"
// @Param body body CreateUserRequest true "Create user"
// @Param Authorization header string true "Bearer token"
// @Success 201 {object} UserResponse
// @Failure 400 {object} ErrorResponse
```

## DTO 文件

```go
// src/user/user_types.go
package user

type CreateUserRequest struct {
    Name string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

type UpdateUserRequest struct {
    Name string `json:"name" example:"Alice Updated"`
}

type UserResponse struct {
    ID int64 `json:"id" example:"1"`
    Name string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

type ErrorResponse struct {
    Message string `json:"message" example:"user not found"`
}
```

| DTO 標籤 | 用途 | 範例 |
|---|---|---|
| `example` | 範例值 | `example:"Alice"` |
| `enums` | 可用值 | `enums:"active,inactive"` |
| `minimum`, `maximum` | 範圍 | `minimum:"1"` |
| `default` | 預設值 | `default:"10"` |


## 重新產生文件

修改註解或 DTO 後重新執行 Swaggo。`spine dev` 不會自動執行 Swaggo。CLI 規格使用 `contract export` 另外更新。

```makefile
.PHONY: swagger run

swagger:
	swag init -g internal/application/application.go --parseInternal

run: swagger
	spine dev
```

## 後續步驟

- [Spine API](/zh-Hant/reference/api/spine-app)
- [Swaggo v1.16.6](https://github.com/swaggo/swag/tree/v1.16.6)
- [http-swagger v1.3.4](https://pkg.go.dev/github.com/swaggo/http-swagger@v1.3.4)
