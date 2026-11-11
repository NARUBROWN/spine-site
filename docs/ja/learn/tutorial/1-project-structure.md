# プロジェクト構造

::: info 0.7.5 API
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

既定の layered-v1 で組み立て、HTTP コントローラー、起動を分けます。新規コードには現在のルート登録 API を使います。

## プロジェクト作成

0.7.5 API 対応の Preview CLI を使います。CLI とアプリのチャネルは別で、実際の選択版は go.mod で確認します。

```sh
spine new my-app --module example.com/my-app --channel preview --validator playground --no-interactive
cd my-app
spine doctor
spine inspect
```

```text
my-app/
├── main.go
├── go.mod
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/controller/health_controller.go
```

## 起動と組み立て

次の三つは役割分離の最小例です。生成済みの該当ファイルを置き換え、型や登録を重複追加しません。main は組み立て、Validate、Run を呼び、BuildApplication はサーバーを起動しません。

```go
// main.go
package main

import (
	"example.com/my-app/internal/application"
	"log"
)

func main() {
	app, options, err := application.BuildApplication()
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

```go
// src/controller/health_controller.go
package controller

import (
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type HealthController struct{}

func (*HealthController) Constructor() *HealthController   { return &HealthController{} }
func (c *HealthController) RegisterRoutes(r *api.Registry) { r.GET("/health", c.Get) }
func (*HealthController) Get(ctx spinectx.Ctx) httpx.Response[map[string]string] {
	return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}
```

```go
// internal/application/application.go
package application

import (
	"example.com/my-app/src/controller"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&controller.HealthController{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
```

## 生成器で機能追加

```sh
spine generate resource user --dry-run
spine generate resource user
spine --help
```

既定の layered-v1 の resource は検索の骨組みを作ります。完全な CRUD、DB、業務規則は自分で実装します。生成した役割登録を重複させず、RegisterRoutes と Constructor の役割を確認します。レイアウト別の対応生成器は spine --help で確認できます。

## 検証と実行

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

期待応答は {"status":"ok"} です。contract check は静的契約、verify はさらにフォーマット、vet、Go テストを検査します。app.Validate も生成子実行や外部接続成功は保証しません。HTTP と外部資源は実リクエストで確認します。

## 次のステップ

[コントローラー](/ja/learn/tutorial/2-controller) / [DI](/ja/learn/tutorial/3-dependency-injection) / [インターセプター](/ja/learn/tutorial/4-interceptor)
