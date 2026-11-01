# プロジェクト構造

Spine CLIが生成するプロジェクトを基準に、アプリの構成と機能コードを分けます。先に[CLIをインストール](/ja/learn/getting-started/installation)してください。

## CLIでプロジェクトを作成

プロジェクトを作成する親ディレクトリで実行します。

```sh
spine version
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
spine doctor
spine inspect
```

## 生成される構造

`spine new`は次のファイルを生成します。`go.sum`は後で`go mod tidy`を実行すると作成されます。

```text
my-app/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/
    └── application/
        ├── application.go
        └── application_test.go
```

## CLI設定

`module`は`go.mod`と一致させます。`entrypoint`は実行・ビルド対象、`composition`は契約検査と自動登録の対象です。設定キーは以下の4つだけをサポートします。DB接続などのアプリ設定は別に管理します。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

## 起動とアプリ構成を分離

`main.go`はアプリの構成、検証、実行を担当します。コンストラクタ、ルート、インターセプターは`internal/application/application.go`の`BuildApplication`に登録します。

```go
package main

import (
    "log"

    "example.com/my-app/internal/application"
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

生成された構成関数はリスナーを起動せず、アプリと実行オプションを返します。既定のHTTPルートは`GET /health`です。

```go
package application

import (
    "os"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## CLIで機能を追加

プロジェクトのルートでユーザーリソースを生成します。すでに存在する場合はこのコマンドを省きます。

```sh
spine generate resource user
```

```text
src/user/
├── user_route.go
├── user_repository.go
├── user_service.go
└── user_controller.go
```

既定の自動登録は`BuildApplication`に次のコードを追加します。手動で重複登録しないよう、生成結果を確認してください。

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go`はコンストラクタと`GET /user/:id`を登録します。コントローラーはHTTP入出力、サービスはビジネスロジック、リポジトリはデータアクセスを担当します。リソース生成器はIDを返すGETの骨組みだけを生成し、DBモデルや永続化は実装しません。型付きの作成・取得例には別の名前で`spine generate slice order --storage memory --field name:string`を使います。メモリ保存は開発用で、プロセス終了時にデータが消えます。

## 登録規則と検証

`BuildApplication() (spine.App, boot.Options, error)`の最上位に`app := spine.New()`を残します。登録は条件分岐、ループ、任意のヘルパーに隠さず直接記述し、`Register(app)`のエラーを確認して返します。

```sh
spine contract check
spine verify
spine dev
```

`contract check`は静的契約を検査し、`verify`は契約、gofmt、vet、Goテストを確認します。DB・ブローカー接続と実際のHTTP動作は別に確認します。

## 次のステップ

- [コントローラー](/ja/learn/tutorial/2-controller)
- [依存性の注入](/ja/learn/tutorial/3-dependency-injection)
- [インターセプター](/ja/learn/tutorial/4-interceptor)
