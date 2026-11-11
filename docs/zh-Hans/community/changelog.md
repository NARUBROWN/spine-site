# 发布说明

当前 API 用法参见 [0.7.5 迁移指南](/zh-Hans/learn/migration/v0.7.5)。下方发布信息与历史记录以各自标签为准。

最新标签和下一目标版本请查看[版本概览](/zh-Hans/community/versions)。

Preview、RC、稳定版的选择与发布流程，请参阅[发布渠道与安装](/zh-Hans/community/release-channels)。

## Spine v0.7.1

Spine `v0.7.1` 提供控制器路由、按角色注册构造函数、按来源划分的 HTTP 输入、运行时 OpenAPI 和 HTTP v3。旧输入 API 保持兼容但已弃用，同一处理器不能混用新旧输入。

请参阅 [v0.7.1 迁移指南](/zh-Hans/learn/migration/v0.7.1)和[运行时 OpenAPI](/zh-Hans/reference/api/openapi)。CLI 版本和应用依赖分别选择。通过 `spine version` 检查 CLI，在 `go.mod` 中确认依赖。以下条目记录各版本的历史情况。

## Preview CLI @preview {#cli-preview-branch}

CLI 可以使用 `@preview` 安装。应用依赖通过 `spine new --channel preview`、`rc` 或 `main` 单独选择。Preview 渠道从所选依赖的移动 `@preview` 分支解析版本。保留应用源码、`go.mod` 和 `go.sum` 以便重现。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

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
