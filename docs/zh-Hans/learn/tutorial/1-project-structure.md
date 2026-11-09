# 项目结构

::: info
此示例使用 `legacy` 布局的兼容注册方式。`app.Route` 已弃用，新控制器请参阅[控制器与路由迁移](/zh-Hans/learn/migration/preview-controller-routes)。
:::

使用 Spine CLI 创建项目并添加用户资源。通过阅读生成的文件，了解应用配置代码应放在何处，以及控制器、服务和仓储的作用。

请先完成 [CLI 安装](/zh-Hans/learn/getting-started/installation)。本教程使用按功能划分的包，因此请在新目录中通过 `--layout legacy` 创建 `my-app`。它与[第一个应用](/zh-Hans/learn/getting-started/first-app)的默认 `layered-v1` 结构不同，不会自动转换现有应用。

## 通过 CLI 创建项目

在准备存放项目的父目录中运行。如果已存在同名的 `my-app` 目录，请使用其他名称。

```sh
spine version
spine new my-app --layout legacy --module example.com/my-app --channel main --no-interactive
cd my-app
spine doctor
spine inspect
```

命令会创建 `my-app` 目录并准备依赖。`doctor` 诊断工具和项目配置，`inspect` 可以显示默认路径 `GET /health` 的注册情况。

## 生成的基本结构

上述 `new` 命令会创建包括 `go.sum` 在内的项目文件，并完成依赖安装和构建。

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

## CLI 配置

`spine.toml` 配置模块、入口、应用组装位置、端口、布局和平台。数据库、认证等应用配置应单独管理。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "legacy"
platform = "echo"
recipe = "platform-contracts-preview"
dependency_channel = "main"
websocket_platform = "none"
validator = "none"
frontend_enabled = false
```

| 键 | 作用 |
| --- | --- |
| `module` | Go 模块路径，必须与 `go.mod` 中的模块路径一致。 |
| `entrypoint` | 要运行或构建的目标 |
| `composition` | 检查应用配置并自动注册生成代码的位置 |
| `port` | 开发服务器使用的端口 |
| `layout` | 生成器文件布局（`legacy` 或 `layered-v1`） |
| `platform` | HTTP 平台（`echo`、`nethttp` 或 `none`） |
| `recipe` | 选择兼容依赖组合的配方 |
| `websocket_platform` | WebSocket 实现（`none` 或 `gorilla`） |
| `validator` | DTO 验证器（`none` 或 `playground`） |
| `event_platforms` | 选定的事件平台名称和类型 |

## 分离运行入口与应用配置

`main.go` 调用应用配置函数，验证配置后运行服务器。构造函数、路由和拦截器注册在 `internal/application/application.go` 的 `BuildApplication` 中。

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

`BuildApplication` 返回应用和运行选项，不会启动服务器。生成的代码注册默认 HTTP 路径 `GET /health`。

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
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
```

## 通过 CLI 添加功能

在项目根目录中生成用户资源。如果已有项目中已生成该资源，请跳过此命令。

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

命令执行完毕后，`src/user` 中会生成四个文件。默认情况下，CLI 会将以下注册代码添加到 `BuildApplication` 中。请确认生成结果，不要手动重复注册相同代码。

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go` 注册构造函数和 `GET /user/:id`。其他文件的作用如下。

| 文件 | 作用 |
| --- | --- |
| `user_controller.go` | 接收 HTTP 请求，传递给服务并返回响应。 |
| `user_service.go` | 处理业务逻辑。 |
| `user_repository.go` | 负责数据访问。 |

资源生成器仅生成返回 ID 的 GET 处理器的基础代码。数据库模型和数据持久化功能需要自行实现。

如果需要带有类型的创建和查询示例，请使用其他名称运行 `spine generate slice order --storage memory --field name:string`。该命令使用的内存存储仅用于开发，应用退出后数据会丢失。

## 注册规则与验证

为使 CLI 能够检查注册代码，请将 `app := spine.New(echoplatform.Option())` 保留在 `BuildApplication() (spine.App, boot.Options, error)` 函数体的顶层。不要将注册代码移入条件语句、循环或任意辅助函数中。还必须检查并返回 `Register(app)` 返回的错误。

检查应用配置后，再运行服务器。

```sh
spine contract check
spine verify
spine dev
```

`contract check` 检查从注册代码中提取的执行契约。`verify` 检查契约，并运行 `gofmt`、`go vet` 和 Go 测试。两条命令均执行完毕且没有错误后，`dev` 启动开发服务器。实际 HTTP 行为以及外部数据库、消息代理的连接，需要在运行环境中另行确认。

## 后续步骤

- [控制器](/zh-Hans/learn/tutorial/2-controller)
- [依赖注入](/zh-Hans/learn/tutorial/3-dependency-injection)
- [拦截器](/zh-Hans/learn/tutorial/4-interceptor)
