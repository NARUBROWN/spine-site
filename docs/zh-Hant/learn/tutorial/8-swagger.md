# Swagger 與 OpenAPI

Spine `v0.7.1` 可以根據已註冊的 HTTP 路由產生 OpenAPI JSON，並提供內建 Swagger UI 和 ReDoc。本教學先在獨立應用程式中執行文件與畫面，再使用 CLI 匯出靜態文件。

## 1. 準備應用程式

在獨立 Go 模組中安裝以下正式版相依套件。請保留 `go.mod` 和 `go.sum` 以便重現。

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

將以下程式碼儲存為 `main.go` 並執行 `go run .`。省略 `Enabled` 時自動提供功能關閉；僅提供 JSON 時省略 `UI`。

```go
package main

import (
    "log"

    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }

func (c *Controller) RegisterRoutes(r *api.Registry) {
    r.GET("/hello", func() httpx.Response[string] {
        return httpx.Response[string]{Body: "hello"}
    })
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(constructor.Controller(&Controller{}))

    options := boot.Options{
        Address: ":8080",
        HTTP: &boot.HTTPOptions{
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Title:   "Example API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{}),
                    redoc.New(redoc.Options{}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

## 2. 透過 HTTP 檢查

在另一個終端機請求文件和畫面。三個資源都會回傳 200，也可以在瀏覽器中開啟 `/docs` 或 `/redoc`。

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

文件和畫面不會執行業務攔截器。如需限制存取，請在 HTTP 中介軟體或代理伺服器中設定政策。

## 3. 使用 CLI 匯出靜態文件

在[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中建立的應用程式根目錄執行。此指令分析原始碼而不執行應用程式。使用 `--force` 覆寫既有檔案前，請先檢查檔案內容。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

檢查產生文件中的 `/health` 和 `/user/{id}`。靜態分析無法確定所有動態路由、執行階段 validator 限制或處理器選擇的回應狀態。請查看診斷，並驗證實際請求和執行階段文件。

## 下一步

路徑衝突、validator、文件查詢與 UI 選項請參閱[執行階段 OpenAPI 參考](/zh-Hant/reference/api/openapi)。[輸入移轉指南](/zh-Hant/learn/migration/v0.7.1-preview)說明舊輸入 API 的相容規則。
