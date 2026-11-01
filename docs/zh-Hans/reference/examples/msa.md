# Kafka MSA 示例

使用 CLI 分别生成订单 HTTP 服务和库存消费者服务。订单服务发布 `order.created`，库存服务处理事件，无需 HTTP 监听器。

## 使用 CLI 生成两个服务

先完成 [CLI 安装](/zh-Hans/learn/getting-started/installation)，之后从 `spine-msa/` 执行命令。CLI 0.1.4 提供带类型的 consumer 骨架，不生成 Kafka 代理或传输配置。

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --module example.com/order-app --dry-run
spine new stock-app --module example.com/stock-app --dry-run
```

在预览中检查生成文件与注册代码的变更，然后执行下方命令生成。

```sh
spine new order-app --module example.com/order-app
spine new stock-app --module example.com/stock-app
```

## 生成消费者骨架

默认自动注册会向 `stock-app/internal/application/application.go` 添加检查错误的 `order.Register(app)` 调用。生成的 handler 在实现前返回未实现错误，因此在替换以下代码前验证失败是预期行为。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

## 最终结构

```text
spine-msa/
├── order-app/
│   ├── go.mod
│   ├── main.go
│   ├── spine.toml
│   ├── internal/application/
│   │   ├── application.go
│   │   └── application_test.go
│   └── src/
│       ├── events/order_created.go
│       └── controller/order_controller.go
└── stock-app/
    ├── go.mod
    ├── main.go
    ├── spine.toml
    ├── internal/application/
    │   ├── application.go
    │   └── application_test.go
    └── src/consumer/order/
        ├── module.go
        ├── order_handler.go
        └── order_message.go
```

## 共享事件

`order-app/src/events` 是两个服务共同使用的事件包。库存模块只从订单模块导入该包，后方 `go mod edit` 命令负责连接本地模块。

```go
// order-app/src/events/order_created.go
package events

import "time"

type OrderCreated struct {
    EventID string `json:"event_id"`
    OrderID int64 `json:"order_id"`
    At time.Time `json:"at"`
}

func (e OrderCreated) Name() string { return "order.created" }
func (e OrderCreated) OccurredAt() time.Time { return e.At }
```

## 订单服务：发布事件

手动添加或替换以下两个文件。保留 CLI 生成的根目录 `main.go` 和 `spine.toml`。`publish.Event` 将事件加入当前请求，没有返回值；handler 和响应准备成功后，由已配置的 Kafka writer 发布。

```go
// order-app/src/controller/order_controller.go
package controller

import (
    "context"
    "fmt"
    "time"

    "example.com/order-app/src/events"
    "github.com/NARUBROWN/spine/pkg/event/publish"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type OrderController struct{}

func NewOrderController() *OrderController { return &OrderController{} }

func (c *OrderController) Create(ctx context.Context, id path.Int) (httpx.Response[string], error) {
    if id.Value <= 0 {
        return httpx.Response[string]{}, httperr.BadRequest("order ID must be positive")
    }
    publish.Event(ctx, events.OrderCreated{
        EventID: fmt.Sprintf("order.created:%d", id.Value),
        OrderID: id.Value,
        At: time.Now().UTC(),
    })
    return httpx.Response[string]{
        Body: "accepted",
        Options: httpx.ResponseOptions{Status: 202},
    }, nil
}
```

```go
// order-app/internal/application/application.go
package application

import (
    "time"

    "example.com/order-app/src/controller"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(controller.NewOrderController)
    app.Route("POST", "/orders/:order_id", (*controller.OrderController).Create)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            AllowInsecureTransport: true,
            Write: &boot.KafkaWriteOptions{TopicPrefix: ""},
        },
    }, nil
}
```

## 库存服务：处理事件

将生成的 `order_message.go` 改为共享事件别名，实现 `order_handler.go` 并移除未实现错误。内存去重仅在同一进程内有效；实际库存修改与持久化去重应在同一数据库事务中实现。使用下方完整代码替换组装文件，不要重复添加自动注册。

```go
// stock-app/src/consumer/order/order_message.go
package order

