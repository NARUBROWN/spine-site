# 目前版本

一般安裝使用 `@latest`。目前文件以 Spine v0.6.5 與 CLI v0.4.2 為基準。使用 `spine version` 檢查 CLI，在產生的 `go.mod` 中確認實際相依套件。

## Spine v0.6.5 / CLI v0.4.2

HTTP、WebSocket、事件與 DTO 驗證的公開契約統一到 `contract/`。透過 `spine.New(...)` 選擇獨立平台；Kafka/RabbitMQ boot 選項已移除。CLI 0.4.2 產生實作選擇與 v0.6.5 配方。

[選擇平台與 DTO 驗證](/zh-Hant/learn/getting-started/platforms)

## Spine v0.6.0

Spine v0.6.0 的公開 API 與執行階段提供以下功能。

- 分離 HTTP 契約與 Echo 實作，透過 `spine-echo-platform` 建立 HTTP 應用程式
- CLI `v0.4.0` 的預設 `new` 完成平台安裝、靜態契約檢查與建置

- 包含 `BeforeResponse` 的 4 階段攔截器，以及在傳送前準備的 HTTP 回應
- 不連接網路即可檢查設定，並回傳結構化 `boot.ConfigError` 的 `App.Validate`
- 使用 `InterceptorFor` 指定 HTTP 與 WebSocket 攔截器的套用範圍
- Kafka 的 TLS 與消費者重試設定、ACK/NACK 失敗後重建讀取器，以及安全關閉
- RabbitMQ 的加密連線、持久化訊息發佈確認、prefetch、失敗策略與 DLX
- WebSocket 的同源檢查、受信任代理設定、連線數限制，以及升級前驗證
- 嚴格驗證包含認證資訊的 CORS 請求與 Cookie 設定
- 啟動期間的就緒狀態檢查，以及依指定順序關閉
- 安全的 DI 單例解析、路由器的後備處理與引數轉換

正式環境的預設值與限制，請參閱[安全性設定](/zh-Hant/reference/security-configuration)。

## Spine CLI v0.4.1

官方安裝路徑為 `github.com/NARUBROWN/spine-cli/cmd/spine`，呼叫指令為 `spine`。此修補版本新增既有應用程式遷移指南，以及離線契約檢查所需的模組快取準備步驟；CLI v0.4.0 的指令與產生行為保持不變。

- [CLI v0.4.1 發行說明](https://github.com/NARUBROWN/spine-cli/releases/tag/v0.4.1)
- [既有應用程式遷移指南](https://github.com/NARUBROWN/spine-cli/blob/v0.4.1/migration/v0.4.0.md)

## Spine CLI v0.4.0

CLI v0.4.0 支援 Spine v0.6.0、Echo 平台 v0.1.0 與 HTTP 配接器 v2 契約。

- [安裝 CLI](/zh-Hant/learn/getting-started/installation)
- [建立第一個應用程式](/zh-Hant/learn/getting-started/first-app)
