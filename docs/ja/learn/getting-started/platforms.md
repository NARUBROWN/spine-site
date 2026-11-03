# プラットフォームとDTO検証の選択

Spine 0.6.5はHTTP、WebSocket、イベント、DTO検証の公開契約をコアに置き、具体的な実装を独立モジュールから選択します。コアは標準ライブラリのみを使用します。CLI 0.4.2の `platform-contracts-v0.6.5` レシピはSpine v0.6.5と各実装のv0.1.0タグを選択します。

## CLIのインストールと生成

通常のインストールとCLIの更新には `@latest` を使います。以下の各コマンドは別々のディレクトリを作ります。標準ではHTTP Echoを選択し、WebSocket、イベント、検証器は追加しません。

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
spine new http-app --module example.com/http-app
spine new chat-app --module example.com/chat-app --websocket-platform gorilla
spine new worker --module example.com/worker --platform none --event-platform events:kafka
spine new validated-app --module example.com/validated-app --validator playground
```

`--platform echo|none`、`--websocket-platform none|gorilla`、繰り返し指定できる `--event-platform [name:]kafka|rabbitmq`、`--validator none|playground` をサポートします。GorillaにはHTTP Echoが必要です。HTTPを使わないワーカーにはイベントプラットフォームが1つ以上必要です。選択した実装のみをインストールし、生成時にアプリ、factory、リスナー、ブローカーは実行しません。

ブローカーのアドレスと認証情報は生成したREADMEの環境変数で設定します。消費と発行の役割はアプリコードの `Config.Consume`、`Config.Publish` で選択します。名前が `events` の場合は `SPINE_EVENTS_` 接頭辞を使います。`spine.toml` は実装の選択を記録します。

## 公開契約とアプリの組み立て

| 契約 | 実装モジュール |
| --- | --- |
| `contract/http` | `spine-echo-platform` |
| `contract/websocket` | `spine-gorilla-platform` |
| `contract/event` | `spine-kafka-platform`, `spine-rabbitmq-platform` |
| `contract/validator` | `spine-validator-playground` |

生成された `BuildApplication` は必要なオプションを `spine.New(...)` に直接渡します。HTTPは `echoplatform.Option()`、WebSocketは `gorillaplatform.Option()`、イベントは `spine.WithEventAdapter(name, factory)`、検証器は `spine.WithValidator(validator)` で接続します。factoryと検証器の生成エラーはアプリを返す前に確認します。

旧 `adapter`、`adapter/http`、`adapter/event`、`wsadapter` は0.6.5では互換エイリアスです。新しい実装は `contract/` パスを使います。HTTPを選択しただけではWebSocket実装は追加されません。

## DTO検証

`--validator playground` にはGo 1.26以上が必要です。CLIと、この検証器を使わないアプリにはGo 1.25.5以上が必要です。`playground.New()` で生成した検証器を `spine.WithValidator` に登録すると、バインドしたHTTP JSON、フォームDTOとWebSocket、コンシューマーDTOをハンドラーの前に検証します。省略すると `validate` タグは自動検査されません。

以下は `--validator playground` で生成したアプリで使うリクエストDTOの例です。

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=18"`
}
```

規則違反は `message`、`fields` を含むHTTP 400、WebSocket 1008切断、コンシューマーのNACKポリシーに接続します。HTTPの `fields[].field` はJSON Pointerであり、拒否した入力値は自動公開しません。検証器の処理エラーはHTTP 500、WebSocket 1011になります。

## 既存アプリの移行と検証

`boot.Options.Kafka`、`boot.Options.RabbitMQ` とブローカー専用boot型は削除されました。外部Kafka、RabbitMQの `Config` で `Consume`、`Publish` と接続情報を指定し、`WithEventAdapter` に登録します。再接続とACK/NACKの制限は `WithEventConsumerRetry`、`WithEventSettlementTimeout` で指定します。

CLIの更新は上の `go install ...@latest` を再実行します。`spine update` は選択したレシピの依存関係だけを更新し、ソース、実装の選択、既存レシピを自動移行しません。先に組み立てコードと設定を手動移行し、依存関係の変更を確認してください。

既存アプリを0.6.5に移行する場合、まず `spine.toml` の `module`、`entrypoint`、`composition`、`port`、`layout` を保持し、レシピと実装選択のキーを変更または追加します。以下はHTTPのみで検証器を使わないアプリの設定です。必要に応じてWebSocketは `gorilla`、検証器は `playground`、イベントは実際の登録名と種類に一致する `event_platforms` の一覧に変更します。選択とアプリの組み立てを一致させてから依存関係を更新します。レシピがない既存アプリはCLIの更新後も0.6.0の依存関係を維持します。

```toml
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
event_platforms = []
```

```sh
spine update --dry-run
spine update
spine contract check
spine verify
```

dry-runの変更を確認し、`--dry-run` なしで適用します。静的検査とローカル検査の後、実際のHTTP、WebSocket応答とブローカー配送を別途確認します。

[0.6.5移行ガイド](https://github.com/NARUBROWN/spine/blob/v0.6.5/docs/migration/v0.6.5.md)
