# 簡介

Spine 是透過 Go 程式碼設定建構函式、路由和攔截器的後端框架。在 `v0.7.1` 中，控制器註冊自己的 HTTP 路由，處理器簽章描述輸入來源和回應型別。

## 設定並執行應用程式

以下獨立應用程式設定了注入服務和儲存庫的控制器。在獨立 Go 模組中安裝 Spine `v0.7.1` 和相容 Echo 平台，儲存為 `main.go` 並執行 `go run .`。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Repository struct{}

func (*Repository) Constructor() *Repository { return &Repository{} }
func (*Repository) Greeting() string         { return "hello" }

type Service struct{ repository *Repository }

func (*Service) Constructor(repository *Repository) *Service { return &Service{repository: repository} }

type Controller struct{ service *Service }

func (*Controller) Constructor(service *Service) *Controller { return &Controller{service: service} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/greeting", func() httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(
		constructor.Controller(&Controller{}),
		constructor.Service(&Service{}),
		constructor.Repository(&Repository{}),
	)
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

在另一個終端機傳送請求會回傳 `hello`。CLI 產生的專案將應用程式設定集中於 `BuildApplication()`，並由 `main.go` 驗證和執行。

```bash
curl http://localhost:8080/greeting
```

## 核心概念

### 建構函式與相依性

在 `Constructor` 方法中宣告所需型別，並透過 `constructor.Repository`、`constructor.Service`、`constructor.Controller` 註冊。容器依型別而非註冊順序解析相依性。既有建構函式也繼續受到支援。

### 路由與輸入

在 `RegisterRoutes` 中透過 `api.Registry` 註冊路徑和回呼。`input.Path[T]`、`input.Query[T]`、`input.Body[T]` 表示輸入來源，標頭使用獨立的帶標籤結構體。既有 `app.Route` 為相容性保留，但已棄用。

### 攔截器與回應

攔截器在處理器前後執行驗證、日誌和交易等共用工作。成功回應可使用 `httpx.Response[T]`，失敗可回傳 `error`。若驗證必須在請求本文繫結前執行，請確認全域攔截器的執行時機。

### 平台

HTTP 可以選擇 Echo 或 net/http 實作。WebSocket、事件代理和 validator 也透過獨立平台連接。

## 開始使用

完成[安裝](/zh-Hant/learn/getting-started/installation)後，在[第一個應用程式](/zh-Hant/learn/getting-started/first-app)中建立 CLI 專案並確認回應。可繼續閱讀[控制器](/zh-Hant/learn/tutorial/2-controller)、[相依性注入](/zh-Hant/learn/tutorial/3-dependency-injection)和[攔截器](/zh-Hant/learn/tutorial/4-interceptor)。
