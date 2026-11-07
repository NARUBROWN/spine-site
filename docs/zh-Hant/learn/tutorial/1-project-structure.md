# 專案結構

::: warning Preview
本頁包含穩定版 `v0.6.5` 範例。Preview 中的 `app.Route` 已標記為 Deprecated。請參閱[控制器與路由遷移](/zh-Hant/learn/migration/preview-controller-routes)。
:::

透過 Spine CLI 建立專案並新增使用者資源。閱讀產生的檔案，了解應用程式設定程式碼應放置的位置，以及控制器、服務與儲存庫各自的職責。

請先完成 [CLI 安裝](/zh-Hant/learn/getting-started/installation)。本教學使用依功能劃分的套件，因此請在新目錄中以 `--layout legacy` 建立 `my-app`。它與[第一個應用程式](/zh-Hant/learn/getting-started/first-app)的預設 `layered-v1` 結構不同，不會自動轉換既有應用程式。

## 透過 CLI 建立專案

在預計放置專案的上層目錄執行。若已有同名的 `my-app` 目錄，請使用其他名稱。

```sh
spine version
spine new my-app --layout legacy --module example.com/my-app
cd my-app
spine doctor
spine inspect
```

`my-app` 目錄會建立完成，相依套件也會準備就緒。`doctor` 會診斷工具與專案設定，而 `inspect` 可用來確認預設路徑 `GET /health` 已註冊。

## 產生的基本結構

上述 `new` 指令會建立包含 `go.sum` 的專案檔案，並完成相依套件安裝與建置。

```text
my-app/
├── .gitignore
├── README.md
├── go.mod
├── go.sum
├── main.go
├── spine.toml
└── internal/
    └── application/
        ├── application.go
        └── application_test.go
```

## CLI 設定

`spine.toml` 設定模組、進入點、應用程式組裝位置、連接埠、布局與平台。資料庫、驗證等應用程式設定應另外管理。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "legacy"
platform = "echo"
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
```

| 鍵 | 用途 |
| --- | --- |
| `module` | Go 模組路徑，必須與 `go.mod` 中的模組路徑一致。 |
| `entrypoint` | 要執行或建置的目標 |
| `composition` | 檢查應用程式設定及自動註冊產生的程式碼的位置 |
| `port` | 開發伺服器使用的連接埠 |
| `layout` | 產生器檔案布局（`legacy` 或 `layered-v1`） |
| `platform` | HTTP 平台（`echo` 或 `none`） |
| `recipe` | 選擇相容相依套件組合的配方 |
| `websocket_platform` | WebSocket 實作（`none` 或 `gorilla`） |
| `validator` | DTO 驗證器（`none` 或 `playground`） |
| `event_platforms` | 選取的事件平台名稱與種類 |

## 分開處理執行與應用程式設定

`main.go` 會呼叫應用程式設定函式，驗證設定後啟動伺服器。建構函式、路由與攔截器則註冊在 `internal/application/application.go` 的 `BuildApplication` 中。

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

`BuildApplication` 會回傳應用程式與執行選項，不會啟動伺服器。產生的程式碼會註冊預設 HTTP 路徑 `GET /health`。

```go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
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
    app := spine.New(echoplatform.Option())
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## 透過 CLI 新增功能

在專案根目錄產生使用者資源。若已在現有專案中產生過，請略過此指令。

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

指令執行完畢後，`src/user` 會產生四個檔案。CLI 預設會將下列註冊程式碼加入 `BuildApplication`。請確認產生的結果，勿再手動註冊相同的程式碼。

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go` 會註冊建構函式與 `GET /user/:id`。其餘檔案的用途如下。

| 檔案 | 用途 |
| --- | --- |
| `user_controller.go` | 接收 HTTP 請求、傳遞給服務，並回傳回應。 |
| `user_service.go` | 處理商業邏輯。 |
| `user_repository.go` | 負責資料存取。 |

資源產生器只會產生回傳 ID 的 GET 處理器基本程式碼。資料庫模型與永久儲存資料的功能，都需要自行實作。

若需要具有型別的建立與查詢範例，請使用不同的名稱執行 `spine generate slice order --storage memory --field name:string`。此指令的記憶體儲存庫供開發使用，應用程式結束後資料就會消失。

## 註冊規則與驗證

為了讓 CLI 能檢查註冊程式碼，請保留位於 `BuildApplication() (spine.App, boot.Options, error)` 函式本體最外層的 `app := spine.New(echoplatform.Option())`。請勿將註冊程式碼移入條件判斷、迴圈或任意輔助函式中。也必須檢查並回傳 `Register(app)` 所回傳的錯誤。

檢查應用程式設定後，再啟動伺服器。

```sh
spine contract check
spine verify
spine dev
```

`contract check` 會檢查從註冊程式碼擷取的執行契約。`verify` 會檢查契約，並執行 `gofmt`、`go vet` 與 Go 測試。兩個指令都執行完畢且未發生錯誤後，`dev` 會啟動開發伺服器。實際 HTTP 行為，以及外部資料庫、訊息代理程式的連線，必須另外在執行環境確認。

## 下一步

- [控制器](/zh-Hant/learn/tutorial/2-controller)
- [相依性注入](/zh-Hant/learn/tutorial/3-dependency-injection)
- [攔截器](/zh-Hant/learn/tutorial/4-interceptor)
