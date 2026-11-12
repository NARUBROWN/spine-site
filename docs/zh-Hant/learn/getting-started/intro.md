# 介紹

Spine 是透過 Go 程式碼組裝角色建構器、控制器路由與攔截器的後端框架。

## 執行範例

```sh
go mod init example.com/spine-intro
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

使用 Go 1.26 以上版本儲存為 main.go 並執行 go run .，另一個終端執行 curl `http://localhost:8080/greeting` 回傳 hello。

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
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Service(&Service{}), constructor.Repository(&Repository{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
func main() {
	app, options, err := BuildApplication()
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

## 統一開發方式

在 BuildApplication 選擇平台、驗證器並註冊角色。Constructor 按型別解析 DI，RegisterRoutes 宣告 HTTP 路由。input.Path、Query、Header、Body 宣告輸入來源。已註冊驗證器自動檢查標籤，成功使用 httpx 回應，失敗使用 error。

## 開始使用

[安裝](/zh-Hant/learn/getting-started/installation) / [第一個應用](/zh-Hant/learn/getting-started/first-app) / [控制器](/zh-Hant/learn/tutorial/2-controller)
