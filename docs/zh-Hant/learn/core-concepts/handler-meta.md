# 處理器中繼資料 (HandlerMeta)

`core.HandlerMeta` 將所選處理器和路由的中繼資料傳給攔截器。`v0.7.1` 同時支援舊方法運算式和 `RegisterRoutes` 中註冊的回呼。

## 欄位與方法

`ControllerType` 表示控制器型別，`PathKeys` 依路由順序儲存路徑參數名稱，`Interceptors` 儲存路由攔截器。`Method` 描述舊方法運算式，`Callback` 是新回呼的 `reflect.Value`。不要假設任一欄位對所有註冊方式都有效。

`FunctionType()` 回傳回呼或方法的函式型別。`ArgumentOffset()` 對回呼回傳 0，對舊方法的接收者回傳 1。`HandlerName()` 對回呼回傳控制器型別和 `RegisterRoutes`，對舊方法回傳控制器型別和方法名稱。回呼名稱不是每個函式的唯一識別碼。

全域 `PreHandle` 在路由前執行並接收空中繼資料。此時 `ControllerType` 和 `FunctionType()` 為 nil，`HandlerName()` 為空字串。路由攔截器在路由與輸入解析後接收所選中繼資料。

## 執行範例

以下獨立應用程式在路由攔截器中讀取 `HandlerName()` 和 `ArgumentOffset()` 並存入請求情境。在獨立 Go 模組中安裝 Spine `v0.7.1` 和相容 Echo 平台，儲存為 `main.go` 並執行 `go run .`。

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

在另一個終端機發出請求，回傳的 `argument_offset` 為 0，處理器名稱為 `*main.Controller.RegisterRoutes`。該名稱取決於 Go 套件和型別。

```bash
curl http://localhost:8080/meta
```

## 註冊與執行

新控制器在 `RegisterRoutes(*api.Registry)` 中註冊回呼與 `api.Interceptors(...)` 選項。舊 `app.Route` 和 `route.WithInterceptors` 為相容性保留，但 `app.Route` 已棄用。兩種方式重複註冊同一路由會在準備階段遭拒。

請求依序執行全域攔截器、路由與輸入解析、路由攔截器及處理器。`PathKeys` 是參數名稱而非請求值。命名 DTO 使用 `path` 標籤。 在 v0.7.1 中，每個路徑變數對應一個純量 `input.Path[T]` 引數，順序與路由一致。數量必須相同，且不可在同一處理器中混用路徑 DTO 或舊路徑包裝型別。

後處理與錯誤請參閱[攔截器教學](/zh-Hant/learn/tutorial/4-interceptor)，註冊方式請參閱[控制器與路由遷移](/zh-Hant/learn/migration/preview-controller-routes)。
