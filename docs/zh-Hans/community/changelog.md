# 当前版本

本文档站点以 Spine v0.5.1 和 Spine CLI v0.1.4 为基准。

## Spine v0.5.1

Spine v0.5.1 的公开 API 和运行时提供以下功能。

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

## Spine CLI v0.1.4

安装和项目创建示例以 Spine CLI v0.1.4 为基准。此版本的 CLI 会创建使用 Spine v0.5.1 的项目。

- [安装 CLI](/zh-Hans/learn/getting-started/installation)
- [创建第一个应用](/zh-Hans/learn/getting-started/first-app)
