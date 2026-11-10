# 处理器元数据 (HandlerMeta)

`core.HandlerMeta` 将所选处理器和路由的元数据传给拦截器。`v0.7.1` 同时支持旧方法表达式和 `RegisterRoutes` 中注册的回调。

## 字段与方法

`ControllerType` 表示控制器类型，`PathKeys` 按路由顺序保存路径参数名，`Interceptors` 保存路由拦截器。`Method` 描述旧方法表达式，`Callback` 是新回调的 `reflect.Value`。不要假定任一字段对所有注册方式都有效。

`FunctionType()` 返回回调或方法的函数类型。`ArgumentOffset()` 对回调返回 0，对旧方法的接收者返回 1。`HandlerName()` 对回调返回控制器类型和 `RegisterRoutes`，对旧方法返回控制器类型和方法名。回调名称不是每个函数的唯一标识。

全局 `PreHandle` 在路由前执行并接收空元数据。此时 `ControllerType` 和 `FunctionType()` 为 nil，`HandlerName()` 为空字符串。路由拦截器在路由与输入解析后接收所选元数据。

## 运行示例

以下独立应用在路由拦截器中读取 `HandlerName()` 和 `ArgumentOffset()` 并存入请求上下文。在独立 Go 模块中安装 Spine `v0.7.1` 和兼容 Echo 平台，保存为 `main.go` 并运行 `go run .`。

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

在另一个终端发出请求，返回的 `argument_offset` 为 0，处理器名称为 `*main.Controller.RegisterRoutes`。该名称取决于 Go 包和类型。

```bash
curl http://localhost:8080/meta
```

## 注册与执行

新控制器在 `RegisterRoutes(*api.Registry)` 中注册回调与 `api.Interceptors(...)` 选项。旧 `app.Route` 和 `route.WithInterceptors` 为兼容性保留，但 `app.Route` 已弃用。两种方式重复注册同一路由会在准备阶段被拒绝。

请求依次执行全局拦截器、路由与输入解析、路由拦截器及处理器。`PathKeys` 是参数名而非请求值。命名 DTO 使用 `path` 标签。 在 v0.7.1 中，每个路径变量对应一个标量 `input.Path[T]` 参数，顺序与路由一致。数量必须相同，且不能在同一处理器中混用路径 DTO 或旧路径包装类型。

后处理与错误请参阅[拦截器教程](/zh-Hans/learn/tutorial/4-interceptor)，注册方式请参阅[控制器与路由迁移](/zh-Hans/learn/migration/preview-controller-routes)。
