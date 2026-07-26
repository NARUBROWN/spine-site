# 目前版本

## Spine v0.5.1

本網站說明 Spine v0.5.1 目前的公開 API 與執行階段行為。

- 包含 `BeforeResponse` 的四階段攔截器與預備 HTTP 回應
- 回傳結構化 `boot.ConfigError` 的無網路 `App.Validate` 檢查
- 透過 `InterceptorFor` 限定 HTTP/WebSocket 攔截器範圍
- Kafka TLS、有界 consumer retry、ACK/NACK 失敗後的 reader 重建與安全關閉
- RabbitMQ 安全傳輸、持久化確認發布、prefetch、失敗策略與 DLX
- WebSocket 同源檢查、可信任代理、連線容量與 upgrade 前驗證
- 嚴格驗證帶憑證的 CORS 與 Cookie
- bootstrap readiness 檢查與確定性關閉
- 安全的 DI singleton 解析、路由回退與參數轉換

正式環境設定請參閱[安全設定](/zh-Hant/reference/security-configuration)。
