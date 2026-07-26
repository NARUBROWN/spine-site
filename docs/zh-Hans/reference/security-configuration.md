# 安全配置参考

Spine 使用加密传输和有界运行时默认值。部署检查应调用 `App.Validate`；`App.Run` 会自动执行同一套无网络预检。

## 默认值

| 领域 | 默认行为 | 显式开发或兼容选项 |
|---|---|---|
| Kafka | 每个启用的 reader/writer 使用隐式 TLS 1.2 以上 | 自定义 `TLS`/`Dialer`/`Transport`，或仅本地使用 `AllowInsecureTransport: true` |
| RabbitMQ | 要求 `amqps://` | `amqp://` 配合 `AllowInsecureTransport: true` |
| RabbitMQ 发布 | 持久消息、强制路由、publisher confirms、有界重试 | 调整 `PublisherRetry` |
| RabbitMQ 处理器失败 | 拒绝且不重新入队 | `FailurePolicy: boot.RabbitMqFailureRequeue` |
| RabbitMQ prefetch | 每个消费者 1 条未确认消息 | 正数 `PrefetchCount` |
| 消费者传输失败 | 指数退避和抖动后重建 reader | 配置 `ConsumerRetry` |
| WebSocket 来源 | scheme 与 host 必须一致 | 精确 `AllowedOrigins` |
| WebSocket 容量 | 1024 个活动及待处理连接 | 正数限制或 `UnlimitedWebSocketConnections` |
| WebSocket 认证 | `WebSocketHandshakeInterceptor` 在 upgrade 前运行 | 每个受保护 WS 路由实现握手认证 |
| 全局拦截器 | HTTP 与 WebSocket | 用 `InterceptorFor` 缩小范围 |
| 带凭据 CORS | 必须使用明确来源 | 不支持通配来源 |
| Cookie 序列化 | 写响应前拒绝非法字段 | 任意值先用 `EncodeCookieValue` |

## 启动前验证

```go
opts := boot.Options{
	Address: ":8080",
	HTTP: &boot.HTTPOptions{},
}

if err := app.Validate(opts); err != nil {
	var configErr *boot.ConfigError
	if errors.As(err, &configErr) {
		for _, issue := range configErr.Issues {
			log.Printf("%s [%s]: %s", issue.Path, issue.Code, issue.Hint)
		}
	}
	log.Fatal(err)
}
```

`boot.ConfigError.Issues` 中的 `Code` 是稳定的机器可读部署诊断；不要解析面向人的错误文本，也不要在日志中输出代理凭据。

## 运行要求

- 只在隔离的本地环境启用不安全的消息代理传输。
- 为 Spine 消费队列配置 DLX 前，先在 RabbitMQ 中创建相应 dead-letter exchange，并对齐现有队列参数。
- Kafka/RabbitMQ 消费者必须幂等；重连与确认丢失可能导致至少一次重投或重复。
- 启用 `TrustedProxyCIDRs` 时，代理必须移除或覆盖客户端提供的 forwarding headers。
- 监控 `WEBSOCKET_CAPACITY_EXCEEDED`、消费者重连耗尽以及 RabbitMQ `Type`/`RoutingKey` 不一致日志。

支持的版本请参阅[当前版本](/zh-Hans/community/changelog)。
