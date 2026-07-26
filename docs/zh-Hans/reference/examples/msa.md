# 安全的消息驱动 MSA 示例

订单服务发布事件，库存服务以 Kafka 或 RabbitMQ 消费。两种传输都提供至少一次交付语义，因此消费者必须幂等。

## Kafka

```go
Kafka: &boot.KafkaOptions{
	Brokers: []string{"kafka.example.com:9093"},
	Read:    &boot.KafkaReadOptions{GroupID: "stock-service"},
	Write:   &boot.KafkaWriteOptions{TopicPrefix: "orders."},
}
```

未提供 `TLS`、`Dialer` 或 `Transport` 时，Spine 默认使用 TLS 1.2 以上。只有隔离的本地明文代理才设置 `AllowInsecureTransport: true`。

NACK 或 offset 提交失败后，当前 reader 会失效并按 `ConsumerRetry` 重建；重建前不会读取后续消息。永久失败的记录可能阻塞分区，Spine 不会自行跳过或选择 DLQ 策略。

## RabbitMQ

```go
RabbitMQ: &boot.RabbitMqOptions{
	URL: "amqps://user:pass@rabbit.example/vhost",
	Read: &boot.RabbitMqReadOptions{
		Exchange:      "orders",
		PrefetchCount: 16,
		FailurePolicy: boot.RabbitMqFailureReject,
		DeadLetter: &boot.RabbitMqDeadLetterOptions{
			Exchange:   "orders.dlx",
			RoutingKey: "orders.failed",
		},
	},
	Write: &boot.RabbitMqWriteOptions{Exchange: "orders"},
}
```

RabbitMQ 默认要求 `amqps://`。`PrefetchCount` 为零时默认 1；处理失败默认拒绝且不重新入队。DLX 必须由运维预先创建，现有队列的参数也必须一致。

发布器使用持久消息、`mandatory=true` 和 publisher confirms。确认丢失时重试可能重复发布，仍需幂等。RabbitMQ 路由使用 AMQP `RoutingKey`，不要依赖生产者提供的 `Type`。

## 发布与一致性

```go
ctx.EventBus().Publish(OrderCreated{
	OrderID: order.ID,
	ProductID: req.ProductID,
})
```

响应可序列化且 Cookie/状态校验成功后，Spine 才运行领域事件后处理。但消息发布无法与数据库提交形成原子操作；需要可靠一致性时应使用 transactional outbox，并让消费者通过事件 ID 去重。

生产部署前调用 `app.Validate(opts)`，并按[安全配置参考](/zh-Hans/reference/security-configuration)检查代理配置。
