# 專案結構

以 Spine CLI 產生的專案為基礎，將應用程式組裝與功能程式碼分開。請先完成 [CLI 安裝](/zh-Hant/learn/getting-started/installation)。

## 使用 CLI 建立專案

在準備存放專案的上層目錄中執行：

```sh
spine version
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
spine doctor
spine inspect
```

## 產生的結構

`spine new` 產生以下檔案，之後執行 `go mod tidy` 才會建立 `go.sum`。

```text
my-app/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/
    └── application/
        ├── application.go
        └── application_test.go
```

## CLI 設定

`module` 必須與 `go.mod` 一致。`entrypoint` 指定執行和建置的套件，`composition` 指定契約檢查與自動註冊的目標。只支援以下四個設定鍵；資料庫連線等應用設定需另外管理。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

## 分離啟動與應用程式組裝

`main.go` 負責組裝、驗證及執行應用程式。建構函式、路由與攔截器都註冊於 `internal/application/application.go` 的 `BuildApplication`。

```go
package main

import (
    "log"

    "example.com/my-app/internal/application"
)

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

產生的組裝函式會回傳應用程式與執行選項，不會啟動監聽器。預設 HTTP 路由為 `GET /health`。

```go
package application

import (
    "os"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## 使用 CLI 新增功能

在專案根目錄產生使用者資源。資源已存在時請略過此命令。

```sh
spine generate resource user
```

```text
src/user/
├── user_route.go
├── user_repository.go
├── user_service.go
└── user_controller.go
```

預設自動註冊會向 `BuildApplication` 加入以下程式碼。請檢查產生結果，避免手動重複註冊。

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go` 註冊建構函式與 `GET /user/:id`。控制器處理 HTTP 輸入輸出，服務處理業務邏輯，儲存庫處理資料存取。資源產生器只建立回傳 ID 的 GET 骨架，不實作資料庫模型或持久儲存。若需要具型別的新增與查詢範例，可使用不同名稱：`spine generate slice order --storage memory --field name:string`。記憶體儲存僅供開發，處理程序停止後資料就會消失。

## 註冊規則與驗證

在 `BuildApplication() (spine.App, boot.Options, error)` 的頂層保留 `app := spine.New()`。直接撰寫註冊敘述，不要將其隱藏在條件、迴圈或任意輔助函式中，並檢查及回傳 `Register(app)` 的錯誤。

```sh
spine contract check
spine verify
spine dev
```

`contract check` 檢查靜態契約；`verify` 檢查契約、gofmt、vet 與 Go 測試。資料庫、訊息代理連線及實際 HTTP 行為需另外驗證。

## 下一步

- [控制器](/zh-Hant/learn/tutorial/2-controller)
- [依賴注入](/zh-Hant/learn/tutorial/3-dependency-injection)
- [攔截器](/zh-Hant/learn/tutorial/4-interceptor)
