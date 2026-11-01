# 安裝

安裝 Spine CLI，並在 CLI 產生的專案中開始開發。本指南使用 Spine CLI **0.1.4**，產生的專案依賴 Spine **v0.5.1**。

## 要求

- Go **1.25.5 或更新版本**。CLI 建議且已驗證的版本為 **1.27.3**。
- 將 Go 執行檔的安裝目錄加入 `PATH`。如果未設定 `GOBIN`，預設目錄為 `$(go env GOPATH)/bin`。

```bash
go version
```

## 安裝 CLI

本站使用 `spine` 指令。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

安裝後如果找不到 `spine`，且未設定 `GOBIN`，請在目前Bash或Zsh工作階段加入預設的二進位檔目錄。若要在後續工作階段生效，請將相同設定儲存至shell啟動檔。已設定 `GOBIN` 時，應改為加入該目錄。

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

版本輸出為 `spine-cli 0.1.4`。

## 產生專案

在準備存放專案的上層目錄中執行：

```bash
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
```

CLI 在 `go.mod` 中指定 Spine `v0.5.1`，使用 `go mod tidy` 準備相依套件。

產生的 `spine.toml` 如下：

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` 中的 `BuildApplication()` 註冊元件與 `GET /health`。產生的 `main.go` 呼叫此函式，通過 `app.Validate(options)` 後再執行 `app.Run(options)`。

## 驗證並執行

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` 診斷工具與專案設定，`inspect` 顯示已註冊的執行契約。`contract check` 驗證靜態契約，`verify` 執行契約、gofmt、vet 與 test 檢查。產生的 `application_test.go` 也會在不啟動伺服器的情況下檢查 `BuildApplication()` 與 `app.Validate(options)`。

檢查通過後執行 `spine dev`，再從另一個終端機檢查實際 HTTP 回應。

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

回應為 `{"status":"ok"}`。按 `Ctrl+C` 停止開發伺服器。本機驗證與外部資料庫、broker 或部署環境的 E2E 驗證需要分別確認。

## 後續步驟

繼續閱讀 [5 分鐘快速入門 →](/zh-Hant/learn/getting-started/first-app)，瞭解產生的專案和第一個 API。
