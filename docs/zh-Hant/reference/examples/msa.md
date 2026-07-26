# 安全的訊息驅動 MSA 範例

訂單服務發布事件，庫存服務透過 Kafka 或 RabbitMQ 消費。兩種傳輸都提供至少一次傳遞語意，因此消費者必須具備冪等性。

## Kafka

```go
Kafka: &boot.KafkaOptions{
	Brokers: []string{"kafka.example.com:9093"},
	Read:    &boot.KafkaReadOptions{GroupID: "stock-service"},
	Write:   &boot.KafkaWriteOptions{TopicPrefix: "orders."},
}
```

未提供 `TLS`、`Dialer` 或 `Transport` 時，Spine 預設使用 TLS 1.2 以上。只有隔離的本機明文代理才設定 `AllowInsecureTransport: true`。

NACK 或 offset 提交失敗後，目前 reader 會失效並依 `ConsumerRetry` 重建；重建前不會讀取後續訊息。永久失敗的記錄可能阻塞分割區，Spine 不會自行跳過或選擇 DLQ 策略。

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

RabbitMQ 預設要求 `amqps://`。`PrefetchCount` 為零時預設 1；處理失敗預設拒絕且不重新入列。DLX 必須由維運人員預先建立，現有佇列的參數也必須一致。

發布器使用持久訊息、`mandatory=true` 和 publisher confirms。確認遺失時重試可能重複發布，仍需保持冪等。RabbitMQ 路由使用 AMQP `RoutingKey`，不要依賴生產者提供的 `Type`。

## 發布與一致性

```go
ctx.EventBus().Publish(OrderCreated{
	OrderID: order.ID,
	ProductID: req.ProductID,
})
```

回應可序列化且 Cookie/狀態驗證成功後，Spine 才執行領域事件後處理。但訊息發布無法與資料庫提交形成原子操作；需要可靠一致性時應使用 transactional outbox，並讓消費者透過事件 ID 去重。

正式環境部署前呼叫 `app.Validate(opts)`，並依[安全設定參考](/zh-Hant/reference/security-configuration)檢查代理設定。
