# 第一个应用

使用 Spine CLI 创建新项目，并确认 `GET /health` 是否返回 `{"status":"ok"}`。通过阅读生成的文件，了解构建、验证并运行应用的流程。

需要 Go 1.25.5 或更高版本，CLI 推荐使用 Go 1.27.3。首次下载依赖所需的时间因环境而异。

## 1. 安装 CLI 并确认命令

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version` 会输出 `spine-cli 0.1.4`。如果找不到命令，请参阅[安装指南](/zh-Hans/learn/getting-started/installation)中的 Go 可执行文件路径设置。

## 2. 创建项目

在准备存放项目的父目录中运行。如果 `hello-spine` 目录已存在，请使用其他名称。

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
go mod tidy
```

项目文件会生成在 `hello-spine` 目录中。CLI 在 `go.mod` 中指定 Spine `v0.5.1`，`go mod tidy` 会下载所需的依赖。

## 3. 查看生成的结构

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/application/
    ├── application.go
    └── application_test.go
```

项目包含作为运行入口的 `main.go`，以及存放应用配置代码的 `internal/application` 目录。`spine.toml` 向 CLI 提供模块路径、运行入口、应用配置代码的位置和端口。

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` 中的 `BuildApplication()` 返回应用和运行选项。生成的代码注册 `HealthController` 构造函数和 `GET /health`，并显式指定 HTTP 运行选项 `boot.HTTPOptions`。

添加功能时，将路由、构造函数和拦截器的注册集中放在此函数中，或放在此函数调用的 `Register(app) error` 函数中。详细方法请参阅[项目结构](/zh-Hans/learn/tutorial/1-project-structure)。

`main.go` 已经生成，无需修改。通过以下代码了解应用构建、验证和运行的顺序。

```go
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

## 4. 验证应用配置和代码

在生成项目的根目录中运行。

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` 诊断工具和项目配置。`inspect` 展示代码中注册的路由、依赖等应用配置。CLI 从注册代码中提取的这些信息称为执行契约。

`contract check` 检查执行契约，`verify` 除检查契约外，还会运行 `gofmt`、`go vet` 和 Go 测试。生成的 `application_test.go` 也会检查 `BuildApplication()` 和 `app.Validate(options)`，不会启动服务器。如果所有命令均执行完毕且没有错误，就可以启动服务器了。

## 5. 运行并确认响应

```bash
spine dev
```

保持服务器运行，打开另一个终端发送请求。

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

如果返回上述 JSON 响应，则表示 `GET /health` 已正常工作。在运行服务器的终端中按 `Ctrl+C` 关闭开发服务器。

## 后续步骤

- 按照[项目结构](/zh-Hans/learn/tutorial/1-project-structure)为生成的项目添加功能。
- 通过[控制器](/zh-Hans/learn/tutorial/2-controller)了解路由和处理器。
- 按照[数据库](/zh-Hans/learn/tutorial/5-database)为仓储连接 Bun ORM。
