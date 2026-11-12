# 控制器

在 RegisterRoutes 中宣告路由，透過對應來源的包裝型別接收 HTTP 輸入。本獨立應用只回傳資料，不儲存資料。

## 準備

準備 Go 1.26 以上版本與空目錄。在 BuildApplication 組裝應用，CLI 專案中對應 internal/application/application.go。

```sh
go mod init example.com/spine-tutorial
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

## 輸入來源與名稱

| 來源 | 處理器參數 | 外部名稱 |
| --- | --- | --- |
| Path | `input.Path[UserPath]` or `input.Path[int64]` | `path:"id"` |
| Query | `input.Query[SearchQuery]` | `query:"name"` |
| Header | `input.Header[RequestHeaders]` | `header:"X-Request-ID"` |
| Body | `input.Body[CreateUser]` | `json` / `xml` / `form` |

Path、Query 與 Header 預設使用 lowerCamel 名稱：ID 對應 id，UserID 對應 userId。需要自訂外部名稱時使用標籤。Body 遵循解碼器的命名規則。不提供 input.Param，直接使用 *DTO 接收 HTTP 輸入會觸發 HTTP_INPUT_WRAPPER_REQUIRED。欄位透過 path.ID、body.Name 讀取，純量透過 *id 讀取。

## DTO 與選用驗證方法 {#dto-validation}

在 BuildApplication 註冊 WithValidator(engine) 後，validate 標籤會在處理器前自動驗證。如果標籤已滿足需求，無需 Validate 方法或重複檢查。保留名稱等額外規則可用一般 Go 方法實作。下例需要匯入 errors。

```go
type CreateUserRequest struct {
	Name string `json:"name" validate:"required,max=100"`
}

func (r *CreateUserRequest) Validate() error {
	if r.Name == "admin" {
		return errors.New("此名稱無法使用")
	}
	return nil
}
```

此方法不會自動執行。需要時在處理器中呼叫 (*body).Validate() 或 (*CreateUserRequest)(body).Validate()，不要直接在包裝型別上呼叫 body.Validate()。OpenAPI 不會推斷方法中的規則。參見[完整驗證範例](/zh-Hant/learn/tutorial/7-error-handling#validation-modes)。

## 可執行應用

儲存為 main.go。此基礎範例不包含自訂 Validate 方法。

HTTP 處理器需要請求上下文時，可以在任意位置宣告 `spine.Ctx` 參數。

```go
package main

import (
	"log"

	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type UserPath struct {
	ID int64 `path:"id"`
}
type SearchQuery struct {
	Name string `query:"name"`
}
type RequestHeaders struct {
	RequestID string `header:"X-Request-ID"`
}
type CreateUser struct {
	Name string `json:"name"`
}
type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func (*UserController) Constructor() *UserController { return &UserController{} }
func (c *UserController) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Tags("Users"))
	users.GET("/search", func(q input.Query[SearchQuery], h input.Header[RequestHeaders]) httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"name": q.Name, "request_id": h.RequestID}}
	})
	users.GET("/id/:id", func(path input.Path[UserPath]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{ID: path.ID}}
	}, api.Summary("Get user"))
	users.POST("/", func(body input.Body[CreateUser]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{Name: body.Name}, Options: httpx.ResponseOptions{Status: 201}}
	})
}

func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&UserController{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
func main() {
	app, options, err := BuildApplication()
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

群組內的 "/" 表示群組基礎路徑。users.POST("/", ...) 註冊 POST /users。新程式碼使用 RegisterRoutes，app.Route 已棄用。

## 驗證請求

```sh
go run .
#
curl -H 'X-Request-ID: r1' 'http://localhost:8080/users/search?name=alice'
curl http://localhost:8080/users/id/12
curl -i -H 'Content-Type: application/json' -d '{"name":"bob"}' http://localhost:8080/users
curl -i http://localhost:8080/users/id/not-a-number
```

依序確認名稱和請求 ID、ID 12、201 回應，以及無效整數的 400。

## 輸入與回傳規則

純量 Path 的順序和數量必須符合路徑變數。路徑 DTO 按名稱綁定，可只宣告部分鍵；兩種方式不可混用。按來源分開 DTO，避免重複鍵。最多宣告一個 Body，支援 JSON、XML、form 與 multipart。檔案使用帶 form 標籤的 *multipart.FileHeader 或 []*multipart.FileHeader 欄位。

成功回應為一個 httpx.Response[T]、Binary 或 Redirect，可同時回傳 error。準備階段會拒絕多個回應值。

## 錯誤回應 {#error-response}

綁定失敗在處理器前回傳 400，一般錯誤回傳隱藏內部資訊的 500。在[錯誤處理](/zh-Hant/learn/tutorial/7-error-handling)中連接驗證器。

## 下一步

[DI](/zh-Hant/learn/tutorial/3-dependency-injection) / [OpenAPI](/zh-Hant/reference/api/openapi)
