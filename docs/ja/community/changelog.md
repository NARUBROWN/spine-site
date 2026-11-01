# 現在のリリース

このドキュメントサイトは、Spine v0.5.1 と Spine CLI v0.1.4 を基準としています。

## Spine v0.5.1

Spine v0.5.1 の公開 API とランタイムは、次の機能を提供します。

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

## Spine CLI v0.1.4

インストールとプロジェクト作成の例は、Spine CLI v0.1.4 を基準としています。このバージョンの CLI は、Spine v0.5.1 を使用するプロジェクトを生成します。

- [CLI のインストール](/ja/learn/getting-started/installation)
- [最初のアプリを作る](/ja/learn/getting-started/first-app)
