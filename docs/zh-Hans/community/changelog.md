# 当前版本

## Spine v0.5.1

本网站说明 Spine v0.5.1 当前的公开 API 与运行时行为。

- 包含 `BeforeResponse` 的四阶段拦截器与预备 HTTP 响应
- 返回结构化 `boot.ConfigError` 的无网络 `App.Validate` 检查
- 通过 `InterceptorFor` 限定 HTTP/WebSocket 拦截器范围
- Kafka TLS、有界消费者重试、ACK/NACK 失败后的 reader 重建与安全关闭
- RabbitMQ 安全传输、持久化确认发布、prefetch、失败策略与 DLX
- WebSocket 同源检查、可信代理、连接容量与 upgrade 前认证
- 严格验证带凭据的 CORS 与 Cookie
- bootstrap readiness 检查与确定性关闭
- 安全的 DI 单例解析、路由回退与参数转换

生产配置请参阅[安全配置](/zh-Hans/reference/security-configuration)。
