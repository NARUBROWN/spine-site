# 安装

安装 Spine CLI，并在 CLI 生成的项目中开始开发。本指南使用 Spine CLI **0.1.4**，生成的项目依赖 Spine **v0.5.1**。

## 要求

- Go **1.25.5 或更高版本**。CLI 推荐且已验证的版本为 **1.27.3**。
- 将 Go 可执行文件的安装目录加入 `PATH`。如果未设置 `GOBIN`，默认目录为 `$(go env GOPATH)/bin`。

```bash
go version
```

## 安装 CLI

本站使用 `spine` 命令。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

安装后如果找不到 `spine`，且未设置 `GOBIN`，请在当前Bash或Zsh会话中加入默认的二进制目录。要在后续会话中生效，请将同一设置保存到shell启动文件。设置了 `GOBIN` 时，应改为加入该目录。

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

版本输出为 `spine-cli 0.1.4`。

## 生成项目

在准备存放项目的父目录中运行：

```bash
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
```

CLI 在 `go.mod` 中指定 Spine `v0.5.1`，使用 `go mod tidy` 准备依赖。

生成的 `spine.toml` 如下：

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go` 中的 `BuildApplication()` 注册组件和 `GET /health`。生成的 `main.go` 调用此函数，通过 `app.Validate(options)` 后再执行 `app.Run(options)`。

## 验证并运行

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` 诊断工具和项目配置，`inspect` 显示已注册的执行契约。`contract check` 验证静态契约，`verify` 执行契约、gofmt、vet 和 test 检查。生成的 `application_test.go` 也会在不启动服务器的情况下检查 `BuildApplication()` 和 `app.Validate(options)`。

检查通过后运行 `spine dev`，再从另一个终端检查实际 HTTP 响应。

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

响应为 `{"status":"ok"}`。按 `Ctrl+C` 停止开发服务器。本地验证与外部数据库、broker 或部署环境的 E2E 验证需要分别确认。

## 后续步骤

继续阅读 [5 分钟快速入门 →](/zh-Hans/learn/getting-started/first-app)，了解生成的项目和第一个 API。
