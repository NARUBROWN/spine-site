# Error handling and input validation

Combine automatic DTO validation with a custom rule in Spine v0.7.1, and return HTTP errors for invalid input and missing resources.

## Runnable example

Go 1.26 or later is required. Install these dependencies in a separate Go module, save the code as `main.go`, and run it. This example does not persist users.

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

## When validation runs

With `spine.WithValidator(engine)`, the validator checks `validate` tags after body binding and returns 400 before the handler on failure. Without a registered validator, tags alone do not validate input.

A DTO’s `Validate()` method is not called automatically. The handler calls it after tag validation to check a reserved name. Extend this approach for cross-field or application rules. Pass only client-safe messages to `BadRequest`.

`app.Validate(options)` checks application configuration before startup. It does not validate request DTOs or execute constructors and external services.

## Check responses

The requests return 200, 400, 404, 400, 400 and 201 in order. The first POST error contains field validation details; the second is the custom rule.

```bash
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
```

## Error mapping

`httperr.BadRequest`, `Unauthorized` and `NotFound` return 400, 401 and 404. Use `httperr.HTTPError` for other statuses. Ordinary errors become 500; do not expose internal errors through `err.Error()`. Map domain errors with `errors.Is` to safe messages in the controller.

## Learn more

- [httperr](/en/learn/core-concepts/httperr)
- [Interceptor](/en/learn/tutorial/4-interceptor)
