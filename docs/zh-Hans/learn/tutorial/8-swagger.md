# Swagger 与 OpenAPI

::: info 0.7.5 API
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

提供运行时 OpenAPI JSON、内置 Swagger UI 和 ReDoc，同时检查规范和实际输入验证。

## 独立应用

```sh
go mod init example.com/spine-openapi
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
```

在 BuildApplication 中通过 WithValidator 注册 playground.New()。必填标签会在请求中自动检查，并在规范中表示为 required。OpenAPI 本身不验证请求，任意 DTO Validate 方法也不会自动执行或生成文档。

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

## 检查请求与界面

```sh
go run .
# In another terminal
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
curl -i -H 'Content-Type: application/json' -d '{}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"alice@example.com"}' http://localhost:8080/users
```

规范与 UI 返回 200，空输入返回 400，有效创建返回 201。规范将 name、email 标为必填。UI 与规范不执行业务拦截器，须通过 HTTP 中间件或代理控制公开范围。

## CLI 静态导出

在含 spine.toml 的 CLI 项目根目录运行此命令，未配置的上述独立示例不适用。静态分析不执行应用或验证器，须结合诊断与运行时规范检查。

```sh
spine contract check
spine contract export --format openapi --output openapi.json
```

## 下一步

[OpenAPI 参考](/zh-Hans/reference/api/openapi) / [输入验证](/zh-Hans/learn/tutorial/7-error-handling#validation-modes)
