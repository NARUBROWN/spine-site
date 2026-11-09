# 简介

Spine 是通过 Go 代码配置构造函数、路由和拦截器的后端框架。在 `v0.7.1` 中，控制器注册自己的 HTTP 路由，处理器签名描述输入来源和响应类型。

## 配置并运行应用

以下独立应用配置了注入服务和仓库的控制器。在独立 Go 模块中安装 Spine `v0.7.1` 和兼容 Echo 平台，保存为 `main.go` 并运行 `go run .`。

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

在另一个终端发送请求会返回 `hello`。CLI 生成的项目将应用配置集中在 `BuildApplication()`，并由 `main.go` 验证和运行。

```bash
curl http://localhost:8080/greeting
```

## 核心概念

### 构造函数和依赖

在 `Constructor` 方法中声明所需类型，并通过 `constructor.Repository`、`constructor.Service`、`constructor.Controller` 注册。容器按类型而非注册顺序解析依赖。现有构造函数也继续受支持。

### 路由与输入

在 `RegisterRoutes` 中通过 `api.Registry` 注册路径和回调。`input.Path[T]`、`input.Query[T]`、`input.Body[T]` 表示输入来源，请求头使用独立的带标签结构体。现有 `app.Route` 为兼容性保留，但已弃用。

### 拦截器与响应

拦截器在处理器前后执行认证、日志和事务等通用工作。成功响应可使用 `httpx.Response[T]`，失败可返回 `error`。如果认证必须在请求体绑定前执行，请确认全局拦截器的执行时机。

### 平台

HTTP 可以选择 Echo 或 net/http 实现。WebSocket、事件代理和 validator 也通过独立平台连接。

## 开始使用

完成[安装](/zh-Hans/learn/getting-started/installation)后，在[第一个应用](/zh-Hans/learn/getting-started/first-app)中创建 CLI 项目并确认响应。可继续阅读[控制器](/zh-Hans/learn/tutorial/2-controller)、[依赖注入](/zh-Hans/learn/tutorial/3-dependency-injection)和[拦截器](/zh-Hans/learn/tutorial/4-interceptor)。
