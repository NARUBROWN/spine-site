# 安裝與第一個應用

使用 Spine CLI `v0.4.4` 建立以核心 `v0.7.5` 執行的 HTTP 應用程式。CLI 安裝通道與應用程式相依套件通道請見[發布通道](/zh-Hant/community/release-channels)。

## 需求

此範例的驗證器需要 Go 1.26 或更新版本。請將 `GOBIN` 或預設的 `GOPATH/bin` 加入 `PATH`。

```sh
go version
```

<span id="preview-cli"></span>

## 安裝正式版 CLI {#install-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

用 `spine version` 確認已安裝的版本。如需重現此 CLI 版本，請在安裝指令中指定 `@v0.4.4`。`spine update` 用於更新應用程式的相依套件。

## 建立專案

```sh
spine new my-app --module example.com/my-app --channel main --validator playground --no-interactive
cd my-app
go list -m all
spine doctor
spine inspect
```

CLI 配方選擇相容版本，請在 go.mod 確認核心 0.7.5 API 與平台組合。預設配置為 layered-v1。--validator playground 在 BuildApplication 組裝驗證器，預設 validator none 不啟用標籤驗證。產生過程不啟動應用資源或監聽器。

```text
my-app/
├── main.go
├── go.mod
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/controller/health_controller.go
```

## 驗證與執行

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

確認 {"status":"ok"}，使用 Ctrl+C 結束。產生的 main 依序呼叫 BuildApplication、app.Validate、app.Run。Validate 不執行建構函式或連接資料庫，還須驗證實際請求。

## 復原依賴中繼資料

--skip-install 或手動修改後若出現 MODULE_GRAPH_UNAVAILABLE，下載模組中繼資料。

```sh
go mod tidy
go mod download all
spine contract check
```

## 下一步

[專案結構](/zh-Hant/learn/tutorial/1-project-structure) / [控制器](/zh-Hant/learn/tutorial/2-controller) / [平台選擇](/zh-Hant/learn/getting-started/platforms)
