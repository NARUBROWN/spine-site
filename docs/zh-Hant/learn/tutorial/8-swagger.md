# Swagger 與 OpenAPI 文件

使用 CLI 匯出 OpenAPI 檔案，並視需要新增 Swaggo 文件與 Swagger UI，以便從瀏覽器傳送請求。CLI 的靜態 OpenAPI 匯出，以及使用 Swaggo 的 UI 設定，分別進行。

本頁依功能劃分的 `src/user` 範例使用[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中以 `--layout legacy` 建立的 `my-app`。CLI `v0.4.2` 預設產生依角色劃分的 `layered-v1` 結構。兩種布局都使用 Spine `v0.6.5` 與 Echo 平台 `v0.1.0`。

使用[第一個應用程式](/zh-Hant/learn/tutorial/1-project-structure)中建立的 `example.com/my-app` 專案。請先按照[控制器](/zh-Hant/learn/tutorial/2-controller)使用 `spine generate resource user` 產生 `src/user`。若使用不同的模組路徑，請只將下方 import 路徑中的 `example.com/my-app` 部分替換為該模組路徑，並保留 `/docs` 後綴。請在專案根目錄執行命令。

## 使用 CLI 匯出 OpenAPI

CLI 會根據已註冊的路徑與處理器簽章產生 OpenAPI 3.1 文件，不需要 Swaggo 註解。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

確認產生的 `openapi.json` 中有 `/health` 與 `/user/{id}`。Spine 的 `/user/:id` 在 OpenAPI 中表示為 `/user/{id}`，而 `x-spine-*` 欄位會記錄分析依據與限制。例如，執行期間才選定的回應狀態碼，無法僅靠靜態分析確定。

此命令只會產生文件檔案。若需要 Swagger UI，請繼續下一步。取代既有檔案時，請先確認內容，再使用 `--force`。

## 選用：Swaggo 與 Swagger UI

使用 Swaggo 建立 Swagger 2.0 文件，並在 Echo 傳輸層新增 UI 路徑。檔案與註冊程式碼需要自行撰寫。CLI 的 `openapi.json` 與 Swaggo 的 `docs/swagger.json` 是不同文件，必須分別更新。

### 1. 安裝工具

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. 新增 API 基本資訊

在 `internal/application/application.go` 的 `BuildApplication()` 正上方新增以下註解。保留產生的 `main.go`，以及 `spine.toml` 中的 `composition = "./internal/application"` 設定。

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

### 3. 撰寫 GET 處理器文件

以以下程式碼取代產生的 `src/user/user_controller.go`。`UserIDResponse` 是為了描述回應結構而新增的型別。此處理器回傳路徑中的 ID，`/user/1` 的回應 JSON 與原本一樣，為 `{"id":1}`。它不會從 DB 查詢使用者。

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

使用以下命令產生文件套件。產生前，請勿 import 尚不存在的 `example.com/my-app/docs`。`--parseInternal` 指定一併讀取包含 API 基本資訊的 internal 套件。

```bash
swag init -g internal/application/application.go --parseInternal
```

這會產生 `docs/docs.go`、`docs/swagger.json`、`docs/swagger.yaml`。由於 `docs.go` 的 `init` 函式會註冊文件，下一步會將此套件以僅執行副作用的方式匯入。請勿直接修改產生的檔案。

### 5. 串接 UI

在 `internal/application/application.go` 的 import 區塊中新增以下內容。

```go
import (
    _ "example.com/my-app/docs"
    "github.com/labstack/echo/v5"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

建立平台時，透過具有明確型別的 `WithEcho` 選項註冊 Echo 擴充。以下列程式碼取代既有的 `app := spine.New(echoplatform.Option())`，保留後續的建構函式與路由註冊。Spine v0.6.0 已移除 `App.Transport`。

```go
app := spine.New(echoplatform.Option(echoplatform.WithEcho(func(e *echo.Echo) {
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})))
```

### 6. 驗證並執行

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

在瀏覽器開啟 `http://localhost:8080/swagger/index.html`，確認 GET 路徑是否顯示。`/swagger/doc.json` 應回傳產生的 Swagger 2.0 文件。在 UI 中使用 Try it out 向 `/user/1` 傳送請求，應回傳 HTTP 200 與 `{"id":1}`。

透過平台選項新增的原生 Echo 路由不會經過 Spine HTTP 攔截器與回應 staging，也不包含在靜態 Spine 路由契約中。請另外檢查實際行為。

## 擴充功能時使用的註解與 DTO

下方標籤與 DTO 是新增功能時可參考的範例。`resource` 產生器不會產生這些請求與回應型別，也不會產生 POST、PUT、DELETE 處理器。請在 `src/user` 的 `package user` 中新增所需型別，並依實際路由與回應狀態碼撰寫註解。

請求 DTO 在處理器中以指標接收。`example`、`enums`、`minimum` 等標籤是供文件使用的資訊，不會自動執行輸入驗證。

### 基本註解標籤

| 標籤 | 說明 | 範例 |
|------|------|------|
| `@Summary` | 單行摘要 | `查詢使用者` |
| `@Description` | 詳細說明 | `依 ID 查詢使用者資訊` |
| `@Tags` | 群組標籤 | `users` |
| `@Router` | 路徑與方法 | `/user [get]` |

### 請求標籤

| 標籤 | 說明 | 範例 |
|------|------|------|
| `@Accept` | 請求 Content-Type | `json` |
| `@Produce` | 回應 Content-Type | `json` |
| `@Param` | 參數定義 | `id query int true "User ID"` |

### 回應標籤

| 標籤 | 說明 | 範例 |
|------|------|------|
| `@Success` | 成功回應 | `200 {object} UserResponse` |
| `@Failure` | 失敗回應 | `404 {object} ErrorResponse` |


## 指定請求參數

```
@Param [名稱] [位置] [型別] [是否必填] "[說明]"
```

### 參數位置

| 位置 | 說明 | 範例 |
|------|------|------|
| `query` | 查詢字串 | `/user?id=1` |
| `path` | URL 路徑 | `/user/{id}` |
| `body` | 請求內容 | JSON 物件 |
| `header` | 標頭 | `Authorization` |
| `formData` | 表單資料 | 檔案上傳 |

### 型別

| 型別 | 說明 |
|------|------|
| `int`, `integer` | 整數 |
| `string` | 字串 |
| `bool`, `boolean` | 布林值 |
| `number` | 實數 |
| `object` | 物件（DTO） |
| `array` | 陣列 |

### 範例

```go
// 쿼리 파라미터
// @Param id query int true "User ID"
// @Param name query string false "User name"
// @Param active query bool false "Active status"

// 요청 본문
// @Param body body CreateUserRequest true "유저 생성 요청"

// 헤더
// @Param Authorization header string true "Bearer 토큰"
```


## 撰寫 DTO 文件

### 請求 DTO

```go
// src/user/user_request.go
package user

// CreateUserRequest 유저 생성 요청
type CreateUserRequest struct {
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// UpdateUserRequest 유저 수정 요청
type UpdateUserRequest struct {
    Name  string `json:"name" example:"Alice Updated"`
    Email string `json:"email" example:"alice.new@example.com"`
}
```

### 回應 DTO

```go
// src/user/user_response.go
package user

// UserResponse 유저 응답
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
    Message string `json:"message" example:"유저를 찾을 수 없습니다."`
}
```

### DTO 標籤

| 標籤 | 說明 | 範例 |
|------|------|------|
| `example` | 範例值 | `example:"Alice"` |
| `enums` | 允許值清單 | `enums:"active,inactive"` |
| `minimum` | 最小值 | `minimum:"1"` |
| `maximum` | 最大值 | `maximum:"100"` |
| `default` | 預設值 | `default:"10"` |



## 重新產生文件

變更註解或 DTO 後，必須重新產生 Swaggo 文件。`spine dev` 不會自動執行 Swaggo。新增以下 Makefile 後，即可使用 `make run` 先更新文件再啟動應用程式。CLI 的 OpenAPI 檔案則以 `spine contract export` 另外更新。

```makefile
.PHONY: swagger run

swagger:
	swag init -g internal/application/application.go --parseInternal

run: swagger
	spine dev
```

## 下一步

- [Spine API](/zh-Hant/reference/api/spine-app)
- [Swaggo v1.16.6](https://github.com/swaggo/swag/tree/v1.16.6)
- [http-swagger v1.3.4](https://pkg.go.dev/github.com/swaggo/http-swagger@v1.3.4)
