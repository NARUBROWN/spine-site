# 第一个应用

安装 Spine CLI、生成项目，并在约 5 分钟内运行 `GET /health`。需要 Go 1.25.5 或更高版本，CLI 推荐 Go 1.27.3。首次下载依赖所需的时间取决于环境。

## 1. 安装并检查 CLI

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version` 输出 `spine-cli 0.1.4`。如果找不到命令，请参考[安装指南](/zh-Hans/learn/getting-started/installation)配置 Go 可执行文件路径。

## 2. 创建项目

在准备存放项目的父目录中运行：

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
go mod tidy
```

CLI 在 `go.mod` 中指定 Spine `v0.5.1`，使用 `go mod tidy` 准备依赖。

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

`spine.toml` 告诉 CLI 模块路径、运行入口和注册代码的位置。

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` 中的 `BuildApplication()` 负责组装应用和启动选项。生成代码注册 `HealthController` 构造函数与 `GET /health`，并明确设置 `boot.HTTPOptions`。将路由、构造函数和拦截器注册集中在该函数中，或集中在它调用的 `Register(app) error` 函数中。

`main.go` 已生成，无需覆盖。可以查看它的执行流程：

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

## 4. 验证契约与本地代码

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` 诊断工具和项目配置，`inspect` 显示已注册的执行契约。`contract check` 验证静态契约，`verify` 执行契约、gofmt、vet 和 test 检查。生成的 `application_test.go` 也会在不启动服务器的情况下检查 `BuildApplication()` 和 `app.Validate(options)`。

## 5. 运行并确认响应

```bash
spine dev
```

在另一个终端中发送请求：

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

按 `Ctrl+C` 停止开发服务器。至此，你已确认 CLI 生成的项目、可复用的应用组装函数、静态契约检查和实际 HTTP 响应。

## 后续步骤

- [项目结构](/zh-Hans/learn/tutorial/1-project-structure) — 向生成的项目添加功能
- [控制器](/zh-Hans/learn/tutorial/2-controller) — 查看 CLI 生成的路由和处理函数
- [数据库](/zh-Hans/learn/tutorial/5-database) — 为仓储连接 Bun ORM
