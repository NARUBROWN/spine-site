# インストールと最初のアプリ

::: info 0.7.5 API
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

CLI のインストールチャネルとアプリ依存チャネルは別に選択します。この手順は 0.7.5 API の Preview アプリです。安定版は[チャネル案内](/ja/community/release-channels)を参照してください。

## 要件

Go 1.26 以降を使い、選択モジュールの go 指示文を確認します。GOBIN または既定の GOPATH/bin を PATH に入れます。

```sh
go version
```

## Preview CLI のインストール {#preview-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

preview は移動するブランチです。再現には版とコミットを記録し、固定タグを使います。安定 CLI は @latest でインストールします。spine update はアプリ依存だけを更新し、CLI やソースは変えません。

## プロジェクト作成

```sh
spine new my-app --module example.com/my-app --channel preview --validator playground --no-interactive
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
