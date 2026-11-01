# 最初のアプリ

Spine CLI をインストールしてプロジェクトを生成し、約5分で `GET /health` を実行します。Go 1.25.5 以上が必要で、CLI の推奨バージョンは Go 1.27.3 です。初回の依存関係ダウンロードにかかる時間は環境によって異なります。

## 1. CLI のインストールと確認

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version` は `spine-cli 0.1.4` と表示します。コマンドが見つからない場合は、[インストール](/ja/learn/getting-started/installation)で Go 実行ファイルのパス設定を確認してください。

## 2. プロジェクトの生成

プロジェクトを作成する親ディレクトリで実行します。

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
go mod tidy
```

CLI は `go.mod` に Spine `v0.5.1` を指定します。`go mod tidy` で依存関係を準備します。

## 3. 生成された構造を確認

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/application/
    ├── application.go
    └── application_test.go
```

`spine.toml` は、モジュール、実行エントリポイント、登録コードの場所を CLI に伝えます。

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` の `BuildApplication()` がアプリと起動オプションを組み立てます。生成コードは `HealthController` のコンストラクタと `GET /health` を登録し、`boot.HTTPOptions` を明示します。ルート・コンストラクタ・インターセプターの登録は、この関数またはここから呼ぶ `Register(app) error` にまとめます。

`main.go` はすでに生成されています。上書きせずに、次の実行フローを確認してください。

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

## 4. 契約とローカルコードの検証

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` はツールとプロジェクト設定を診断し、`inspect` は登録された実行契約を表示します。`contract check` は静的契約を検証し、`verify` は契約・gofmt・vet・test を検査します。生成された `application_test.go` もサーバーを起動せずに `BuildApplication()` と `app.Validate(options)` を検証します。

## 5. 実行して応答を確認

```bash
spine dev
```

別のターミナルからリクエストします。

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

開発サーバーは `Ctrl+C` で終了します。CLI で生成したプロジェクト、再利用可能なアプリ組み立て関数、静的契約の検証、実際の HTTP 応答を確認できました。

## 次のステップ

- [プロジェクトの構造](/ja/learn/tutorial/1-project-structure) — 生成したプロジェクトに機能を追加
- [コントローラー](/ja/learn/tutorial/2-controller) — CLI が生成したルートとハンドラーを確認
- [データベース](/ja/learn/tutorial/5-database) — リポジトリに Bun ORM を接続
