# 安全配置

Spine 0.6.5 为 HTTP/WebSocket 设置大小、时间和连接数限制。独立的 Kafka/RabbitMQ 平台负责消息代理传输策略。以下平台默认值以 v0.1.0 为基准。

## 配置验证

`App.Validate` 检查启动选项，不打开网络连接。`App.Run` 也会在启动前执行相同检查。此预先验证不包括构造函数和依赖配置是否成功，以及消息代理能否连接。

```go
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

通过 `*boot.ConfigError.Issues` 检查 boot 配置错误。单独检查外部平台 `NewFactory` 返回的配置错误。使用公开错误和代码分类，不解析消息字符串，也不记录消息代理凭据。

| 字段 | 含义 |
| --- | --- |
| `Path` | 有问题的配置位置 |
| `Code` | 错误分类代码 |
| `Message` | 供人阅读的错误说明 |
| `Hint` | 配置修改方法 |

## 安全默认值

| 领域 | 默认行为 | 调整方式 |
| --- | --- | --- |
| HTTP | 限制读写时间、请求头和请求体大小 | [`boot.HTTPOptions`](/zh-Hans/reference/api/spine-app#boot-options) |
| Kafka | 对已启用的消费者和发布器使用 TLS 1.2 或更高版本 | `TLS`、`Dialer`、`Transport`。本地明文连接使用 `AllowInsecureTransport: true` |
| RabbitMQ 连接 | 必须使用 `amqps://` | 本地明文连接使用 `amqp://` 和 `AllowInsecureTransport: true` |
| RabbitMQ 发布 | persistent / mandatory / publisher confirm | `OperationTimeout` |
| RabbitMQ 处理失败 | 拒绝且不重新入队 | `rabbitmqplatform.Config.FailurePolicy` |
| RabbitMQ 并发处理 | 每个消费者 1 条未确认消息 | 正数 `PrefetchCount` |
| 消费者传输失败 | 使用指数退避和抖动重新创建读取器 | `spine.WithEventConsumerRetry` |
| WebSocket 来源 | 浏览器请求仅允许协议和主机相同的来源 | `AllowedOrigins` |
| WebSocket 连接数 | 连接和等待连接的请求合计 1024 个 | 正数 `MaxConnections` 或 `boot.UnlimitedWebSocketConnections` |
| WebSocket 连接认证 | 仅在升级前执行实现了可选接口的拦截器 | 实现 `core.WebSocketHandshakeInterceptor` |
| 全局拦截器 | 同时应用于 HTTP 和 WebSocket | 通过 `InterceptorFor` 限制范围 |
| 允许凭据的 CORS | 需要明确的来源 | 不能同时使用 `*` 和 `AllowCredentials: true` |
| Cookie | 在写入响应前拒绝无效字段 | 需要保留任意值时使用 `httpx.EncodeCookieValue` |

## Kafka

导入 `kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"`。通过 `Config.Consume` 和 `Config.Publish` 选择角色并设置 `Brokers`。消费者还需要 `GroupID`。以下代码用于 `BuildApplication` 内，同时导入 `echoplatform`、`spine`、`boot` 和 `time`。

```go
factory, err := kafkaplatform.NewFactory(kafkaplatform.Config{
    Brokers: []string{"kafka.example.com:9093"},
    Consume: true,
    Publish: true,
    GroupID: "orders",
    TopicPrefix: "prod.",
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory,
    spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{MaxAttempts: 5}),
    spine.WithEventSettlementTimeout(5 * time.Second),
))
```

Kafka 平台默认应用 TLS 1.2 或更高版本。使用 `TLS`、`Dialer`、`Transport` 配置 CA、mTLS 和 SASL。`AllowInsecureTransport: true` 仅用于隔离的本地明文连接，不能与显式 TLS 同时使用。`NewFactory` 仅检查配置。`Prepare` 和 `Run` 在准备已注册消费者的 reader 时检查消息代理和主题。Kafka 仅发布应用可以在未连接消息代理时启动，因此需要实际发布来单独验证连接和传递。

`Config.TopicPrefix` 同时为发布名称和消费者订阅添加前缀。两端 factory 都设置 `prod.` 时，应用中注册 `order.created`，在消息代理中准备 `prod.order.created`。前缀需要自行包含分隔符。

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})` 控制 reader 和 ACK/NACK 失败后的重连。默认初始延迟 100ms、最大 5s、倍数 2、抖动 0.2，`MaxAttempts: 0` 表示无限次传输重试。它不设置处理器重试次数或 DLQ 策略。`WithEventSettlementTimeout` 的默认 ACK/NACK 限制为 5s。Kafka 不会通过后续 offset 提交跳过失败记录，无法处理的消息可能阻塞分区。

## RabbitMQ

导入 `rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"`。设置共用的 `Config.Exchange` 并选择 `Consume`、`Publish`。默认要求 `amqps://`，本地 `amqp://` 需要显式设置 `AllowInsecureTransport: true`。以下代码用于 `BuildApplication` 内。

```go
factory, err := rabbitmqplatform.NewFactory(rabbitmqplatform.Config{
    URL: "amqps://user:pass@rabbit.example.com/vhost",
    Exchange: "events",
    Consume: true,
    Publish: true,
    PrefetchCount: 16,
    FailurePolicy: rabbitmqplatform.FailureReject,
    DeadLetter: &rabbitmqplatform.DeadLetter{
        Exchange: "events.dlx",
        RoutingKey: "events.failed",
    },
    OperationTimeout: 5 * time.Second,
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory))
```

