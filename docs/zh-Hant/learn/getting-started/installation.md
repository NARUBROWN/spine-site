# 安裝

從 Spine `v0.6.0` 開始，官方進入點是 CLI 的 `new`。安裝最新發布的 CLI，建立專案並檢查開發伺服器的回應。

Preview、RC、穩定版的選擇與發佈流程，請參閱[發佈通道與安裝](/zh-Hant/community/release-channels)。

## 需求

- 需要 Go 1.25.5 以上版本。CLI 建議使用 Go 1.27.3。
- Go 執行檔的安裝路徑必須包含在 `PATH` 中。若未設定 `GOBIN`，預設路徑為 `$(go env GOPATH)/bin`。

```bash
go version
```

確認輸出的 Go 版本為 1.25.5 以上。

## 安裝 CLI

執行下列指令安裝 CLI 並確認版本。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

以下範例以正式 CLI `v0.4.3` 為基準。要固定安裝此版本，請執行以下指令。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.3
spine version
```

更新 CLI 本身時，重新執行上面的 `go install` 指令。`spine update` 更新所選配方的專案相依套件，不會更新 CLI 執行檔或改寫應用程式原始碼。

使用 `spine version` 確認已安裝的 CLI 版本。

若找不到 `spine` 指令，且未另外設定 `GOBIN`，請在 Bash 或 Zsh 執行下列指令，將路徑加入目前的工作階段。若要持續使用，請將相同設定存入 shell 啟動檔。若已設定 `GOBIN`，請改為加入該目錄。

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

## 安裝 Preview CLI {#preview-cli}

可透過 `@preview` 安裝 Preview CLI。此分支會持續更新，應用程式相依套件通道透過 `spine new --channel` 另行選擇。正式應用程式使用 `main`。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

## 建立新專案

在預計放置專案的上層目錄執行。若已有同名的 `my-app` 目錄，請使用其他名稱。

```bash
spine new my-app --module example.com/my-app --channel main --no-interactive
cd my-app
```

`new` 依照已安裝 CLI 的驗證配方選擇相容的 Spine、Echo 平台與 Echo 版本，並完成相依套件安裝、靜態契約檢查與建置。請在產生的 `go.mod` 中查看選取的版本。使用 `--skip-install` 時，請另外執行 `go mod tidy` 與 `go mod download all`。安裝過程不會初始化應用程式、執行測試或啟動監聽器。

產生的 `spine.toml` 如下。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
recipe = "platform-contracts-preview"
dependency_channel = "main"
websocket_platform = "none"
validator = "none"
frontend_enabled = false
```

`internal/application/application.go` 中的 `BuildApplication()` 會註冊元件與 `GET /health`。產生的 `main.go` 會呼叫此函式，透過 `app.Validate(options)` 驗證設定後，再以 `app.Run(options)` 啟動伺服器。

## 驗證與執行

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

確認每個指令都執行完畢，且未發生錯誤。

| 指令 | 檢查內容 |
| --- | --- |
| `spine doctor` | Go 工具與專案設定 |
| `spine inspect` | 程式碼中註冊的路由、相依性等應用程式設定 |
| `spine contract check` | 從註冊程式碼擷取的執行契約是否有效 |
| `spine verify` | 執行契約，以及 `gofmt`、`go vet` 與 Go 測試結果 |

產生的 `application_test.go` 會在不啟動伺服器的情況下，檢查 `BuildApplication()` 與 `app.Validate(options)`。此步驟驗證的是程式碼與應用程式設定，實際 HTTP 回應則在下一步確認。

通過檢查後，執行 `spine dev`，並在另一個終端機確認實際的 HTTP 回應。

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

若回傳 `{"status":"ok"}`，表示開發伺服器已處理請求。在執行伺服器的終端機按下 `Ctrl+C` 即可結束。連接外部資料庫、訊息代理程式，或完成部署後，也必須在對應環境確認運作情況。

## 修復模組快取錯誤

靜態契約檢查會離線讀取模組圖。若使用 `--skip-install` 產生檔案或手動變更相依套件後出現 `MODULE_GRAPH_UNAVAILABLE`，請先準備完整的模組中繼資料，再重新檢查。

```bash
go mod tidy
go mod download all
spine contract check
spine verify
```

[選擇平台與 DTO 驗證](/zh-Hant/learn/getting-started/platforms)

## 下一步

透過[第一個應用程式](/zh-Hant/learn/getting-started/first-app)了解產生的檔案各自的用途，或依照[專案結構](/zh-Hant/learn/tutorial/1-project-structure)新增功能。
