# 專案結構

使用預設 layered-v1 配置分開組裝、HTTP 控制器與啟動程式碼。新程式碼使用目前的路由註冊 API。

## 建立專案

使用 Spine CLI `v0.4.4` 建立應用程式。請在產生的 `go.mod` 中確認核心與平台版本。

```sh
spine new my-app --module example.com/my-app --channel main --validator playground --no-interactive
cd my-app
spine doctor
spine inspect
```

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

## 啟動與組裝

以下三個檔案展示最小職責分離。取代對應產生檔案，不要重複加入型別或註冊。main 呼叫組裝、Validate、Run，BuildApplication 不啟動伺服器。

```go
// main.go
package main

import (
	"example.com/my-app/internal/application"
	"log"
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

```go
// src/controller/health_controller.go
package controller

import (
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func (*HealthController) Constructor() *HealthController { return &HealthController{} }
func (*HealthController) RegisterRoutes(r *api.Registry) {
	r.GET("/health", func() httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
	})
}
```

```go
// internal/application/application.go
package application

import (
	"example.com/my-app/src/controller"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&controller.HealthController{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
```

## 使用產生器加入功能

```sh
spine generate resource user --dry-run
spine generate resource user
spine --help
```

預設 layered-v1 的 resource 產生查詢骨架，完整 CRUD、資料庫存取與業務規則須自行實作。不要重複角色註冊，檢查 RegisterRoutes 與 Constructor 角色。各配置支援的產生器可透過 spine --help 查看。

## 驗證與執行

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

預期回應為 {"status":"ok"}。contract check 檢查靜態契約，verify 還檢查格式、vet 與 Go 測試。app.Validate 不證明建構函式執行或外部連線成功，HTTP 與外部資源須用實際請求驗證。

## 下一步

[控制器](/zh-Hant/learn/tutorial/2-controller) / [DI](/zh-Hant/learn/tutorial/3-dependency-injection) / [攔截器](/zh-Hant/learn/tutorial/4-interceptor)
