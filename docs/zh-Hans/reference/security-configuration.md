# 安全配置

Spine v0.5.1 默认对消息代理使用加密连接，并为 HTTP 和 WebSocket 设置大小、时间和连接数限制。请通过本参考了解默认值和配置约束，并为待部署的应用选择来源、认证和消息失败策略。

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

错误以 `*boot.ConfigError` 返回。`Issues` 中的每个 `ConfigIssue` 提供以下字段。在程序中对错误分类时，请使用 `Code`，不要解析消息。消息代理 URL 中的凭据不会暴露在配置错误中。

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
| RabbitMQ 发布 | 消息持久化、强制路由、发布确认和有限重试 | `PublisherRetry` |
| RabbitMQ 处理失败 | 拒绝且不重新入队 | `FailurePolicy` |
| RabbitMQ 并发处理 | 每个消费者 1 条未确认消息 | 正数 `PrefetchCount` |
| 消费者传输失败 | 使用指数退避和抖动重新创建读取器 | `ConsumerRetry` |
| WebSocket 来源 | 浏览器请求仅允许协议和主机相同的来源 | `AllowedOrigins` |
| WebSocket 连接数 | 连接和等待连接的请求合计 1024 个 | 正数 `MaxConnections` 或 `boot.UnlimitedWebSocketConnections` |
| WebSocket 连接认证 | 仅在升级前执行实现了可选接口的拦截器 | 实现 `core.WebSocketHandshakeInterceptor` |
| 全局拦截器 | 同时应用于 HTTP 和 WebSocket | 通过 `InterceptorFor` 限制范围 |
| 允许凭据的 CORS | 需要明确的来源 | 不能同时使用 `*` 和 `AllowCredentials: true` |
| Cookie | 在写入响应前拒绝无效字段 | 需要保留任意值时使用 `httpx.EncodeCookieValue` |

## Kafka

`boot.KafkaOptions` 的 `Read` 和 `Write` 独立启用。只要设置其中一项，就必须提供 `Brokers`；使用 `Read` 时还必须指定 `GroupID`。未单独配置传输设置时，对消费者和发布器均使用 TLS 1.2 或更高版本。

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    Read:  &boot.KafkaReadOptions{GroupID: "orders"},
    Write: &boot.KafkaWriteOptions{},
}
```

需要自定义 CA、mTLS 或 SASL 时，请配置 `TLS`、`Dialer` 和 `Transport`。如果对已启用的角色同时配置显式 TLS 和 `AllowInsecureTransport`，会发生 `KAFKA_TLS_INSECURE_CONFLICT` 错误。请仅在隔离的本地开发环境中显式允许明文连接。

```go
Kafka: &boot.KafkaOptions{
    Brokers:                []string{"localhost:9092"},
    AllowInsecureTransport: true,
    Read:                   &boot.KafkaReadOptions{GroupID: "local"},
}
```

读取器出错或 ACK/NACK 失败后，会根据 `ConsumerRetry` 关闭现有读取器并创建新读取器。此选项控制传输层的重新连接，不会改变处理器的消息处理策略。

| `ConsumerRetryOptions` 字段 | 类型 | 默认值 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5 秒 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2，即 20% |
| `MaxAttempts` | `int` | `0`，无限重试 |

各字段为 `0` 时选择默认值。不允许负数。显式指定的延迟上限必须大于或等于初始延迟，倍数必须大于或等于 1，抖动必须介于 0 和 1 之间。同样的选项也适用于 RabbitMQ 消费者。

Kafka 处理器必须考虑消息重新投递，并实现幂等处理。不会自动跳过永久无法处理的消息，也不会将其发送到独立的失败队列。

## RabbitMQ

生产环境 URL 使用 `amqps://`。已启用的 `Read` 和 `Write` 分别需要 `Exchange`。默认失败策略为拒绝且不重新入队。

```go
RabbitMQ: &boot.RabbitMqOptions{
    URL: "amqps://user:pass@rabbit.example/vhost",
    PublisherRetry: boot.PublisherRetryOptions{
        InitialDelay:   200 * time.Millisecond,
        MaxDelay:       5 * time.Second,
        MaxAttempts:    5,
        ConfirmTimeout: 5 * time.Second,
    },
    Read: &boot.RabbitMqReadOptions{
        Exchange:      "events",
        PrefetchCount: 16,
        FailurePolicy: boot.RabbitMqFailureReject,
        DeadLetter: &boot.RabbitMqDeadLetterOptions{
            Exchange:   "events.dlx",
            RoutingKey: "events.failed",
        },
    },
    Write: &boot.RabbitMqWriteOptions{Exchange: "events"},
}
```

| 读取配置 | 默认值和约束 |
| --- | --- |
| `PrefetchCount` | 为 `0` 时，每个消费者允许 1 条未确认消息。手动指定时必须为正数 |
| `FailurePolicy` | 省略时使用 `boot.RabbitMqFailureReject`。如需重新入队，使用 `boot.RabbitMqFailureRequeue` |
| `DeadLetter` | 默认值为 `nil`。配置时需要预先创建的 DLX 的 `Exchange`，也可指定 `RoutingKey` |
| `RequeueOnError` | 用于兼容旧版本。为 `true` 时重新入队。与显式指定的 `FailurePolicy` 冲突时返回配置错误 |

DLX 是接收未能处理消息的交换器。必须由运维人员预先创建；如果没有匹配的 DLX 配置，被拒绝的消息可能被丢弃。如果现有队列的参数与新配置不同，RabbitMQ 可能返回队列声明条件不匹配错误。

使用 `RabbitMqFailureRequeue` 可能导致无法处理的消息被无限次重新投递。新配置请使用拒绝策略和 DLX。`RequeueOnError` 计划弃用，新代码请使用 `FailurePolicy`。用于选择处理器的键是队列绑定的 `RoutingKey`，而非 AMQP `Type`。

发布器使用持久化消息、`mandatory=true` 和发布确认。消息无法路由，或确认被拒绝或丢失时，不会视为成功。确认丢失后重试可能重复发布同一消息，因此消费者必须具备幂等性。

| `PublisherRetryOptions` 字段 | 类型 | 默认值 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5 秒 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2，即 20% |
| `MaxAttempts` | `int` | 共尝试 3 次 |
| `ConfirmTimeout` | `time.Duration` | 5 秒 |

各字段为 `0` 时选择默认值。不允许负数，延迟范围、倍数和抖动的约束与 `ConsumerRetryOptions` 相同。增加 `MaxAttempts` 时，还应考虑重复发布的可能性。

## WebSocket

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

- 监控 `WEBSOCKET_CAPACITY_EXCEEDED`、消费者重新连接尝试耗尽，以及 RabbitMQ 的 `Type` 与 `RoutingKey` 不匹配的情况。
- Kafka 和 RabbitMQ 消费者应实现幂等处理。还应准备处置 Kafka 无法处理的消息，以及运维 RabbitMQ DLX 的流程。
- 实际套接字写入和消息代理发布无法与数据库提交合并为原子操作。需要原子性时，请使用事务性发件箱和幂等键。
- 支持的版本请参阅[当前版本](/zh-Hans/community/changelog)。
