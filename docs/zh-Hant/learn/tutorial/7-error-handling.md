# 錯誤處理與輸入驗證

在 Spine v0.7.1 中結合 DTO 自動驗證與自訂規則，並傳回輸入錯誤和資源不存在的 HTTP 回應。

## 可執行範例

需要 Go 1.26 以上版本。在獨立 Go 模組中安裝依賴，將程式碼儲存為 `main.go` 並執行。此範例不會儲存使用者。

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0 github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

```go
package main

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}

func (u *CreateUser) Validate() error {
	if strings.EqualFold(strings.TrimSpace(u.Name), "admin") {
		return errors.New("name is reserved")
	}
	return nil
}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.POST("/users", func(body input.Body[CreateUser]) (httpx.Response[CreateUser], error) {
		if err := (*CreateUser)(body).Validate(); err != nil {
			return httpx.Response[CreateUser]{}, httperr.BadRequest(err.Error())
		}
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})
	r.GET("/users/:id", func(id input.Path[int64]) (httpx.Response[map[string]any], error) {
		if *id <= 0 {
			return httpx.Response[map[string]any]{}, httperr.BadRequest("invalid user ID")
		}
		if *id != 1 {
			return httpx.Response[map[string]any]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": "Alice"}}, nil
	})
}
func main() {
	engine, err := playground.New()
	if err != nil {
		log.Fatal(err)
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

## 驗證何時執行

註冊 `spine.WithValidator(engine)` 後，本文繫結成功時會檢查 `validate` 標籤，失敗則在處理函式執行前回傳 400。未註冊驗證器時，僅有標籤不會執行驗證。

DTO 的 `Validate()` 不會自動呼叫。範例在標籤驗證通過後由處理函式呼叫它來檢查保留名稱。也能以此方式擴充跨欄位或應用程式規則。只向 `BadRequest` 傳入可公開的訊息。

`app.Validate(options)` 在啟動前檢查應用程式設定，不會驗證請求 DTO，也不會實際執行建構函式或外部服務。

## 檢查回應

依序回傳 200、400、404、400、400 和 201。第一個 POST 錯誤包含欄位驗證資訊，第二個來自自訂規則。

```bash
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
```

## 錯誤對應

`httperr.BadRequest`、`Unauthorized` 和 `NotFound` 分別回傳 400、401 和 404。其他狀態可使用 `httperr.HTTPError`。一般錯誤會轉成 500，請勿直接公開內部錯誤。可用 `errors.Is` 判斷領域錯誤。

## 進一步了解

- [httperr](/zh-Hant/learn/core-concepts/httperr)
- [攔截器](/zh-Hant/learn/tutorial/4-interceptor)
