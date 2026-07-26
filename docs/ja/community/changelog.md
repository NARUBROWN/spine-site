# 現在のリリース

## Spine v0.5.1

このサイトでは、Spine v0.5.1の現在の公開APIとランタイム動作を説明します。

- `BeforeResponse`を含む4段階のinterceptorと準備済みHTTP response
- 構造化された`boot.ConfigError`を返す、ネットワーク接続なしの`App.Validate`検証
- `InterceptorFor`によるHTTP/WebSocket interceptorのscope指定
- Kafka TLS、制限付きconsumer retry、ACK/NACK失敗後のreader再生成、安全なshutdown
- RabbitMQ secure transport、persistent confirmed publish、prefetch、failure policy、DLX
- WebSocket同一Origin検証、trusted proxy、接続上限、upgrade前認証
- credential付きCORSとCookieの厳格な検証
- bootstrap readiness検証と決定的なshutdown
- 安全なDI singleton解決、router fallback、argument変換

本番設定は[セキュリティ設定](/ja/reference/security-configuration)を参照してください。
