# プラットフォームと DTO 検証の選択

::: info 0.7.5 API
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

Spine `v0.7.5` は HTTP、WebSocket、イベント、DTO 検証の公開契約をコアに置き、実装を独立モジュールとして選択します。必要な実装だけをアプリに接続できます。

## CLI で選択する

[CLI インストール](/ja/learn/getting-started/installation)後、0.7.5 API 対応の Preview CLI を使います。CLI とアプリ依存のチャネルは別です。

```sh
spine new http-app --module example.com/http-app --channel preview --platform nethttp --no-interactive
spine new chat-app --module example.com/chat-app --channel preview --platform nethttp --websocket-platform gorilla --no-interactive
spine new worker --module example.com/worker --channel preview --platform none --event-platform events:nats --no-interactive
spine new validated-app --module example.com/validated-app --channel preview --validator playground --no-interactive
```

既定の HTTP プラットフォームは Echo です。WebSocket、イベント、validator、フロントエンドは既定では選択されません。`--platform none` はイベントワーカーを生成し、イベントプラットフォームが必要です。WebSocket には HTTP プラットフォームが必要です。`--event-platform` は複数回指定できます。

CLI とコアには Go 1.25.5 以降、playground validator と NATS プラットフォームには Go 1.26 以降が必要です。選択されたバージョンは `go.mod` と `spine.toml` で確認してください。`--skip-install` でもバージョンを解決しますが、インストールとビルドを省略します。

## 公開契約と実装

HTTP は `contract/http` と Echo または net/http、WebSocket は `contract/websocket` と Gorilla を使います。イベントは `contract/event` と Kafka、RabbitMQ または NATS、検証は `contract/validator` と playground を使えます。HTTP プラットフォームを選択しても WebSocket 実装は自動追加されません。

アプリは HTTP と WebSocket のオプション、`spine.WithEventAdapter`、`spine.WithValidator` を `spine.New(...)` に渡します。生成された構成コードを確認し、factory のエラーを処理してください。既存の `adapter` 互換パスは非推奨で、HTTP v2 実装は v3 に自動変換されません。

## DTO 検証

`--validator playground` で作成したアプリは、バインドした DTO をハンドラーの前に検証します。validator を登録しない場合、`validate` タグは実行されません。次はリクエスト DTO の例です。

```go
type CreateUserRequest struct {
	Email string `json:"email" validate:"required,email"`
	Age   int    `json:"age" validate:"gte=18"`
}
```

規則違反は HTTP 400、WebSocket 1008 終了、またはコンシューマーの失敗ポリシーで処理されます。HTTP のフィールドパスと文書の範囲は選択した validator の契約に従います。

## 更新と確認

`spine update` はプロジェクトに記録された依存関係チャンネルを維持し、CLI 実行ファイルやアプリのソースを変更しません。まず計画と base hash を確認し、出力の案内に従って適用します。外部 DB、WebSocket、ブローカーの動作は実環境で別途検証してください。

```sh
spine update --dry-run
```

[リリースチャンネルとインストール](/ja/community/release-channels)、[入力の移行](/ja/learn/migration/v0.7.5)、[HTTP v3 と起動オプション](/ja/learn/migration/v0.7.5)を参照してください。
