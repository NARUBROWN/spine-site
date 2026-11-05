# 当前版本

::: warning v0.7.0 Preview 输入 API 迁移
本页现有 API 说明和示例以稳定版 `v0.6.5` 为基准。从 `v0.7.0-preview.1` 起，可按输入来源使用独立的 Path、Query 和 Header DTO。`query.Values`、`header.Values` 及其构造和读取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均标记为 Deprecated。

新的 DTO 方式不能直接用于 `v0.6.5`。在 Preview 中，同一处理器混用新 DTO 和 Deprecated 输入也会在启动时被拒绝。现有请求体 DTO 和上下文仍可与任一方式一起使用。

适用版本和迁移示例见 [Preview 处理器输入迁移](/zh-Hans/learn/migration/v0.7.0-preview)，规范选项见 [运行时 OpenAPI](/zh-Hans/reference/api/openapi)。
:::

常规安装使用 `@latest`。当前文档以 Spine v0.6.5 和 CLI v0.4.2 为基准。使用 `spine version` 检查 CLI，在生成的 `go.mod` 中确认实际依赖。

## Preview CLI @preview {#cli-preview-branch}

CLI 与新应用的依赖可以跟随 Preview 分支。CLI 使用 `@preview` 安装，新应用使用 `platform-contracts-preview` 配方。生成和 `spine update` 解析核心及所选平台的 `@preview`，并将实际版本记录在 `go.mod` 中。现有按版本命名的配方在明确修改前保持固定版本。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

## Spine CLI v0.4.3-preview.3 {#cli-preview}

Preview CLI `v0.4.3-preview.3` 生成的新项目使用 `platform-contracts-v0.7.0-preview.2` 配方。核心使用 `v0.7.0-preview.2`，Echo、Gorilla、Kafka、RabbitMQ 和 playground 仅在选中时使用 `v0.2.0-preview.1`。

仅安装 CLI 不会更改现有应用的配方，也不会启用 Swagger UI 或 ReDoc。现有 Preview 1 和稳定版配方在明确修改前保持原有版本固定。

请参阅 [Preview 安装](/zh-Hans/learn/getting-started/installation#preview-cli)、[现有应用迁移](/zh-Hans/learn/migration/v0.7.0-preview)、[CLI 标签](https://github.com/NARUBROWN/spine-cli/tree/v0.4.3-preview.3)和[三个操作系统的发布验证](https://github.com/NARUBROWN/spine-cli/actions/runs/41971655264)。

## Spine v0.7.0-preview.2 {#spine-preview-ui}

核心 `v0.7.0-preview.2` 通过 `boot.OpenAPIOptions.UI` 提供可选的 Swagger UI 与 ReDoc。UI 资源和许可证声明内嵌于二进制中。默认路径为 `/docs` 与 `/redoc`，各 UI 均可设置 `Path` 和 `Title`。

运行时 OpenAPI JSON 从 `v0.7.0-preview.1` 起可用，`UI` 注册选项与两个内嵌 UI 包从 `v0.7.0-preview.2` 起可用。HTTP 请使用 Echo `v0.2.0-preview.1`，并与稳定版 `v0.6.5` 区分选择。

```bash
go get github.com/NARUBROWN/spine@v0.7.0-preview.2 github.com/NARUBROWN/spine-echo-platform@v0.2.0-preview.1
```

请参阅 [启动选项](/zh-Hans/reference/api/openapi#options)、[UI 注册与运行示例](/zh-Hans/reference/api/openapi#tools)和[核心标签](https://github.com/NARUBROWN/spine/tree/v0.7.0-preview.2)。

## Spine v0.7.0-preview.1 {#spine-preview}

已发布的 Preview 标签为核心 `v0.7.0-preview.1`，以及各独立平台和 playground 的 `v0.2.0-preview.1`。请与稳定文档基准 `v0.6.5` 区分并明确选择。

此 Preview 提供按来源分离的 Path、Query 和 Header DTO，将旧输入 API 标记为 Deprecated，在启动时拒绝混用，并更改请求体绑定。标准 OpenAPI 需通过 `Enabled: true` 明确启用。

适用版本、兼容范围和用法见 [处理器输入迁移](/zh-Hans/learn/migration/v0.7.0-preview)和 [运行时 OpenAPI 参考](/zh-Hans/reference/api/openapi)。

## Spine v0.6.5 / CLI v0.4.2

HTTP、WebSocket、事件和 DTO 验证的公共契约统一到 `contract/`。通过 `spine.New(...)` 选择独立平台；Kafka/RabbitMQ boot 选项已删除。CLI 0.4.2 生成实现选择和 v0.6.5 配方。

[选择平台与 DTO 验证](/zh-Hans/learn/getting-started/platforms)

## Spine v0.6.0

Spine v0.6.0 的公开 API 和运行时提供以下功能。

- 分离 HTTP 契约与 Echo 实现，通过 `spine-echo-platform` 创建 HTTP 应用
- CLI `v0.4.0` 的默认 `new` 完成平台安装、静态契约检查和构建

- 包含 `BeforeResponse` 的四阶段拦截器，以及在发送前完成准备的 HTTP 响应
- 无需连接网络即可检查配置，并返回结构化 `boot.ConfigError` 的 `App.Validate`
- 使用 `InterceptorFor` 指定 HTTP 和 WebSocket 拦截器的适用范围
- Kafka 的 TLS 和消费者重试配置、ACK/NACK 失败后重建读取器，以及安全关闭
- RabbitMQ 的加密连接、持久消息发布确认、prefetch、失败策略和 DLX
- WebSocket 的同源检查、受信任代理配置、连接数限制和升级前认证
- 严格验证携带凭据的 CORS 请求和 Cookie 配置
- 启动时的就绪检查，以及按规定顺序关闭
- 安全的 DI 单例解析、路由器回退处理和参数转换

生产环境的默认值和限制请参阅[安全配置](/zh-Hans/reference/security-configuration)。

## Spine CLI v0.4.1

官方安装路径为 `github.com/NARUBROWN/spine-cli/cmd/spine`，调用命令为 `spine`。此补丁新增既有应用迁移指南，以及离线契约检查所需的模块缓存准备步骤；CLI v0.4.0 的命令和生成行为保持不变。

- [CLI v0.4.1 发布说明](https://github.com/NARUBROWN/spine-cli/releases/tag/v0.4.1)
- [既有应用迁移指南](https://github.com/NARUBROWN/spine-cli/blob/v0.4.1/migration/v0.4.0.md)

## Spine CLI v0.4.0

CLI v0.4.0 支持 Spine v0.6.0、Echo 平台 v0.1.0 和 HTTP 适配器 v2 契约。

- [安装 CLI](/zh-Hans/learn/getting-started/installation)
- [创建第一个应用](/zh-Hans/learn/getting-started/first-app)
