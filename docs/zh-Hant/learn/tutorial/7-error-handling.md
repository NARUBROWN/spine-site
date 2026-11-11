# 錯誤處理與輸入驗證

區分自動標籤驗證與自訂規則。此獨立應用不儲存資料。

## 組裝驗證器

[控制器依賴](/zh-Hant/learn/tutorial/2-controller)

```sh
go get github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

engine 是儲存 playground.New() 回傳值的變數。在 BuildApplication 建立一次並傳給 spine.WithValidator(engine)。playground 實作執行時驗證與 OpenAPI SchemaDescriber，也可使用實作公開驗證契約的其他引擎。

## 執行範例

取代 main.go，在 BuildApplication 註冊驗證器並啟用 OpenAPI。

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
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
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
	r.POST("/users", func(ctx spinectx.Ctx, body input.Body[CreateUser]) (httpx.Response[CreateUser], error) {
		if err := (*CreateUser)(body).Validate(); err != nil {
			return httpx.Response[CreateUser]{}, httperr.BadRequest(err.Error())
		}
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})
	r.GET("/users/:id", func(ctx spinectx.Ctx, id input.Path[int64]) (httpx.Response[map[string]any], error) {
		if *id <= 0 {
			return httpx.Response[map[string]any]{}, httperr.BadRequest("invalid user ID")
		}
		if *id != 1 {
			return httpx.Response[map[string]any]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": "Alice"}}, nil
	})
}
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}

	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{OpenAPI: boot.OpenAPIOptions{Enabled: true}}, EnableGracefulShutdown: true}, nil
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

## 三種驗證方式 {#validation-modes}

註冊的引擎在綁定後、處理器前檢查 validate 標籤。request.Validate() 是明確呼叫自訂一般方法。app.Validate(options) 在執行前檢查可驗證的設定與 DI。未註冊引擎時，標籤本身不會執行驗證。

如果標籤已滿足需求，省略 DTO Validate 與手動呼叫。本例僅為保留名稱規則加入它們，該規則不會自動執行，也不會被 OpenAPI 推斷。透過 (*body).Validate() 或 (*CreateUser)(body).Validate() 呼叫 DTO 方法。參見 [DTO 定義](/zh-Hant/learn/tutorial/2-controller#dto-validation)。

## 請求與規格

```sh
go run .
#
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
curl http://localhost:8080/openapi.json
```

依序為 200、400、404、400、400、201。POST 失敗分別來自標籤與手動規則。OpenAPI 標記 name、email 必填，但規格本身不執行驗證。當驗證器提供必填資訊時，即使存在 json:",string" 等表達限制，也會保留 Required。CLI 靜態 export 不執行引擎，應在準備好的應用中檢查引擎產生的規格。

## 錯誤回應

綁定與標籤驗證失敗在處理器前回傳 400。HTTPError 僅允許 400–599，200/302 等無效狀態按一般 500 處理。一般錯誤隱藏內部詳情。httperr 僅填寫可公開訊息。BeforeResponse 錯誤優先於處理器錯誤決定回應。

## 下一步

[攔截器](/zh-Hant/learn/tutorial/4-interceptor) / [OpenAPI](/zh-Hant/reference/api/openapi)
