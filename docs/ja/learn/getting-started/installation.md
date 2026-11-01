# インストール

Spine CLIをインストールし、CLIで生成したプロジェクトで開発を始めます。このガイドは Spine CLI **0.1.4**、生成される Spine の依存バージョン **v0.5.1** を対象とします。

## 前提条件

- Go **1.25.5 以上**。CLIの推奨・検証済みバージョンは **1.27.3** です。
- Goの実行ファイルのインストール先を `PATH` に追加してください。`GOBIN` が未設定の場合、既定のパスは `$(go env GOPATH)/bin` です。

```bash
go version
```

## CLIのインストール

このサイトでは `spine` コマンドを使用します。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

インストール後に `spine` が見つからず、`GOBIN` を設定していない場合は、Bash・Zshの現在のセッションに既定の実行ファイルパスを追加します。継続利用する場合はシェルの起動ファイルにも保存してください。`GOBIN` を設定した場合は、そのディレクトリを追加します。

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

バージョン出力は `spine-cli 0.1.4` です。

## プロジェクトの生成

プロジェクトを作成する親ディレクトリで実行します。

```bash
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
```

CLI は `go.mod` に Spine `v0.5.1` を指定します。`go mod tidy` で依存関係を準備します。

生成された `spine.toml` は次のとおりです。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` の `BuildApplication()` が構成要素と `GET /health` を登録します。生成された `main.go` はこの関数を呼び、`app.Validate(options)` を通過してから `app.Run(options)` を実行します。

## 検証と実行

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` はツールとプロジェクト設定を診断し、`inspect` は登録された実行契約を表示します。`contract check` は静的契約を検証し、`verify` は契約・gofmt・vet・test を検査します。生成された `application_test.go` もサーバーを起動せずに `BuildApplication()` と `app.Validate(options)` を検証します。

検査が成功したら `spine dev` で実行し、別のターミナルから実際の HTTP 応答を確認します。

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

応答は `{"status":"ok"}` です。`Ctrl+C` で開発サーバーを終了します。ローカル検証と外部 DB・broker・デプロイ環境の E2E は別に確認します。

## 次のステップ

[5分クイックスタート →](/ja/learn/getting-started/first-app)で生成されたプロジェクトと最初のAPIを確認してください。