import "example.com/order-app/src/events"

type OrderEvent = events.OrderCreated
```

```go
// stock-app/src/consumer/order/order_handler.go
package order

import (
    "context"
    "fmt"
    "log"
    "sync"
)

type OrderConsumer struct {
    mu sync.Mutex
    processed map[string]struct{}
}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{processed: make(map[string]struct{})}
}

func (c *OrderConsumer) Handle(ctx context.Context, eventName string, event OrderEvent) error {
    if event.EventID == "" || event.OrderID <= 0 {
        return fmt.Errorf("invalid order event")
    }
    c.mu.Lock()
    defer c.mu.Unlock()
    if _, exists := c.processed[event.EventID]; exists {
        return nil
    }
    log.Printf("topic=%s order_id=%d", eventName, event.OrderID)
    c.processed[event.EventID] = struct{}{}
    return nil
}
```

```go
// stock-app/internal/application/application.go
package application

import (
    "time"

    "example.com/stock-app/src/consumer/order"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    if err := order.Register(app); err != nil {
        return nil, boot.Options{}, err
    }
    return app, boot.Options{
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            AllowInsecureTransport: true,
            Read: &boot.KafkaReadOptions{GroupID: "stock-service"},
        },
    }, nil
}
```

## 连接模块并验证

两个服务各有独立的 `go.mod` 和 `spine.toml`。从 `spine-msa/` 开始执行以下命令，最后返回相同位置。各生成的 `main.go` 依次调用 `BuildApplication`、`Validate`、`Run`。

```sh
cd order-app
gofmt -w src internal/application
go mod tidy
cd ../stock-app
go mod edit -require=example.com/order-app@v0.0.0
go mod edit -replace=example.com/order-app=../order-app
gofmt -w src internal/application
go mod tidy
cd ..
spine doctor --root order-app
spine doctor --root stock-app
spine contract check --root order-app
spine contract check --root stock-app
spine verify --root order-app
spine verify --root stock-app
```

此本地明文配置预计使每个服务报告一个 `INSECURE_TRANSPORT_ENABLED` 警告。默认检查可通过，使用 `--warnings-as-errors` 则会失败。

`contract check` 检查静态契约，`verify` 检查契约、gofmt、vet 和 Go 测试，不验证代理连接或消息交付。

## 准备代理后运行

另行在 `localhost:9092` 准备 Kafka 并创建 `order.created` 主题。在不同终端中，均从 `spine-msa/` 执行。

```sh
spine run --root stock-app
```

```sh
spine run --root order-app
```

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

POST 返回 HTTP 202，正文为 `accepted`。代理正常时，在库存进程中确认 `topic=order.created order_id=12345` 日志；仅有 HTTP 响应不能证明消费完成。

## 传输与一致性边界

`AllowInsecureTransport: true` 仅用于隔离的本地明文代理。生产环境应移除该选项，并配置 TLS/SASL 与代理地址。默认传输使用 TLS 1.2 以上；自定义配置需同时保护读写。

`TopicPrefix` 只进行字符串拼接；writer 使用 `prod.` 时，consumer 必须明确注册 `prod.order.created`。本例两端都使用无前缀的 `order.created`，检查与运行时请保持配置一致。

Kafka 至少交付一次，需使用稳定事件 ID 和持久化去重。`ConsumerRetry` 控制 reader/传输重建，不是业务 handler 的重试次数限制。永久失败的消息可能阻塞分区，Spine 不会自动跳过或选择 DLQ。

数据库提交与代理发布不是原子操作。需要可靠的数据库与事件一致性时，应另行实现 transactional outbox 和消费者去重。另见[安全配置](/zh-Hans/reference/security-configuration)。

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
