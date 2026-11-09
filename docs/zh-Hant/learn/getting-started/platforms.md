# 選擇平台與 DTO 驗證

Spine `v0.7.1` 將 HTTP、WebSocket、事件和 DTO 驗證的公開契約保留在核心中，並將實作作為獨立模組選擇。應用程式只需連接所需實作。

## 使用 CLI 選擇

安裝 CLI `v0.4.3-rc.1` 以上版本後，在不同目錄中分別執行以下指令。`--channel main` 選擇已公開的正式標籤。如果相容的正式平台標籤尚未提供，可使用 `--channel rc` 驗證 RC。CLI 安裝通道和應用程式相依套件通道彼此獨立。

```sh
spine new http-app --module example.com/http-app --channel main --platform nethttp --no-interactive
spine new chat-app --module example.com/chat-app --channel main --platform nethttp --websocket-platform gorilla --no-interactive
spine new worker --module example.com/worker --channel main --platform none --event-platform events:nats --no-interactive
spine new validated-app --module example.com/validated-app --channel main --validator playground --no-interactive
```

預設 HTTP 平台是 Echo，預設不選擇 WebSocket、事件、validator 和前端。`--platform none` 建立事件工作程序，需要事件平台。WebSocket 需要 HTTP 平台。`--event-platform` 可以重複指定。

CLI 和核心需要 Go 1.25.5 以上版本，playground validator 和 NATS 平台需要 Go 1.26 以上版本。請在 `go.mod` 和 `spine.toml` 中確認所選版本。`--skip-install` 仍會解析版本，但略過安裝和建置。

## 公開契約與實作

HTTP 使用 `contract/http` 與 Echo 或 net/http，WebSocket 使用 `contract/websocket` 與 Gorilla。事件可使用 `contract/event` 與 Kafka、RabbitMQ 或 NATS，驗證可使用 `contract/validator` 與 playground。選擇 HTTP 平台不會自動新增 WebSocket。

應用程式將 HTTP 和 WebSocket 選項、`spine.WithEventAdapter` 和 `spine.WithValidator` 傳給 `spine.New(...)`。請檢查產生的組合程式碼並處理 factory 錯誤。舊 `adapter` 相容路徑已棄用，HTTP v2 實作不會自動轉換為 v3。

## DTO 驗證

透過 `--validator playground` 建立的應用程式會在處理器前驗證繫結的 DTO。未註冊 validator 時不會執行 `validate` 標籤。以下是請求 DTO 範例。

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=18"`
}
```

違反規則會依 HTTP 400、WebSocket 1008 關閉或消費者失敗政策處理。HTTP 欄位路徑和文件範圍取決於所選 validator 契約。

## 更新與驗證

`spine update` 保留專案記錄的相依套件通道，不會更新 CLI 執行檔或應用程式原始碼。請先檢查計畫和 base hash，再依輸出提示套用。外部資料庫、WebSocket 和代理傳遞需要在實際環境中另行驗證。

```sh
spine update --dry-run
```

請參閱[發佈通道與安裝](/zh-Hant/community/release-channels)、[輸入移轉](/zh-Hant/learn/migration/v0.7.1-preview)和 [HTTP v3 與啟動選項](/zh-Hant/learn/migration/preview-features)。
