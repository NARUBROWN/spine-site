# 現在のリリース

通常のインストールには `@latest` を使います。現在の文書はSpine v0.6.5とCLI v0.4.2を対象とします。CLIは `spine version`、実際の依存関係は生成した `go.mod` で確認します。

## Spine v0.6.5 / CLI v0.4.2

HTTP、WebSocket、イベント、DTO検証の公開契約を `contract/` に統合しました。`spine.New(...)` で独立プラットフォームを選び、Kafka、RabbitMQのbootオプションは削除しました。CLI 0.4.2は実装の選択とv0.6.5レシピを生成します。

[プラットフォームとDTO検証の選択](/ja/learn/getting-started/platforms)

## Spine v0.6.0

Spine v0.6.0 の公開 API とランタイムは、次の機能を提供します。

- HTTP 契約と Echo 実装を分離し、`spine-echo-platform` で HTTP アプリを作成
- CLI `v0.4.0` の標準 `new` でプラットフォームのインストール、静的契約の検査、ビルドを実行

- `BeforeResponse` を含む 4 段階のインターセプターと、送信前に準備する HTTP レスポンス
- ネットワークに接続せずに設定を検証し、構造化された `boot.ConfigError` を返す `App.Validate`
- `InterceptorFor` による HTTP と WebSocket のインターセプターの適用範囲の指定
- Kafka の TLS とコンシューマーの再試行設定、ACK/NACK 失敗後のリーダーの再生成と安全な終了
- RabbitMQ の暗号化接続、永続メッセージの発行確認、prefetch、失敗時のポリシーと DLX
- WebSocket の同一オリジン検証、信頼するプロキシの設定、接続数の制限、アップグレード前の認証
- 認証情報を含む CORS リクエストと Cookie 設定の厳格な検証
- 起動中の準備状態の確認と、定められた順序での終了
- 安全な DI シングルトンの解決、ルーターのフォールバック処理、引数の変換

本番環境のデフォルト値と制約は、[セキュリティ設定](/ja/reference/security-configuration)を参照してください。

## Spine CLI v0.4.1

公式のインストール先は `github.com/NARUBROWN/spine-cli/cmd/spine`、実行コマンドは `spine` です。既存アプリの移行ガイドと、オフライン契約検査に必要なモジュールキャッシュの準備手順を追加したパッチです。CLI v0.4.0 のコマンドと生成動作は維持します。

- [CLI v0.4.1 リリース](https://github.com/NARUBROWN/spine-cli/releases/tag/v0.4.1)
- [既存アプリの移行ガイド](https://github.com/NARUBROWN/spine-cli/blob/v0.4.1/migration/v0.4.0.md)

## Spine CLI v0.4.0

CLI v0.4.0 は Spine v0.6.0、Echo プラットフォーム v0.1.0、HTTP アダプター v2 契約をサポートします。

- [CLI のインストール](/ja/learn/getting-started/installation)
- [最初のアプリを作る](/ja/learn/getting-started/first-app)
