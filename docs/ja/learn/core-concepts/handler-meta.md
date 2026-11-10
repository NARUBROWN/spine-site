# ハンドラーメタデータ (HandlerMeta)

`core.HandlerMeta` は選択されたハンドラーとルートのメタデータをインターセプターに渡します。`v0.7.1` では従来のメソッド式と `RegisterRoutes` 内のコールバックの両方を表します。

## フィールドとメソッド

`ControllerType` はコントローラー型、`PathKeys` はルート内のパス変数名の順序、`Interceptors` はルートインターセプターの一覧です。`Method` は従来のメソッド式の情報、`Callback` は新しいコールバックの `reflect.Value` です。どちらか一方がすべての登録方式で有効とは限りません。

`FunctionType()` はコールバックまたはメソッドの関数型を返します。`ArgumentOffset()` はコールバックで 0、従来のメソッドではレシーバーに対応する 1 です。`HandlerName()` はコールバックではコントローラー型と `RegisterRoutes`、従来のメソッドでは型とメソッド名を返します。コールバック名は各関数の一意な識別子ではありません。

グローバル `PreHandle` はルーティング前に実行され、空のメタデータを受け取ります。この場合 `ControllerType` と `FunctionType()` は nil、`HandlerName()` は空文字列です。ルートインターセプターはルーティングと入力解決の後に選択されたメタデータを受け取ります。

## 実行例

この独立アプリはルートインターセプターで `HandlerName()` と `ArgumentOffset()` を読み、リクエストコンテキストに保存します。別の Go モジュールに Spine `v0.7.1` と互換 Echo プラットフォームをインストールし、`main.go` に保存して `go run .` で実行します。

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

別のターミナルからリクエストすると `argument_offset` は 0、ハンドラー名は `*main.Controller.RegisterRoutes` です。名前は Go パッケージと型によって異なります。

```bash
curl http://localhost:8080/meta
```

## 登録と実行

新しいコントローラーは `RegisterRoutes(*api.Registry)` にコールバックと `api.Interceptors(...)` オプションを登録します。従来の `app.Route` と `route.WithInterceptors` も互換性のため維持されますが、`app.Route` は非推奨です。両方式で同じルートを登録すると準備時に拒否されます。

リクエストはグローバルインターセプター、ルーティングと入力解決、ルートインターセプター、ハンドラーの順に実行します。`PathKeys` はリクエスト値ではなく変数名です。名前付き DTO は `path` タグを使います。 v0.7.1 ではパス変数ごとにスカラー `input.Path[T]` 引数をルートの順に宣言します。数を一致させ、同じハンドラーでパス DTO や従来のパスラッパーと混在させないでください。

後処理とエラーは[インターセプターチュートリアル](/ja/learn/tutorial/4-interceptor)、登録方法は[コントローラーとルートの移行](/ja/learn/migration/preview-controller-routes)を参照してください。
