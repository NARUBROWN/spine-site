# 安装与首个应用

::: info 0.7.5 API
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

分别选择 CLI 安装通道和应用依赖通道。本指南使用 0.7.5 API 的 Preview 应用。稳定版选择参见[发布通道](/zh-Hans/community/release-channels)。

## 要求

使用 Go 1.26 以上版本并检查所选模块的 go 指令。将 GOBIN 或默认 GOPATH/bin 加入 PATH。

```sh
go version
```

## 安装 Preview CLI {#preview-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

preview 是移动分支，复现时记录版本和提交并使用固定标签。稳定 CLI 使用 @latest 安装。spine update 更新应用依赖，不更新 CLI 或应用源码。

## 创建项目

```sh
spine new my-app --module example.com/my-app --channel preview --validator playground --no-interactive
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
