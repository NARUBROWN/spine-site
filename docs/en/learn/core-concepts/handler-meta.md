# Handler metadata (HandlerMeta)

`core.HandlerMeta` passes metadata for the selected handler and route to interceptors. In `v0.7.1` it describes both legacy method expressions and callbacks registered in `RegisterRoutes`.

## Fields and methods

`ControllerType` identifies the controller type, `PathKeys` contains path parameter names in route order, and `Interceptors` contains route interceptors. `Method` describes a legacy method expression; `Callback` is the `reflect.Value` for a new callback. Do not assume either field is valid for every registration style.

`FunctionType()` returns the callback or method function type. `ArgumentOffset()` returns 0 for a callback and 1 for a legacy method receiver. `HandlerName()` returns the controller type and `RegisterRoutes` for a callback, or the controller type and method name for a legacy method. A callback name does not uniquely identify each function.

A global `PreHandle` runs before routing and receives empty metadata. In that case `ControllerType` and `FunctionType()` are nil, and `HandlerName()` is empty. A route interceptor receives selected metadata after routing and input resolution.

## Runnable example

This standalone app reads `HandlerName()` and `ArgumentOffset()` in a route interceptor and stores them in the request context. Install Spine `v0.7.1` and a compatible Echo platform in a separate Go module, save this as `main.go`, and run `go run .`.

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/core"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type Inspector struct{}

func (*Inspector) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
	ctx.Set("handler", meta.HandlerName())
	ctx.Set("argument_offset", meta.ArgumentOffset())
	return nil
}
func (*Inspector) PostHandle(core.ExecutionContext, core.HandlerMeta)                  {}
func (*Inspector) BeforeResponse(core.ExecutionContext, core.HandlerMeta, error) error { return nil }
func (*Inspector) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error)      {}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/meta", func(ctx spinectx.Ctx) httpx.Response[map[string]any] {
		handler, _ := ctx.Get("handler")
		offset, _ := ctx.Get("argument_offset")
		return httpx.Response[map[string]any]{Body: map[string]any{"handler": handler, "argument_offset": offset}}
	}, api.Interceptors(&Inspector{}))
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}))
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

A request from another terminal returns `argument_offset` 0 and handler name `*main.Controller.RegisterRoutes`. The name depends on the Go package and type.

```bash
curl http://localhost:8080/meta
```

## Registration and execution

A new controller registers callbacks and `api.Interceptors(...)` options in `RegisterRoutes(*api.Registry)`. Existing `app.Route` and `route.WithInterceptors` remain available for compatibility, but `app.Route` is deprecated. Duplicate routes across the two styles are rejected during preparation.

Requests execute global interceptors, routing and input resolution, route interceptors, then the handler. `PathKeys` contains names, not request values. Named DTOs use `path` tags. In v0.7.1, declare one scalar `input.Path[T]` argument per path variable in route order. The counts must match; do not mix scalar inputs with a path DTO or legacy path wrappers in one handler.

See the [interceptor tutorial](/en/learn/tutorial/4-interceptor) for completion hooks and errors, and [controller and route migration](/en/learn/migration/preview-controller-routes) for registration.
