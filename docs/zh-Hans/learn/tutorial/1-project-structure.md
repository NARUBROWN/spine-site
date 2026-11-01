# 项目结构

以 Spine CLI 生成的项目为基础，将应用组装与功能代码分开。请先完成 [CLI 安装](/zh-Hans/learn/getting-started/installation)。

## 使用 CLI 创建项目

在准备存放项目的父目录中运行：

```sh
spine version
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
spine doctor
spine inspect
```

## 生成的结构

`spine new` 生成以下文件，随后执行 `go mod tidy` 才会创建 `go.sum`。

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

## CLI 配置

`module` 必须与 `go.mod` 一致。`entrypoint` 指定运行和构建的包，`composition` 指定契约检查与自动注册的目标。只支持以下四个配置键；数据库连接等应用配置需单独管理。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

## 分离启动与应用组装

`main.go` 负责组装、验证和运行应用。构造函数、路由和拦截器均注册在 `internal/application/application.go` 的 `BuildApplication` 中。

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

生成的组装函数返回应用和运行选项，不会启动监听器。默认 HTTP 路由为 `GET /health`。

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

## 使用 CLI 添加功能

在项目根目录生成用户资源。资源已经存在时请跳过此命令。

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

默认自动注册会向 `BuildApplication` 添加以下代码。请检查生成结果，避免手动重复注册。

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go` 注册构造函数和 `GET /user/:id`。控制器处理 HTTP 输入输出，服务处理业务逻辑，仓储处理数据访问。资源生成器只创建返回 ID 的 GET 骨架，不实现数据库模型或持久化。如需带类型的创建与查询示例，可使用不同名称：`spine generate slice order --storage memory --field name:string`。内存存储仅供开发，进程停止后数据即丢失。

## 注册规则与验证

在 `BuildApplication() (spine.App, boot.Options, error)` 的顶层保留 `app := spine.New()`。直接编写注册语句，不要将其隐藏在条件、循环或任意辅助函数中，并检查和返回 `Register(app)` 的错误。

```sh
spine contract check
spine verify
spine dev
```

`contract check` 检查静态契约；`verify` 检查契约、gofmt、vet 和 Go 测试。数据库、消息代理连接及实际 HTTP 行为需单独验证。

## 下一步

- [控制器](/zh-Hans/learn/tutorial/2-controller)
- [依赖注入](/zh-Hans/learn/tutorial/3-dependency-injection)
- [拦截器](/zh-Hans/learn/tutorial/4-interceptor)
