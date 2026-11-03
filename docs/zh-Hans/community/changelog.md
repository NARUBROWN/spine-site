# 当前版本

常规安装使用 `@latest`。当前文档以 Spine v0.6.5 和 CLI v0.4.2 为基准。使用 `spine version` 检查 CLI，在生成的 `go.mod` 中确认实际依赖。

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
