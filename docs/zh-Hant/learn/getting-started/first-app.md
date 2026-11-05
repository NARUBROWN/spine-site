# 第一個應用程式

透過 Spine CLI 建立新專案，並確認 `GET /health` 會回傳 `{"status":"ok"}`。閱讀產生的檔案，同時了解設定、驗證到執行應用程式的流程。

需要 Go 1.25.5 以上版本，CLI 建議使用 Go 1.27.3。首次下載相依套件所需的時間會因環境而異。

## 1. 安裝 CLI 並確認指令

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

使用 v0.7.0 Preview 時，請先依 [Preview CLI 安裝說明](/zh-Hant/learn/getting-started/installation#preview-cli)安裝 `v0.4.3-preview.3`。本頁的 `spine.toml` 範例使用穩定版配方，Preview CLI 的新專案使用 `platform-contracts-v0.7.0-preview.2`。

使用 `spine version` 確認已安裝的 CLI 版本。 若找不到指令，請在[安裝說明](/zh-Hant/learn/getting-started/installation)中檢查 PATH 設定。

## 2. 建立專案

在預計放置專案的上層目錄執行。若已有 `hello-spine` 目錄，請使用其他名稱。

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
```

`new` 依照已安裝 CLI 的驗證配方選擇相容的 Spine、Echo 平台與 Echo 版本，並完成相依套件安裝、靜態契約檢查與建置。請在產生的 `go.mod` 中查看選取的版本。使用 `--skip-install` 時，請另外執行 `go mod tidy` 與 `go mod download all`。安裝過程不會初始化應用程式、執行測試或啟動監聽器。

## 3. 確認產生的結構

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── go.sum
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    ├── controller/health_controller.go
    └── route/route.go
```

專案包含作為執行起點的 `main.go`，以及存放應用程式設定程式碼的 `internal/application` 目錄。`spine.toml` 會告知 CLI 模組路徑、執行進入點、應用程式設定程式碼的位置與連接埠。

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
```

`internal/application/application.go` 中的 `BuildApplication()` 會回傳應用程式與執行選項。產生的程式碼會註冊 `HealthController` 建構函式與 `GET /health`，並明確指定 HTTP 執行選項 `boot.HTTPOptions`。

新增功能時，請將路由、建構函式與攔截器的註冊程式碼集中放在此函式，或此處呼叫的 `Register(app) error` 函式中。詳細方式請參閱[專案結構](/zh-Hant/learn/tutorial/1-project-structure)。

`main.go` 已經產生，無需修改。請透過下列程式碼確認應用程式的設定、驗證與執行順序。

```go
func main() {
    app, options, err := application.BuildApplication()
    if err != nil {
        log.Fatal(err)
    }
    if err := app.Validate(options); err != nil {
        log.Fatal(err)
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

## 4. 驗證應用程式設定與程式碼

在建立的專案根目錄執行。

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` 會診斷工具與專案設定。`inspect` 會顯示程式碼中註冊的路由與相依性等應用程式設定。CLI 從註冊程式碼擷取的這些資訊稱為執行契約。

`contract check` 會檢查執行契約，`verify` 除了檢查契約，還會執行 `gofmt`、`go vet` 與 Go 測試。產生的 `application_test.go` 也會在不啟動伺服器的情況下，檢查 `BuildApplication()` 與 `app.Validate(options)`。若所有指令都執行完畢且未發生錯誤，就可以啟動伺服器。

## 5. 執行並確認回應

```bash
spine dev
```

伺服器執行時，開啟另一個終端機發送請求。

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

若回傳上述 JSON 回應，表示 `GET /health` 已正常運作。在執行伺服器的終端機按下 `Ctrl+C`，即可結束開發伺服器。

## 下一步

- 依照[專案結構](/zh-Hant/learn/tutorial/1-project-structure)，在產生的專案中新增功能。
- 透過[控制器](/zh-Hant/learn/tutorial/2-controller)了解路由與處理器。
- 依照[資料庫](/zh-Hant/learn/tutorial/5-database)，將 Bun ORM 連接至儲存庫。
