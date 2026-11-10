# はじめに

Spine は生成子、ルート、インターセプターを Go コードで構成するバックエンドフレームワークです。`v0.7.1` ではコントローラーが HTTP ルートを登録し、ハンドラーのシグネチャで入力元とレスポンス型を表します。

## アプリの構成と実行

次の独立アプリは、サービスとリポジトリを注入したコントローラーを構成します。別の Go モジュールに Spine `v0.7.1` と互換 Echo プラットフォームをインストールし、`main.go` に保存して `go run .` を実行します。

新しいディレクトリで Go モジュールを作成し、正式版の依存関係をインストールします。

```bash
go mod init example.com/spine-intro
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Repository struct{}

func (*Repository) Constructor() *Repository { return &Repository{} }
func (*Repository) Greeting() string         { return "hello" }

type Service struct{ repository *Repository }

func (*Service) Constructor(repository *Repository) *Service { return &Service{repository: repository} }

type Controller struct{ service *Service }

func (*Controller) Constructor(service *Service) *Controller { return &Controller{service: service} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/greeting", func() httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(
		constructor.Controller(&Controller{}),
		constructor.Service(&Service{}),
		constructor.Repository(&Repository{}),
	)
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

別のターミナルからリクエストすると `hello` が返ります。CLI で生成したプロジェクトは `BuildApplication()` に構成をまとめ、`main.go` で検証して実行します。

```bash
curl http://localhost:8080/greeting
```

## 主要な概念

### コンストラクターと依存関係

`Constructor` メソッドに必要な型を宣言し、`constructor.Repository`、`constructor.Service`、`constructor.Controller` で登録します。コンテナーは登録順ではなく型に従って依存関係を解決します。既存の生成関数も利用できます。

### ルートと入力

`RegisterRoutes` 内で `api.Registry` にパスとコールバックを登録します。`input.Path[T]`、`input.Query[T]`、`input.Body[T]` は入力元を示し、ヘッダーは別のタグ付き構造体で受け取ります。既存の `app.Route` は互換性のため維持されますが非推奨です。

### インターセプターとレスポンス

インターセプターは認証、ログ、トランザクションなどの共通処理をハンドラーの前後に実行します。成功レスポンスは `httpx.Response[T]`、失敗は `error` で返せます。本文のバインド前に認証する場合はグローバルインターセプターの実行時点を確認してください。

### プラットフォーム

HTTP には Echo または net/http の実装を選べます。WebSocket、イベントブローカー、validator も独立したプラットフォームで接続します。

## 始める

[インストール](/ja/learn/getting-started/installation)後、[最初のアプリ](/ja/learn/getting-started/first-app)で CLI プロジェクトを作り、レスポンスを確認してください。[コントローラー](/ja/learn/tutorial/2-controller)、[依存性注入](/ja/learn/tutorial/3-dependency-injection)、[インターセプター](/ja/learn/tutorial/4-interceptor)で各概念を学べます。
