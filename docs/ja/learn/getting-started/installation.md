# インストール

Spine CLIをインストールし、新しいプロジェクトを作成して、開発サーバーのレスポンスを確認します。このページは、Spine CLI 0.1.4と、CLIが生成するSpine v0.5.1のプロジェクトを対象としています。

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
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version`が`spine-cli 0.1.4`を表示すれば、インストールは完了です。

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
go mod tidy
```

`my-app`ディレクトリにプロジェクトファイルが生成されます。CLIは`go.mod`にSpine `v0.5.1`を指定し、`go mod tidy`が必要な依存関係をダウンロードします。

生成される`spine.toml`は次のとおりです。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
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

## 次のステップ

[最初のアプリ](/ja/learn/getting-started/first-app)で生成されたファイルの役割を確認するか、[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で機能を追加してください。
