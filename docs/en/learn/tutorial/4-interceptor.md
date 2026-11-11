# Interceptors

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Global and route PreHandle hooks both run before input binding. Authentication failure returns 401 before body parsing.

## Runnable example

[Controller dependencies](/en/learn/tutorial/2-controller)

Replace main.go. The fixed token is for learning. constructor.Interceptor registers DI; api.Interceptors chooses scope. (*Auth)(nil) marks a registered type to resolve from DI.

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/core"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type Auth struct{}

func (*Auth) Constructor() *Auth { return &Auth{} }
func (*Auth) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return httperr.InternalServerError("HTTP request context unavailable")
	}
	if request.Header("Authorization") != "Bearer demo-token" {
		return httperr.Unauthorized("unauthorized")
	}
	ctx.ExecutionContext().Set("userID", "demo-user")
	return nil
}
func (*Auth) PostHandle(spinectx.Ctx, core.HandlerMeta)                  {}
func (*Auth) BeforeResponse(spinectx.Ctx, core.HandlerMeta, error) error { return nil }
func (*Auth) AfterCompletion(spinectx.Ctx, core.HandlerMeta, error)      {}

type Controller struct{}
type CreateUser struct {
	Name string `json:"name"`
}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Interceptors((*Auth)(nil)))
	users.GET("/:id", func(ctx spinectx.Ctx, id input.Path[int64]) httpx.Response[map[string]int64] {
		return httpx.Response[map[string]int64]{Body: map[string]int64{"id": *id}}
	})
	users.POST("/", func(ctx spinectx.Ctx, body input.Body[CreateUser]) httpx.Response[string] {
		return httpx.Response[string]{Body: body.Name}
	})
	r.GET("/profile", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: "profile"}
	}, api.Interceptors((*Auth)(nil)))
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Interceptor(&Auth{}))
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

## Groups and routes

```go
func (c *UserController) RegisterRoutes(r *api.Registry) {
	auth := (*AuthInterceptor)(nil)
	audit := (*AuditInterceptor)(nil)
	users := r.Group("/users", api.Interceptors(auth))
	users.GET("/", c.List)
	users.DELETE("/:id", c.Delete, api.Interceptors(audit))
	r.GET("/profile", c.Profile, api.Interceptors(auth))
}
```

This fragment assumes implemented handlers and registered Auth and Audit types. GET /users runs Auth; DELETE /users/:id runs Auth then Audit. Child groups inherit interceptors and route options append to them. Use InterceptorFor(boot.InterceptorHTTP, ...) for HTTP globally, or app.Interceptor / InterceptorAll for HTTP and WebSocket. Avoid applying the same authentication twice.

## Try the requests

```sh
go run .
#
curl -i http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/profile
curl -i -H 'Content-Type: application/json' -d '{' http://localhost:8080/users
curl -i -H 'Authorization: Bearer demo-token' -H 'Content-Type: application/json' -d '{' http://localhost:8080/users
```

Expect 401, 200, 200, 401 and 400. Even a malformed body returns 401 when authentication fails.

## Lifecycle

PreHandle follows registration order; successful PostHandle, pre-write BeforeResponse and post-write-attempt AfterCompletion run in reverse. BeforeResponse runs only after successful PreHandle and receives binding, handler, serialization and response-validation errors. AfterCompletion may run even when PreHandle was never reached, so check resources exist.

A BeforeResponse error takes response priority over a handler error. If multiple hooks fail, the last failing hook wins; completion hooks also receive previous errors.

## Public context

All four hooks receive spine.Ctx. Use ExecutionContext().Set/Get for values, ExecutionContext().Context() for standard context, and check the HTTPRequestContext() boolean before HTTP access. Direct context.Context injection into handlers remains compatible.

## Next steps

[Transactions](/en/learn/tutorial/6-transaction) / [Errors](/en/learn/tutorial/7-error-handling)
