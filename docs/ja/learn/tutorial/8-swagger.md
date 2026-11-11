# Swagger と OpenAPI

実行時 OpenAPI JSON、内蔵 Swagger UI、ReDoc を提供します。仕様と実際の入力検証を両方確認します。

## 独立アプリ

```sh
go mod init example.com/spine-openapi
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

BuildApplication で playground.New() を WithValidator に登録します。必須タグはリクエストで自動検証され、仕様でも required と説明されます。OpenAPI 自体はリクエストを検証せず、任意の DTO Validate メソッドは自動実行も文書化もされません。

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

## リクエストと画面確認

```sh
go run .
# In another terminal
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
curl -i -H 'Content-Type: application/json' -d '{}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"alice@example.com"}' http://localhost:8080/users
```

仕様と UI は 200、空入力は 400、有効な作成は 201 です。name と email は必須と表示されます。UI と仕様は業務インターセプターを実行しないため、公開範囲は HTTP ミドルウェアやプロキシで管理します。

## CLI の静的 export

このコマンドは spine.toml のある CLI プロジェクト用です。設定していない上の独立例では実行しません。静的解析はアプリや検証器を実行しないため、診断と実行時仕様を併せて確認します。

```sh
spine contract check
spine contract export --format openapi --output openapi.json
```

## 次のステップ

[OpenAPI 参照](/ja/reference/api/openapi) / [入力検証](/ja/learn/tutorial/7-error-handling#validation-modes)
