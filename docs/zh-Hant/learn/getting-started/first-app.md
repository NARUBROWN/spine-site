# 第一個應用程式

安裝 Spine CLI、產生專案，並在約 5 分鐘內執行 `GET /health`。需要 Go 1.25.5 或更新版本，CLI 建議使用 Go 1.27.3。首次下載相依套件所需的時間取決於環境。

## 1. 安裝並檢查 CLI

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version` 會輸出 `spine-cli 0.1.4`。如果找不到命令，請參考[安裝指南](/zh-Hant/learn/getting-started/installation)設定 Go 執行檔路徑。

## 2. 建立專案

在準備存放專案的上層目錄中執行：

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
go mod tidy
```

CLI 在 `go.mod` 中指定 Spine `v0.5.1`，使用 `go mod tidy` 準備相依套件。

## 3. 查看產生的結構

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/application/
    ├── application.go
    └── application_test.go
```

`spine.toml` 告訴 CLI 模組路徑、執行進入點和註冊程式碼的位置。

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` 中的 `BuildApplication()` 負責組裝應用程式和啟動選項。產生的程式碼註冊 `HealthController` 建構子與 `GET /health`，並明確設定 `boot.HTTPOptions`。將路由、建構子和攔截器註冊集中在此函式中，或集中在它呼叫的 `Register(app) error` 函式中。

`main.go` 已經產生，無須覆寫。可以查看它的執行流程：

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

## 4. 驗證契約與本機程式碼

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` 診斷工具與專案設定，`inspect` 顯示已註冊的執行契約。`contract check` 驗證靜態契約，`verify` 執行契約、gofmt、vet 與 test 檢查。產生的 `application_test.go` 也會在不啟動伺服器的情況下檢查 `BuildApplication()` 與 `app.Validate(options)`。

## 5. 執行並確認回應

```bash
spine dev
```

在另一個終端機中傳送請求：

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

按 `Ctrl+C` 停止開發伺服器。至此，你已確認 CLI 產生的專案、可重複使用的應用程式組裝函式、靜態契約檢查和實際 HTTP 回應。

## 後續步驟

- [專案結構](/zh-Hant/learn/tutorial/1-project-structure) — 向產生的專案加入功能
- [控制器](/zh-Hant/learn/tutorial/2-controller) — 查看 CLI 產生的路由和處理函式
- [資料庫](/zh-Hant/learn/tutorial/5-database) — 為儲存庫連接 Bun ORM