省略 `PrefetchCount` 时每个消费者允许一条未确认消息。默认策略为 `rabbitmqplatform.FailureReject`，`FailureRequeue` 可能无限次重新传递无法处理的消息。使用前先准备 `DeadLetter` 交换机。`TopicPrefix` 应用于发布路由键和订阅绑定，`QueuePrefix` 应用于队列名。

发布器使用持久化消息、mandatory 路由和 publisher confirm。`OperationTimeout` 默认为 5s。没有自动重新发布失败消息的 `PublisherRetry` 选项。确认丢失后应用重试可能造成重复，因此消费者必须幂等。

## WebSocket

HTTP 选择 Echo，WebSocket 选择独立的 Gorilla 实现。注册 WS 路由需要 HTTP 升级支持和 WS factory。启用验证时将 `playground.New()` 的结果传给 `spine.WithValidator`。

在 `boot.HTTPOptions.WebSocket` 中配置来源、连接数和消息限制。请指定应用使用的确切来源和连接上限。

```go
HTTP: &boot.HTTPOptions{
    WebSocket: boot.WebSocketOptions{
        AllowedOrigins: []string{"https://app.example.com"},
        MaxConnections: 4096,
    },
},
```

| `WebSocketOptions` 字段 | 类型 | 默认值和约束 |
| --- | --- | --- |
| `MaxConnections` | `int` | 为 `0` 时使用 `boot.DefaultWebSocketMaxConnections`，即 1024。使用正数设置限制，或通过 `boot.UnlimitedWebSocketConnections` 解除限制 |
| `CapacityRetryAfter` | `time.Duration` | 5 秒。超出连接上限时的 `Retry-After` 值。不能为负数 |
| `AllowedOrigins` | `[]string` | 为空时要求同源。手动指定时，必须是不含路径、查询参数和片段的 `http://` 或 `https://` 来源。也支持 `*`，但会允许所有来源 |
| `TrustedProxyCIDRs` | `[]string` | 无默认值。允许信任其转发头的代理 CIDR 列表 |
| `MaxMessageBytes` | `int64` | 1 MiB。不能为负数 |
| `HandshakeTimeout` | `time.Duration` | 10 秒。不能为负数 |
| `ReadTimeout` | `time.Duration` | 60 秒。不能为负数 |
| `WriteTimeout` | `time.Duration` | 10 秒。不能为负数 |
| `PingInterval` | `time.Duration` | 读取超时时间的一半。默认读取超时下为 30 秒。不能为负数 |

时间和大小字段为 `0` 时选择默认值。解除连接数限制时，请使用命名常量 `boot.UnlimitedWebSocketConnections`，不要使用 `-1`。

`AllowedOrigins` 为空时，浏览器请求的协议和主机必须均相同。位于 TLS 终止代理后方时，可以指定 `TrustedProxyCIDRs`。只有请求对端位于此列表中时，才信任 `Forwarded` 和 `X-Forwarded-Proto`。代理必须移除或覆盖从外部收到的转发头。

连接上限也包含等待认证的连接请求。超出上限的请求不会升级，而是返回 HTTP 503、`Retry-After` 响应头，以及包含 `WEBSOCKET_CAPACITY_EXCEEDED` 代码的 JSON。

需要连接认证时，请为拦截器同时实现 `core.WebSocketHandshakeInterceptor`。`PreHandshake` 在预留连接名额后、HTTP 升级前执行。它独立于针对每条消息执行的 `PreHandle`。

```go
func (i *AuthInterceptor) PreHandshake(
    ctx core.WebSocketHandshakeContext,
    meta core.HandlerMeta,
) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("missing credentials")
    }
    return i.verify(token)
}
```

连接前上下文和消息上下文会保留原始请求的请求头、查询参数、Cookie、远程地址、主机和请求 URI。公开接口请参阅[执行上下文参考](/zh-Hans/reference/api/execution-context#websocket-request-context)。

## CORS 和 Cookie {#cors-cookies}

不能同时使用 `AllowOrigins: []string{"*"}` 和 `AllowCredentials: true`。如需在启动阶段检查，请使用 `cors.NewValidated`。`cors.New` 也会在首次请求写入响应头前返回结构化错误。

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
    AllowOrigins:     []string{"https://app.example.com"},
    AllowCredentials: true,
})
if err != nil {
    log.Fatal(err)
}
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
```

如果 Cookie 的名称、值、路径、域、`SameSite` 或 `Priority` 无效，JSON、字符串、二进制和重定向响应会在写入响应头或响应体之前失败。需要将 Unicode 字符或分隔符恢复为原始值时，请使用 `httpx.EncodeCookieValue` 和 `httpx.DecodeCookieValue`。

## 生产运行约束

- 监控 `WEBSOCKET_CAPACITY_EXCEEDED`、消费者重连次数耗尽、reader 和 ACK/NACK 失败以及事件发布失败。
- Kafka 和 RabbitMQ 消费者应实现幂等处理。还应准备处置 Kafka 无法处理的消息，以及运维 RabbitMQ DLX 的流程。
- 实际套接字写入和消息代理发布无法与数据库提交合并为原子操作。需要原子性时，请使用事务性发件箱和幂等键。
- 支持的版本请参阅[当前版本](/zh-Hans/community/changelog)。
