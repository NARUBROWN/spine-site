# 安裝

安裝 Spine CLI 後，建立新專案並確認開發伺服器的回應。本篇以 Spine CLI 0.1.4 及其產生的 Spine v0.5.1 專案為準。

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
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version` 輸出 `spine-cli 0.1.4` 即表示安裝完成。

若找不到 `spine` 指令，且未另外設定 `GOBIN`，請在 Bash 或 Zsh 執行下列指令，將路徑加入目前的工作階段。若要持續使用，請將相同設定存入 shell 啟動檔。若已設定 `GOBIN`，請改為加入該目錄。

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

## 建立新專案

在預計放置專案的上層目錄執行。若已有同名的 `my-app` 目錄，請使用其他名稱。

```bash
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
```

專案檔案會產生在 `my-app` 目錄。CLI 會在 `go.mod` 中指定 Spine `v0.5.1`，而 `go mod tidy` 會下載所需的相依套件。

產生的 `spine.toml` 如下。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
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

## 下一步

透過[第一個應用程式](/zh-Hant/learn/getting-started/first-app)了解產生的檔案各自的用途，或依照[專案結構](/zh-Hant/learn/tutorial/1-project-structure)新增功能。
