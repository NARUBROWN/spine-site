# 安装与首个应用

使用 Spine CLI `v0.4.4` 创建基于核心 `v0.7.5` 的 HTTP 应用。CLI 安装通道和应用依赖通道见[发布通道](/zh-Hans/community/release-channels)。

## 要求

此示例的验证器需要 Go 1.26 或更高版本。请将 `GOBIN` 或默认的 `GOPATH/bin` 添加到 `PATH`。

```sh
go version
```

<span id="preview-cli"></span>

## 安装正式版 CLI {#install-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

用 `spine version` 确认已安装的版本。要复现此 CLI 版本，请在安装命令中指定 `@v0.4.4`。`spine update` 用于更新应用依赖。

## 创建项目

```sh
spine new my-app --module example.com/my-app --channel main --validator playground --no-interactive
cd my-app
go list -m all
spine doctor
spine inspect
```

CLI 配方选择兼容版本，请在 go.mod 确认核心 0.7.5 API 及平台组合。默认布局为 layered-v1。--validator playground 在 BuildApplication 组装验证器，默认 validator none 不启用标签验证。生成过程不启动应用资源或监听器。

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

## 验证与运行

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

确认 {"status":"ok"}，使用 Ctrl+C 退出。生成的 main 依次调用 BuildApplication、app.Validate、app.Run。Validate 不执行构造函数或连接数据库，还须验证实际请求。

## 恢复依赖元数据

--skip-install 或手动修改后若出现 MODULE_GRAPH_UNAVAILABLE，下载模块元数据。

```sh
go mod tidy
go mod download all
spine contract check
```

## 下一步

[项目结构](/zh-Hans/learn/tutorial/1-project-structure) / [控制器](/zh-Hans/learn/tutorial/2-controller) / [平台选择](/zh-Hans/learn/getting-started/platforms)
