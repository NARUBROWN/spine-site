# インストールと最初のアプリ

Spine CLI `v0.4.4` を使い、コア `v0.7.5` で動く HTTP アプリを作成します。CLI とアプリ依存関係のチャネルは[リリースチャネル](/ja/community/release-channels)を参照してください。

## 要件

この例のバリデーターには Go 1.26 以降が必要です。`GOBIN` または既定の `GOPATH/bin` を `PATH` に追加してください。

```sh
go version
```

<span id="preview-cli"></span>

## 正式版 CLI のインストール {#install-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

`spine version` でインストールされたバージョンを確認します。同じ CLI を使うには、インストールコマンドに `@v0.4.4` を指定してください。`spine update` はアプリの依存関係を更新します。

## プロジェクト作成

```sh
spine new my-app --module example.com/my-app --channel main --validator playground --no-interactive
cd my-app
go list -m all
spine doctor
spine inspect
```

CLI レシピが互換版を選びます。go.mod でコア 0.7.5 API とプラットフォームの組み合わせを確認してください。既定は layered-v1 です。--validator playground は BuildApplication に検証器を組み立て、既定の none はタグ検証を有効にしません。生成ではアプリ資源やリスナーを起動しません。

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

## 検証と実行

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

{"status":"ok"} を確認し Ctrl+C で終了します。生成 main は BuildApplication、app.Validate、app.Run の順です。Validate は生成子や DB 接続を実行しないため、実リクエストも確認します。

## 依存メタデータの回復

--skip-install や手動変更後に MODULE_GRAPH_UNAVAILABLE が出たら、モジュール情報を取得します。

```sh
go mod tidy
go mod download all
spine contract check
```

## 次のステップ

[プロジェクト構造](/ja/learn/tutorial/1-project-structure) / [コントローラー](/ja/learn/tutorial/2-controller) / [プラットフォーム選択](/ja/learn/getting-started/platforms)
