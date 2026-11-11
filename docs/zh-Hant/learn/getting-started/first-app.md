# 安裝與第一個應用

::: info 0.7.5 API
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

分別選擇 CLI 安裝通道與應用依賴通道。本指南使用 0.7.5 API 的 Preview 應用。穩定版選擇參見[發布通道](/zh-Hant/community/release-channels)。

## 需求

使用 Go 1.26 以上版本並檢查所選模組的 go 指令。將 GOBIN 或預設 GOPATH/bin 加入 PATH。

```sh
go version
```

## 安裝 Preview CLI {#preview-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

preview 是移動分支，重現時記錄版本與提交並使用固定標籤。穩定 CLI 使用 @latest 安裝。spine update 更新應用依賴，不更新 CLI 或應用原始碼。

## 建立專案

```sh
spine new my-app --module example.com/my-app --channel preview --validator playground --no-interactive
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
