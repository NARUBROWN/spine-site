# Swagger と OpenAPI

Spine `v0.7.1` は登録された HTTP ルートから OpenAPI JSON を生成し、内蔵 Swagger UI と ReDoc を提供できます。このチュートリアルでは独立したアプリで文書と画面を実行し、CLI の静的エクスポートを確認します。

## 1. アプリを準備する

別の Go モジュールに次の依存関係をインストールします。Echo RC はこの例で検証した組み合わせです。デプロイ時は公開済みの互換プラットフォームタグと `go.mod`、`go.sum` を固定してください。

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0-rc.1
```

次のコードを `main.go` に保存し、`go run .` で実行します。`Enabled` を省略すると自動提供は無効です。JSON のみを提供する場合は `UI` を省略します。

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
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }

func (c *Controller) RegisterRoutes(r *api.Registry) {
    r.GET("/hello", func() httpx.Response[string] {
        return httpx.Response[string]{Body: "hello"}
    })
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(constructor.Controller(&Controller{}))

    options := boot.Options{
        Address: ":8080",
        HTTP: &boot.HTTPOptions{
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Title:   "Example API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{}),
                    redoc.New(redoc.Options{}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

## 2. HTTP で確認する

別のターミナルから文書と画面にリクエストします。三つのリソースは 200 を返します。ブラウザーで `/docs` または `/redoc` を開くこともできます。

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

文書と UI は業務インターセプターを実行しません。アクセスを制限する場合は HTTP ミドルウェアまたはプロキシにポリシーを設定してください。

## 3. CLI で静的文書を出力する

[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で作成したアプリのルートで実行します。このコマンドはアプリを実行せずにソースを解析します。既存ファイルを `--force` で置き換える前に内容を確認してください。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

生成した文書で `/health` と `/user/{id}` を確認します。静的解析では動的ルート、実行時 validator のすべての制約、ハンドラーが選ぶ応答ステータスを確定できません。診断を確認し、実際のリクエストと実行時文書も検証してください。

## 次のステップ

パスの衝突、validator、文書の取得と UI 設定は[ランタイム OpenAPI リファレンス](/ja/reference/api/openapi)を参照してください。[入力の移行](/ja/learn/migration/v0.7.1-preview)では以前の入力 API の互換性を説明します。
