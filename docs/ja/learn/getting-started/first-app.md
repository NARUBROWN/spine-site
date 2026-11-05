# 最初のアプリ

Spine CLIで新しいプロジェクトを作成し、`GET /health`が`{"status":"ok"}`を返すことを確認します。生成されたファイルを読みながら、アプリを構成し、検証してから実行する流れも確認します。

Go 1.25.5以上が必要です。CLIの推奨バージョンはGo 1.27.3です。初回の依存関係のダウンロードにかかる時間は環境によって異なります。

## 1. CLIのインストールとコマンドの確認

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

v0.7.0 Preview を使う場合は、先に [Preview CLI のインストール](/ja/learn/getting-started/installation#preview-cli)で `v0.4.3-preview.3` をインストールしてください。このページの `spine.toml` は安定版レシピの例であり、Preview CLI の新しいプロジェクトは `platform-contracts-v0.7.0-preview.2` を使用します。

`spine version` でインストール済み CLI のバージョンを確認してください。 コマンドが見つからない場合は、[インストール手順](/ja/learn/getting-started/installation)で PATH 設定を確認してください。

## 2. プロジェクトの生成

プロジェクトを配置する親ディレクトリで実行します。`hello-spine`ディレクトリがすでにある場合は、別の名前を使ってください。

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
```

`new` はインストール済み CLI の検証済みレシピで互換性のある Spine、Echo プラットフォーム、Echo のバージョンを選択し、依存関係のインストール、静的契約の検査、ビルドを完了します。選択されたバージョンは生成された `go.mod` で確認してください。`--skip-install` を使った場合は、別途 `go mod tidy` と `go mod download all` を実行します。インストール時にアプリの初期化、テスト、リスナーの起動は行いません。

## 3. 生成された構造の確認

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── go.sum
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    ├── controller/health_controller.go
    └── route/route.go
```

プロジェクトには、実行の起点となる`main.go`と、アプリの構成コードを含む`internal/application`ディレクトリがあります。`spine.toml`は、モジュールパス、エントリーポイント、アプリの構成コードの場所とポートをCLIに伝えます。

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
```

`internal/application/application.go`の`BuildApplication()`は、アプリと実行オプションを返します。生成されたコードは`HealthController`のコンストラクタと`GET /health`を登録し、HTTPの実行オプションとして`boot.HTTPOptions`を明示します。

機能を追加するときは、この関数、またはここから呼び出す`Register(app) error`関数に、ルート、コンストラクタ、インターセプターの登録をまとめます。詳しい方法は[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で説明します。

`main.go`はすでに生成されているため、変更する必要はありません。次のコードで、アプリの構成、検証、実行の順序を確認してください。

```go
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

## 4. アプリ構成とコードの検証

生成したプロジェクトのルートディレクトリで実行します。

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor`はツールとプロジェクト設定を診断します。`inspect`は、コードに登録されたルートや依存関係などのアプリ構成を表示します。CLIが登録コードから抽出したこの情報を、実行契約と呼びます。

`contract check`は実行契約を検査します。`verify`は契約の検査に加えて、`gofmt`、`go vet`、Goのテストを実行します。生成された`application_test.go`も、サーバーを起動せずに`BuildApplication()`と`app.Validate(options)`を検査します。すべてのコマンドがエラーなく終了すれば、サーバーを実行する準備は完了です。

## 5. 実行とレスポンスの確認

```bash
spine dev
```

サーバーが動いている状態で、別のターミナルを開いてリクエストを送信します。

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

上のJSONレスポンスが返れば、`GET /health`が動作したことを確認できます。サーバーを実行したターミナルで`Ctrl+C`を押し、開発サーバーを終了します。

## 次のステップ

- [プロジェクト構造](/ja/learn/tutorial/1-project-structure)で、生成したプロジェクトに機能を追加します。
- [コントローラー](/ja/learn/tutorial/2-controller)で、ルートとハンドラーを確認します。
- [データベース](/ja/learn/tutorial/5-database)で、リポジトリにBun ORMを接続します。
