# Swagger 與 OpenAPI

::: info 0.7.5 API
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

提供執行時 OpenAPI JSON、內建 Swagger UI 與 ReDoc，同時檢查規格和實際輸入驗證。

## 獨立應用

```sh
go mod init example.com/spine-openapi
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
```

在 BuildApplication 透過 WithValidator 註冊 playground.New()。必填標籤會在請求中自動檢查，並在規格中表示為 required。OpenAPI 本身不驗證請求，任意 DTO Validate 方法也不會自動執行或產生文件。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	"github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
	"github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}
type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/hello", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: "hello"}
	})
	r.POST("/users", func(ctx spinectx.Ctx, body input.Body[CreateUser]) httpx.Response[CreateUser] {
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: 201}}
	}, api.Summary("Create user"), api.Tags("Users"))
}
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{
		OpenAPI: boot.OpenAPIOptions{
			Enabled: true, Title: "Example API", Version: "1.0.0",
			UI: []boot.OpenAPIUI{swaggerui.New(swaggerui.Options{}), redoc.New(redoc.Options{})},
		},
	}}
	return app, options, nil
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

## 檢查請求與介面

```sh
go run .
# In another terminal
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
curl -i -H 'Content-Type: application/json' -d '{}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"alice@example.com"}' http://localhost:8080/users
```

規格與 UI 回傳 200，空輸入回傳 400，有效建立回傳 201。規格將 name、email 標為必填。UI 與規格不執行業務攔截器，須透過 HTTP 中介軟體或代理控制公開範圍。

## CLI 靜態匯出

在含 spine.toml 的 CLI 專案根目錄執行此命令，未設定的上述獨立範例不適用。靜態分析不執行應用或驗證器，須結合診斷與執行時規格檢查。

```sh
spine contract check
spine contract export --format openapi --output openapi.json
```

## 下一步

[OpenAPI 參考](/zh-Hant/reference/api/openapi) / [輸入驗證](/zh-Hant/learn/tutorial/7-error-handling#validation-modes)
