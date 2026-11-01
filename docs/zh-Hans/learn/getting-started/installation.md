# 安装

安装 Spine CLI 后，创建新项目并确认开发服务器的响应。本文以 Spine CLI 0.1.4 及其生成的 Spine v0.5.1 项目为准。

## 环境要求

- 需要 Go 1.25.5 或更高版本。CLI 推荐使用 Go 1.27.3。
- Go 可执行文件的安装路径必须包含在 `PATH` 中。如果未设置 `GOBIN`，默认路径为 `$(go env GOPATH)/bin`。

```bash
go version
```

确认输出的 Go 版本为 1.25.5 或更高版本。

## 安装 CLI

运行以下命令安装 CLI 并查看版本。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

如果 `spine version` 输出 `spine-cli 0.1.4`，则表示安装完成。

如果找不到 `spine` 命令，且未单独设置 `GOBIN`，请在 Bash 或 Zsh 中运行以下命令，将安装路径添加到当前会话中。要持久保存此设置，请将相同配置写入 Shell 启动文件。如果已设置 `GOBIN`，则应添加该目录。

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

## 创建新项目

在准备存放项目的父目录中运行。如果已存在同名的 `my-app` 目录，请使用其他名称。

```bash
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
```

项目文件会生成在 `my-app` 目录中。CLI 在 `go.mod` 中指定 Spine `v0.5.1`，`go mod tidy` 会下载所需的依赖。

生成的 `spine.toml` 如下。

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` 中的 `BuildApplication()` 注册组件和 `GET /health`。生成的 `main.go` 调用此函数，通过 `app.Validate(options)` 验证配置后，再通过 `app.Run(options)` 运行服务器。

## 验证与运行

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

确认每条命令均执行完毕且没有错误。

| 命令 | 检查内容 |
| --- | --- |
| `spine doctor` | Go 工具和项目配置 |
| `spine inspect` | 代码中注册的路由、依赖等应用配置 |
| `spine contract check` | 从注册代码中提取的执行契约是否有效 |
| `spine verify` | 执行契约以及 `gofmt`、`go vet` 和 Go 测试的结果 |

生成的 `application_test.go` 会检查 `BuildApplication()` 和 `app.Validate(options)`，不会启动服务器。此阶段验证的是代码和应用配置，实际 HTTP 响应将在下一步确认。

检查通过后，使用 `spine dev` 运行服务器，并在另一个终端中确认实际 HTTP 响应。

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

如果返回 `{"status":"ok"}`，则表示开发服务器已处理请求。在运行服务器的终端中按 `Ctrl+C` 结束运行。连接外部数据库或消息代理，或部署应用后，还需要在相应环境中确认运行情况。

## 后续步骤

通过[第一个应用](/zh-Hans/learn/getting-started/first-app)了解生成文件的作用，或按照[项目结构](/zh-Hans/learn/tutorial/1-project-structure)添加功能。
