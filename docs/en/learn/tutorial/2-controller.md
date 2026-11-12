# Controllers

Declare routes in RegisterRoutes and receive each HTTP input through its source wrapper. This standalone app returns values without storing them.

## Preparation

Use Go 1.26 or later and an empty directory. Assemble the app in BuildApplication, located in internal/application/application.go in CLI projects.

```sh
go mod init example.com/spine-tutorial
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

## Input sources and names

| Source | Handler argument | Name override |
| --- | --- | --- |
| Path | `input.Path[UserPath]` or `input.Path[int64]` | `path:"id"` |
| Query | `input.Query[SearchQuery]` | `query:"name"` |
| Header | `input.Header[RequestHeaders]` | `header:"X-Request-ID"` |
| Body | `input.Body[CreateUser]` | `json` / `xml` / `form` |

Path, Query and Header default to lowerCamel names: ID becomes id and UserID becomes userId. Use tags to override external names. Body follows its decoder naming rules. There is no input.Param; bare *DTO HTTP inputs fail with HTTP_INPUT_WRAPPER_REQUIRED. Read fields as path.ID and body.Name, and scalar values as *id.

## DTOs and optional validation methods {#dto-validation}

Register WithValidator(engine) in BuildApplication to check validate tags automatically before handlers. Tag validation needs no Validate method or duplicate handler check. Additional rules, such as reserved names, can be ordinary Go methods. This fragment needs the errors import.

```go
type CreateUserRequest struct {
	Name string `json:"name" validate:"required,max=100"`
}

func (r *CreateUserRequest) Validate() error {
	if r.Name == "admin" {
		return errors.New("This name is unavailable")
	}
	return nil
}
```

This method is not called automatically. Invoke (*body).Validate() or (*CreateUserRequest)(body).Validate() in a handler that needs it, rather than body.Validate() on the wrapper. OpenAPI does not infer method logic. See the [complete validation example](/en/learn/tutorial/7-error-handling#validation-modes).

## Runnable app

Save as main.go. This basic example has no custom Validate method.

When an HTTP handler needs the request context, declare a `spine.Ctx` parameter at any position.

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

A group path of "/" refers to its base: users.POST("/", ...) registers POST /users. Use RegisterRoutes for new code; app.Route is deprecated.

## Try the requests

```sh
go run .
#
curl -H 'X-Request-ID: r1' 'http://localhost:8080/users/search?name=alice'
curl http://localhost:8080/users/id/12
curl -i -H 'Content-Type: application/json' -d '{"name":"bob"}' http://localhost:8080/users
curl -i http://localhost:8080/users/id/not-a-number
```

Expect the name and request ID, ID 12, a 201 response, then 400 for an invalid integer.

## Input and return rules

Scalar Path arguments match path variables in order and count. Path DTOs bind by name and may select a subset; do not mix both styles. Separate DTOs by source and avoid duplicate keys. Declare at most one Body; it supports JSON, XML, form and multipart. Receive files in form-tagged *multipart.FileHeader or []*multipart.FileHeader fields.

Return one httpx.Response[T], Binary or Redirect, optionally with error. Multiple response values are rejected during preparation.

## Error responses {#error-response}

Binding failures return 400 before the handler; ordinary errors return a sanitized 500. Connect a validator in [error handling](/en/learn/tutorial/7-error-handling).

## Next steps

[DI](/en/learn/tutorial/3-dependency-injection) / [OpenAPI](/en/reference/api/openapi)
