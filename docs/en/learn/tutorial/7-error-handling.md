# Errors and input validation

Distinguish automatic tag validation from custom rules. This standalone app does not store data.

## Assemble the validator

[Controller dependencies](/en/learn/tutorial/2-controller)

```sh
go get github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

engine is the variable holding playground.New(). Create it once in BuildApplication and pass it to spine.WithValidator(engine). playground implements runtime validation and OpenAPI SchemaDescriber. Other engines implementing the public validator contract can also be used.

## Runnable example

Replace main.go. BuildApplication registers the validator and enables OpenAPI.

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

## Three validation mechanisms {#validation-modes}

The registered engine checks validate tags after binding and before the handler. request.Validate() explicitly calls your ordinary method. app.Validate(options) checks configuration and DI before execution where possible. Tags alone do not validate without a registered engine.

If tags suffice, omit both DTO Validate and its manual call. This example adds them only for the reserved-name rule, which is neither auto-called nor inferred by OpenAPI. Call DTO methods through (*body).Validate() or (*CreateUser)(body).Validate(). See [DTO definitions](/en/learn/tutorial/2-controller#dto-validation).

## Requests and schema

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

Expect 200, 400, 404, 400, 400 and 201. The POST failures cover tags and the manual rule. OpenAPI marks name and email required but does not itself execute validation. Required metadata is preserved when described by the validator, even with representation limits such as json:",string". Static CLI export does not run the engine; inspect the prepared app for engine-derived schema.

## Error responses

Binding and tag failures return 400 before handlers. HTTPError accepts only 400–599; invalid statuses such as 200/302 become ordinary 500 errors. Ordinary errors hide internal details. Put only public messages in httperr. BeforeResponse errors take response priority over handler errors.

## Next steps

[Interceptors](/en/learn/tutorial/4-interceptor) / [OpenAPI](/en/reference/api/openapi)
