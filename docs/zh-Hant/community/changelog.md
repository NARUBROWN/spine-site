# 版本說明

最新標籤與下一目標版本請查看[版本概覽](/zh-Hant/community/versions)。

Preview、RC、穩定版的選擇與發佈流程，請參閱[發佈通道與安裝](/zh-Hant/community/release-channels)。

## Spine v0.7.1

Spine `v0.7.1` 提供控制器路由、依角色註冊建構函式、依來源區分的 HTTP 輸入、執行階段 OpenAPI 和 HTTP v3。舊輸入 API 維持相容但已棄用，同一處理器不能混用新舊輸入。

請參閱 [v0.7.1 移轉指南](/zh-Hant/learn/migration/v0.7.1)和[執行階段 OpenAPI](/zh-Hant/reference/api/openapi)。CLI 版本與應用程式相依套件分別選擇。透過 `spine version` 檢查 CLI，在 `go.mod` 中確認相依套件。以下條目記錄各版本的歷史情況。

## Preview CLI @preview {#cli-preview-branch}

CLI 可以使用 `@preview` 安裝。應用程式相依套件透過 `spine new --channel preview`、`rc` 或 `main` 單獨選擇。Preview 通道從所選相依套件的移動 `@preview` 分支解析版本。保留應用程式原始碼、`go.mod` 和 `go.sum` 以便重現。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

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
