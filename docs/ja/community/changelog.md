# 現在のリリース

ドキュメントの例は 2026-11-02 に Spine v0.6.0 と CLI v0.4.0 で検証しました。通常のインストールには `@latest` を使い、実際の CLI と依存関係のバージョンは `spine-cli version` と生成された `go.mod` で確認してください。

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

## Spine CLI v0.4.0

CLI v0.4.0 は Spine v0.6.0、Echo プラットフォーム v0.1.0、HTTP アダプター v2 契約をサポートします。

- [CLI のインストール](/ja/learn/getting-started/installation)
- [最初のアプリを作る](/ja/learn/getting-started/first-app)
