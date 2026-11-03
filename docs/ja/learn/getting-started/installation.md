# インストール

Spine `v0.6.0` 以降、公式の開始方法は CLI の `new` です。最新の公開 CLI をインストールし、プロジェクトを作成して開発サーバーの応答を確認します。

## 要件

- Go 1.25.5以上が必要です。CLIの推奨バージョンはGo 1.27.3です。
- Goの実行ファイルのインストール先が`PATH`に含まれている必要があります。`GOBIN`を設定していない場合、既定のパスは`$(go env GOPATH)/bin`です。

```bash
go version
```

表示されたGoのバージョンが1.25.5以上であることを確認してください。

## CLIのインストール

次のコマンドでCLIをインストールし、バージョンを確認します。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

CLI自体を更新する場合は、上の `go install` コマンドを再実行します。`spine update` は選択したレシピのプロジェクト依存関係を更新し、CLI実行ファイルやアプリのソースは変更しません。

`spine version` でインストール済み CLI のバージョンを確認してください。0.6.5レシピにはCLI 0.4.2以上に更新してください。

`spine`コマンドが見つからず、`GOBIN`も設定していない場合は、BashまたはZshで次のコマンドを実行し、現在のセッションのパスに追加してください。継続して使う場合は、同じ設定をシェルの起動ファイルに保存します。`GOBIN`を設定している場合は、そのディレクトリを代わりに追加してください。

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

## 新しいプロジェクトの生成

プロジェクトを配置する親ディレクトリで実行します。同じ名前の`my-app`ディレクトリがすでにある場合は、別の名前を使ってください。

```bash
spine new my-app --module example.com/my-app
cd my-app
```

`new` はインストール済み CLI の検証済みレシピで互換性のある Spine、Echo プラットフォーム、Echo のバージョンを選択し、依存関係のインストール、静的契約の検査、ビルドを完了します。選択されたバージョンは生成された `go.mod` で確認してください。`--skip-install` を使った場合は、別途 `go mod tidy` と `go mod download all` を実行します。インストール時にアプリの初期化、テスト、リスナーの起動は行いません。

生成される`spine.toml`は次のとおりです。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
```

`internal/application/application.go`の`BuildApplication()`が構成要素と`GET /health`を登録します。生成された`main.go`はこの関数を呼び出し、`app.Validate(options)`で構成を検証してから、`app.Run(options)`でサーバーを実行します。

## 検証と実行

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

各コマンドがエラーなく終了することを確認してください。

| コマンド | 確認する内容 |
| --- | --- |
| `spine doctor` | Goのツールとプロジェクト設定 |
| `spine inspect` | コードに登録されたルートや依存関係などのアプリ構成 |
| `spine contract check` | 登録コードから抽出した実行契約の有効性 |
| `spine verify` | 実行契約と`gofmt`、`go vet`、Goのテスト結果 |

生成された`application_test.go`は、サーバーを起動せずに`BuildApplication()`と`app.Validate(options)`を検査します。この段階ではコードとアプリの構成を検証します。実際のHTTPレスポンスは次の段階で確認します。

検査に合格したら`spine dev`で実行し、別のターミナルで実際のHTTPレスポンスを確認します。

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

`{"status":"ok"}`が返れば、開発サーバーがリクエストを処理できたことを確認できます。サーバーを実行したターミナルで`Ctrl+C`を押して終了します。外部のデータベースやメッセージブローカーを接続した後、またはデプロイした後は、その環境でも動作を確認する必要があります。

## モジュールキャッシュエラーからの復旧

静的契約の検査ではモジュールグラフをオフラインで読み取ります。`--skip-install` でファイルだけを生成した後や、依存関係を手動で変更した後に `MODULE_GRAPH_UNAVAILABLE` が表示された場合は、モジュールのメタデータを揃えて再検査します。

```bash
go mod tidy
go mod download all
spine contract check
spine verify
```

[プラットフォームとDTO検証の選択](/ja/learn/getting-started/platforms)

## 次のステップ

[最初のアプリ](/ja/learn/getting-started/first-app)で生成されたファイルの役割を確認するか、[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で機能を追加してください。
