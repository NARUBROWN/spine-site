# 项目结构

使用默认 layered-v1 布局分离组装、HTTP 控制器和启动代码。新代码使用当前路由注册 API。

## 创建项目

使用 Spine CLI `v0.4.4` 创建应用。请在生成的 `go.mod` 中确认核心和平台版本。

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

## 启动与组装

以下三个文件展示最小职责分离。替换对应生成文件，不要重复添加类型或注册。main 调用组装、Validate、Run，BuildApplication 不启动服务器。

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
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type HealthController struct{}

func (*HealthController) Constructor() *HealthController { return &HealthController{} }
func (*HealthController) RegisterRoutes(r *api.Registry) {
	r.GET("/health", func(ctx spinectx.Ctx) httpx.Response[map[string]string] {
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

## 使用生成器添加功能

```sh
spine generate resource user --dry-run
spine generate resource user
spine --help
```

默认 layered-v1 的 resource 生成查询骨架，完整 CRUD、数据库访问和业务规则须自行实现。不要重复角色注册，检查 RegisterRoutes 和 Constructor 角色。各布局支持的生成器可通过 spine --help 查看。

## 验证与运行

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

预期响应为 {"status":"ok"}。contract check 检查静态契约，verify 还检查格式、vet 和 Go 测试。app.Validate 不证明构造函数执行或外部连接成功，HTTP 和外部资源须用实际请求验证。

## 下一步

[控制器](/zh-Hans/learn/tutorial/2-controller) / [DI](/zh-Hans/learn/tutorial/3-dependency-injection) / [拦截器](/zh-Hans/learn/tutorial/4-interceptor)
