# Swagger and OpenAPI

Serve runtime OpenAPI JSON, embedded Swagger UI and ReDoc. Check both the schema and actual input validation.

## Standalone app

```sh
go mod init example.com/spine-openapi
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

Register playground.New() with WithValidator in BuildApplication. Required tags are checked automatically on requests and described as required in the schema. OpenAPI itself does not validate requests; arbitrary DTO Validate methods are neither called nor documented automatically.

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
	"log"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}
type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/hello", func() httpx.Response[string] {
		return httpx.Response[string]{Body: "hello"}
	})
	r.POST("/users", func(body input.Body[CreateUser]) httpx.Response[CreateUser] {
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

## Check requests and UI

```sh
go run .
# In another terminal
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
curl -i -H 'Content-Type: application/json' -d '{}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"alice@example.com"}' http://localhost:8080/users
```

Schema and UI return 200, empty input returns 400 and valid creation returns 201. The schema marks name and email required. UI and schema bypass business interceptors; control publication through HTTP middleware or a proxy.

## Static CLI export

Run this in a CLI project root containing spine.toml, not the standalone example unless you configure it. Static analysis does not run the app or validator; review diagnostics alongside the runtime schema.

```sh
spine contract check
spine contract export --format openapi --output openapi.json
```

## Next steps

[OpenAPI reference](/en/reference/api/openapi) / [Validation](/en/learn/tutorial/7-error-handling#validation-modes)
