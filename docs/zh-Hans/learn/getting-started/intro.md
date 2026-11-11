# 介绍

Spine 是通过 Go 代码组装角色构造器、控制器路由和拦截器的后端框架。

## 运行示例

```sh
go mod init example.com/spine-intro
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

使用 Go 1.26 以上版本保存为 main.go 并执行 go run .，另一个终端运行 curl `http://localhost:8080/greeting` 返回 hello。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
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
	r.GET("/greeting", func(ctx spinectx.Ctx) httpx.Response[string] {
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

## 统一开发方式

在 BuildApplication 选择平台、验证器并注册角色。Constructor 按类型解析 DI，RegisterRoutes 声明 HTTP 路由。input.Path、Query、Header、Body 声明输入来源。处理器与四个拦截器钩子使用公开 spine.Ctx。已注册验证器自动检查标签，成功使用 httpx 响应，失败使用 error。

## 开始使用

[安装](/zh-Hans/learn/getting-started/installation) / [首个应用](/zh-Hans/learn/getting-started/first-app) / [控制器](/zh-Hans/learn/tutorial/2-controller)
