# プロジェクト構造

Spine CLIでプロジェクトを作成し、ユーザーリソースを追加します。生成されたファイルを確認しながら、アプリの構成コードを置く場所と、コントローラー、サービス、リポジトリの役割を学びます。

先に [CLI のインストール](/ja/learn/getting-started/installation)を完了してください。このチュートリアルでは機能別パッケージを使うため、新しいディレクトリで `--layout legacy` を指定して `my-app` を作成します。[最初のアプリ](/ja/learn/getting-started/first-app)の標準 `layered-v1` とは構造が異なり、既存アプリを自動変換することはありません。

## CLIによるプロジェクトの生成

プロジェクトを配置する親ディレクトリで実行します。同じ名前の`my-app`ディレクトリがすでにある場合は、別の名前を使ってください。

```sh
spine version
spine new my-app --layout legacy --module example.com/my-app
cd my-app
spine doctor
spine inspect
```

`my-app`ディレクトリが生成され、依存関係が用意されます。`doctor`がツールとプロジェクト設定を診断し、`inspect`で既定のパスである`GET /health`の登録を確認できます。

## 生成される基本構造

上記の `new` は `go.sum` を含むプロジェクトファイルを作成し、依存関係のインストールとビルドを完了します。

```text
my-app/
├── .gitignore
├── README.md
├── go.mod
├── go.sum
├── main.go
├── spine.toml
└── internal/
    └── application/
        ├── application.go
        └── application_test.go
```

## CLIの設定

`spine.toml` はモジュール、エントリーポイント、アプリ構成の場所、ポート、レイアウト、プラットフォームを設定します。DB や認証などのアプリ設定は別に管理します。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "legacy"
platform = "echo"
```

| キー | 役割 |
| --- | --- |
| `module` | Goのモジュールパス。`go.mod`のモジュールパスと一致する必要があります。 |
| `entrypoint` | 実行またはビルドする対象 |
| `composition` | アプリ構成を検査し、生成したコードを自動登録する場所 |
| `port` | 開発サーバーで使用するポート |
| `layout` | 生成ファイルの配置 (`legacy` または `layered-v1`) |
| `platform` | HTTP プラットフォーム (`echo`) |

## 実行とアプリ構成の分離

`main.go`はアプリの構成関数を呼び出し、構成を検証してからサーバーを実行します。コンストラクタ、ルート、インターセプターは、`internal/application/application.go`の`BuildApplication`に登録します。

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

`BuildApplication`はサーバーを起動せずに、アプリと実行オプションを返します。生成されたコードは、既定のHTTPパスである`GET /health`を登録します。

```go
package application

import (
    platform "github.com/NARUBROWN/spine-echo-platform"
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
    app := platform.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## CLIによる機能の追加

プロジェクトのルートでユーザーリソースを生成します。既存のプロジェクトですでに生成している場合は、このコマンドを省略します。

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

コマンドが終了すると、`src/user`に4つのファイルが生成されます。CLIは既定で、`BuildApplication`に次の登録コードを追加します。生成結果を確認し、同じコードを手動で再度登録しないでください。

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go`は、コンストラクタと`GET /user/:id`を登録します。ほかのファイルの役割は次のとおりです。

| ファイル | 役割 |
| --- | --- |
| `user_controller.go` | HTTPリクエストを受け取ってサービスに渡し、レスポンスを返します。 |
| `user_service.go` | ビジネスロジックを処理します。 |
| `user_repository.go` | データアクセスを担当します。 |

リソースジェネレーターが生成するのは、IDを返すGETハンドラーの基本コードだけです。データベースモデルやデータを永続保存する機能は、自分で実装する必要があります。

型を定義した作成と取得の例が必要な場合は、別の名前で`spine generate slice order --storage memory --field name:string`を使ってください。このコマンドのメモリストレージは開発用で、アプリを終了するとデータが失われます。

## 登録規則と検証

CLIが登録コードを検査できるように、`BuildApplication() (spine.App, boot.Options, error)`の関数本体の最上位に`app := platform.New()`を維持してください。登録コードを条件分岐、ループ、任意の補助関数の中に移さないでください。`Register(app)`が返したエラーも確認し、返す必要があります。

アプリ構成を検査してからサーバーを実行します。

```sh
spine contract check
spine verify
spine dev
```

`contract check`は、登録コードから抽出した実行契約を検査します。`verify`は契約の検査と、`gofmt`、`go vet`、Goのテストを実行します。両方のコマンドがエラーなく終了すると、`dev`が開発サーバーを起動します。実際のHTTPの動作と、外部のデータベースやメッセージブローカーへの接続は、実行環境で別途確認する必要があります。

## 次のステップ

- [コントローラー](/ja/learn/tutorial/2-controller)
- [依存性注入](/ja/learn/tutorial/3-dependency-injection)
- [インターセプター](/ja/learn/tutorial/4-interceptor)
