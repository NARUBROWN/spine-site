# 目前版本

Preview、RC、穩定版的選擇與發佈流程，請參閱[發佈通道與安裝](/zh-Hant/community/release-channels)。

::: warning v0.7.0 Preview 輸入 API 移轉
本頁既有 API 說明與範例以穩定版 `v0.6.5` 為基準。自 `v0.7.0-preview.1` 起，可依輸入來源使用獨立的 Path、Query 與 Header DTO。`query.Values`、`header.Values` 及其建構與讀取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均標記為 Deprecated。

新的 DTO 方式無法直接用於 `v0.6.5`。在 Preview 中，同一處理器混用新 DTO 與 Deprecated 輸入也會在啟動時遭到拒絕。既有本文 DTO 與情境仍可搭配任一方式使用。

適用版本與移轉範例請見 [Preview 處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)，規格選項請見 [執行階段 OpenAPI](/zh-Hant/reference/api/openapi)。
:::

一般安裝使用 `@latest`。目前文件以 Spine v0.6.5 與 CLI v0.4.2 為基準。使用 `spine version` 檢查 CLI，在產生的 `go.mod` 中確認實際相依套件。

## Preview CLI @preview {#cli-preview-branch}

CLI 與新應用程式的相依套件可以跟隨 Preview 分支。CLI 使用 `@preview` 安裝，新應用程式使用 `platform-contracts-preview` 配方。產生和 `spine update` 解析核心及所選平台的 `@preview`，並將實際版本記錄在 `go.mod` 中。既有依版本命名的配方在明確修改前維持固定版本。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

## Spine CLI v0.4.3-preview.3 {#cli-preview}

Preview CLI `v0.4.3-preview.3` 產生的新專案使用 `platform-contracts-v0.7.0-preview.2` 配方。核心使用 `v0.7.0-preview.2`，Echo、Gorilla、Kafka、RabbitMQ 和 playground 僅在選取時使用 `v0.2.0-preview.1`。

僅安裝 CLI 不會更改既有應用程式的配方，也不會啟用 Swagger UI 或 ReDoc。既有 Preview 1 和穩定版配方在明確修改前維持原本的版本固定。

請參閱 [Preview 安裝](/zh-Hant/learn/getting-started/installation#preview-cli)、[既有應用程式移轉](/zh-Hant/learn/migration/v0.7.0-preview)、[CLI 標籤](https://github.com/NARUBROWN/spine-cli/tree/v0.4.3-preview.3)與[三個作業系統的發佈驗證](https://github.com/NARUBROWN/spine-cli/actions/runs/41971655264)。

## Spine v0.7.0-preview.2 {#spine-preview-ui}

核心 `v0.7.0-preview.2` 透過 `boot.OpenAPIOptions.UI` 提供可選的 Swagger UI 與 ReDoc。UI 資源與授權聲明內嵌於二進位檔中。預設路徑為 `/docs` 與 `/redoc`，各 UI 均可設定 `Path` 與 `Title`。

執行階段 OpenAPI JSON 從 `v0.7.0-preview.1` 起可用，`UI` 註冊選項與兩個內嵌 UI 套件從 `v0.7.0-preview.2` 起可用。HTTP 請使用 Echo `v0.2.0-preview.1`，並與穩定版 `v0.6.5` 區分選擇。

```bash
go get github.com/NARUBROWN/spine@v0.7.0-preview.2 github.com/NARUBROWN/spine-echo-platform@v0.2.0-preview.1
```

請參閱[啟動選項](/zh-Hant/reference/api/openapi#options)、[UI 註冊與執行範例](/zh-Hant/reference/api/openapi#tools)與[核心標籤](https://github.com/NARUBROWN/spine/tree/v0.7.0-preview.2)。

## Spine v0.7.0-preview.1 {#spine-preview}

已發佈的 Preview 標籤為核心 `v0.7.0-preview.1`，以及各獨立平台與 playground 的 `v0.2.0-preview.1`。請與穩定文件基準 `v0.6.5` 區分並明確選擇。

此 Preview 提供依來源分離的 Path、Query 與 Header DTO，將舊輸入 API 標記為 Deprecated，在啟動時拒絕混用，並變更本文繫結。標準 OpenAPI 需透過 `Enabled: true` 明確啟用。

適用版本、相容範圍與用法請見 [處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)與 [執行階段 OpenAPI 參考](/zh-Hant/reference/api/openapi)。

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
