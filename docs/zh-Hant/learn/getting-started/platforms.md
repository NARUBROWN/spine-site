# 選擇平台與 DTO 驗證

::: warning v0.7.0 Preview 輸入 API 移轉
本頁既有 API 說明與範例以穩定版 `v0.6.5` 為基準。自 `v0.7.0-preview.1` 起，可依輸入來源使用獨立的 Path、Query 與 Header DTO。`query.Values`、`header.Values` 及其建構與讀取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均標記為 Deprecated。

新的 DTO 方式無法直接用於 `v0.6.5`。在 Preview 中，同一處理器混用新 DTO 與 Deprecated 輸入也會在啟動時遭到拒絕。既有本文 DTO 與情境仍可搭配任一方式使用。

適用版本與移轉範例請見 [Preview 處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)，規格選項請見 [執行階段 OpenAPI](/zh-Hant/reference/api/openapi)。
:::

Spine 0.6.5 將 HTTP、WebSocket、事件與 DTO 驗證的公開契約保留在核心中，從獨立模組選擇具體實作。核心僅使用標準函式庫。CLI 0.4.2 的 `platform-contracts-v0.6.5` 配方選擇 Spine v0.6.5 與各實作的 v0.1.0 標籤。

## 安裝 CLI 並產生專案

一般安裝與 CLI 升級使用 `@latest`。以下各專案指令建立不同目錄。預設選擇 HTTP Echo，不加入 WebSocket、事件平台或驗證器。

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
spine new http-app --module example.com/http-app
spine new chat-app --module example.com/chat-app --websocket-platform gorilla
spine new worker --module example.com/worker --platform none --event-platform events:kafka
spine new validated-app --module example.com/validated-app --validator playground
```

支援 `--platform echo|none`、`--websocket-platform none|gorilla`、可重複的 `--event-platform [name:]kafka|rabbitmq` 與 `--validator none|playground`。Gorilla 需要 HTTP Echo。沒有 HTTP 的 worker 至少需要一個事件平台。只安裝選取的實作，產生時不執行應用程式、factory、監聽器或訊息代理。

透過產生的 README 中的環境變數設定訊息代理位址與憑證。在應用程式碼中使用 `Config.Consume`、`Config.Publish` 選擇消費與發布角色。名為 `events` 的平台使用 `SPINE_EVENTS_` 前綴。`spine.toml` 記錄實作選擇。

## 公開契約與應用程式組裝

| 契約 | 實作模組 |
| --- | --- |
| `contract/http` | `spine-echo-platform` |
| `contract/websocket` | `spine-gorilla-platform` |
| `contract/event` | `spine-kafka-platform`, `spine-rabbitmq-platform` |
| `contract/validator` | `spine-validator-playground` |

產生的 `BuildApplication` 直接將所需選項傳給 `spine.New(...)`：HTTP 使用 `echoplatform.Option()`，WebSocket 使用 `gorillaplatform.Option()`，事件使用 `spine.WithEventAdapter(name, factory)`，驗證使用 `spine.WithValidator(validator)`。傳回應用程式前，檢查 factory 與驗證器的建立錯誤。

舊的 `adapter`、`adapter/http`、`adapter/event` 與 `wsadapter` 在 0.6.5 中保留為相容別名。新實作使用 `contract/` 路徑。只選擇 HTTP 不會自動加入 WebSocket 實作。

## DTO 驗證

`--validator playground` 需要 Go 1.26 以上。CLI 與未選擇此驗證器的應用程式需要 Go 1.25.5 以上。將 `playground.New()` 的結果註冊到 `spine.WithValidator` 後，會在處理器之前驗證已綁定的 HTTP JSON/表單 DTO 與 WebSocket/消費者訊息 DTO。省略驗證器時不會自動檢查 `validate` 標籤。

以下請求 DTO 可用於透過 `--validator playground` 產生的應用程式。

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=18"`
}
```

規則違反會產生包含 `message`、`fields` 的 HTTP 400 回應、WebSocket 1008 關閉或消費者 NACK 政策。HTTP 的 `fields[].field` 使用 JSON Pointer，不會自動公開被拒絕的輸入值。驗證器執行錯誤會產生 HTTP 500 或 WebSocket 1011。

## 遷移並驗證既有應用程式

`boot.Options.Kafka`、`boot.Options.RabbitMQ` 與訊息代理專用 boot 型別已移除。在外部 Kafka/RabbitMQ `Config` 中設定 `Consume`、`Publish` 與連線資訊，再透過 `WithEventAdapter` 註冊。使用 `WithEventConsumerRetry`、`WithEventSettlementTimeout` 設定重新連線與 ACK/NACK 逾時。

重新執行上面的 `go install ...@latest` 以更新 CLI。`spine update` 僅更新所選配方的專案相依套件，不會改寫原始碼、實作選擇或既有配方。請先手動遷移組裝程式碼與設定，再檢查相依套件變更。

將既有應用程式遷移至 0.6.5 時，先保留 `spine.toml` 中的 `module`、`entrypoint`、`composition`、`port`、`layout`，修改或加入配方與實作選擇鍵。以下設定適用於僅 HTTP 且未使用驗證器的應用程式。視需要將 WebSocket 設為 `gorilla`、驗證器設為 `playground`，並使 `event_platforms` 清單與實際註冊的事件名稱及平台種類一致。將實作選擇與應用程式組裝程式碼對齊後，再執行下方的相依套件更新。未指定配方的既有應用程式即使升級 CLI，仍保留 0.6.0 的相依套件組合。

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

檢查 dry-run 的變更後，不加 `--dry-run` 執行。靜態與本地檢查通過後，另外驗證實際 HTTP/WebSocket 行為與訊息代理傳遞。

[0.6.5 遷移指南](https://github.com/NARUBROWN/spine/blob/v0.6.5/docs/migration/v0.6.5.md)
