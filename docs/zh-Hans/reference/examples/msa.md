# 使用 Kafka 连接订单服务和库存服务

分别创建订单 HTTP 服务和库存消费服务，通过 Kafka 传递 `order.created` 事件。发送订单请求后，确认库存服务的处理日志。库存服务不启动 HTTP 监听器。

## 开始前的准备

先完成 [CLI 安装](/zh-Hans/learn/getting-started/installation)。使用 CLI 0.4.2 生成 Kafka 平台和消费者骨架，再用以下代码组装发布服务和无 HTTP 的 worker。

要确认消息传递，需要在 `localhost:9092` 运行 Kafka broker，并创建 `order.created` 主题。本示例使用隔离本地环境中的明文连接。库存消费者会记录事件日志，但不会修改实际库存数量。

## 1. 创建两个服务

创建工作目录，先预览将要生成的文件。

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --layout legacy --module example.com/order-app --event-platform kafka --dry-run
spine new stock-app --layout legacy --module example.com/stock-app --platform none --event-platform kafka --dry-run
```

确认预览后，创建两个应用。除非另有说明，后续命令均在 `spine-msa/` 中运行。

```sh
spine new order-app --layout legacy --module example.com/order-app --event-platform kafka
spine new stock-app --layout legacy --module example.com/stock-app --platform none --event-platform kafka
```

## 2. 生成库存消费者骨架

在 `stock-app` 中创建用于接收订单事件的消费者。先确认预览。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

以下命令会创建消费者文件，并在 `stock-app/internal/application/application.go` 中添加 `order.Register(app)` 调用和错误检查代码。刚生成的处理器会返回未实现错误，必须替换为第 5 步中的代码才能通过验证。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

### 文件布局

添加共享事件和订单控制器，替换生成的消费者实现和应用配置后，文件结构如下。

```text
spine-msa/
├── order-app/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go
│   ├── spine.toml
│   ├── internal/application/
│   │   ├── application.go
│   │   ├── application_test.go
│   │   ├── platform_config.go
│   │   └── platform_config_test.go
│   └── src/
│       ├── events/order_created.go
│       └── controller/order_controller.go
└── stock-app/
    ├── go.mod
    ├── go.sum
    ├── main.go
    ├── spine.toml
    ├── internal/application/
    │   ├── application.go
    │   ├── application_test.go
    │   ├── platform_config.go
    │   └── platform_config_test.go
    └── src/consumer/order/
        ├── module.go
        ├── order_handler.go
        └── order_message.go
```

保留生成的 `platform_config.go` 和两个测试文件。以下 BuildApplication 使用生成的 `loadKafkaConfig` 验证环境配置，再为订单服务选择仅发布、为库存 worker 选择仅消费。在各运行终端传入消息代理和组配置。

## 3. 定义共享事件

新建 `order-app/src/events/order_created.go`。两个服务共同使用此包中的事件类型。第 6 步会通过 `go mod edit` 连接本地模块，让 `stock-app` 能够导入 `order-app` 的事件包。

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

## 4. 在订单服务中发布事件

新建 `order-app/src/controller/order_controller.go`，并将 `order-app/internal/application/application.go` 替换为下方代码。继续使用根目录中的 `main.go` 和 `spine.toml`。

`publish.Event` 将事件添加到当前请求中，没有返回值。处理器执行成功且响应准备完成后，配置的 Kafka 发布器会发送事件。

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
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "time"

    "example.com/order-app/src/controller"
    "github.com/NARUBROWN/spine"
    kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    config, err := loadKafkaConfig("SPINE_KAFKA_")
    if err != nil {
        return nil, boot.Options{}, err
    }
    config.Consume = false
    config.Publish = true
    factory, err := kafkaplatform.NewFactory(config)
    if err != nil {
        return nil, boot.Options{}, err
    }
    app := spine.New(echoplatform.Option(), spine.WithEventAdapter("kafka", factory))
    app.Constructor(controller.NewOrderController)
    app.Route("POST", "/orders/:order_id", (*controller.OrderController).Create)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 5. 在库存服务中处理事件

将以下三个文件分别替换为下方代码。将 `order_message.go` 改为共享事件的类型别名，并在 `order_handler.go` 中实现验证、重复检查和日志输出，替代未实现错误。继续使用生成的 `module.go`。

`stock-app/internal/application/application.go` 的完整替换代码已包含 `order.Register(app)`。请勿再次追加生成时添加的注册代码。

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
    kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    config, err := loadKafkaConfig("SPINE_KAFKA_")
    if err != nil {
        return nil, boot.Options{}, err
    }
    config.Consume = true
    config.Publish = false
    factory, err := kafkaplatform.NewFactory(config)
    if err != nil {
        return nil, boot.Options{}, err
    }
    app := spine.New(spine.WithEventAdapter("kafka", factory))
    if err := order.Register(app); err != nil {
        return nil, boot.Options{}, err
    }
    return app, boot.Options{
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
    }, nil
}
```

## 6. 连接本地模块并验证代码

两个服务各自使用独立的 `go.mod` 和 `spine.toml`。以下命令从 `spine-msa/` 开始，连接并检查两个模块，然后返回原目录。各应用生成的 `main.go` 会依次执行 `BuildApplication`、`Validate` 和 `Run`。

```sh
cd order-app
gofmt -w src internal/application
go mod tidy
go mod download all
cd ../stock-app
go mod edit -require=example.com/order-app@v0.0.0
go mod edit -replace=example.com/order-app=../order-app
gofmt -w src internal/application
go mod tidy
go mod download all
cd ..
spine doctor --root order-app
spine doctor --root stock-app
spine contract check --root order-app
spine contract check --root stock-app
spine verify --root order-app
spine verify --root stock-app
```

本例 factory 显式允许本地明文连接。CLI 静态契约检查不执行 factory 配置，也不证明传输安全性或消息代理就绪状态。

`contract check` 检查静态契约。`verify` 检查静态契约，并运行 gofmt、go vet 和 Go 测试。下一步会确认 broker 连接和实际消息传递。

## 7. 运行并确认事件传递

确认 Kafka 正在 `localhost:9092` 运行，且存在 `order.created` 主题。将各终端的工作目录设为 `spine-msa/`。

在第一个终端中启动库存服务。

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=stock-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root stock-app
```

在第二个终端中启动订单服务。

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=order-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root order-app
```

在第三个终端中发送创建订单的请求。

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

确认服务器返回 HTTP 202 和正文 `accepted`。随后在库存服务终端中确认 `topic=order.created order_id=12345` 日志。HTTP 响应表示订单请求的结果，库存服务日志表示事件消费的结果。两者都需要确认，才能验证服务之间的传递。

## 应用于生产环境前需要检查的事项

### 传输安全和主题名称

`AllowInsecureTransport: true` 仅用于隔离的本地明文 broker。在生产环境中，应移除此选项，并配置 TLS/SASL 和 broker 地址。默认传输使用 TLS 1.2 或更高版本。如果自行指定传输配置，必须同时保护读取和写入。

`Config.TopicPrefix` 同时为发布名称和消费者订阅添加前缀。两端 factory 都设置 `prod.` 时，应用中注册 `order.created`，在消息代理中准备 `prod.order.created`。前缀需要自行包含分隔符。

### 重复处理和失败消息

Kafka 至少传递一次消息，因此同一事件可能再次到达。需要在重新发送同一事件时保持不变的事件 ID，以及持久化的去重机制。本示例的去重机制仅在同一进程内有效。实际库存修改和持久化去重必须在同一个数据库事务中实现。

`spine.WithEventConsumerRetry` 调整读取器和传输层的重新配置，不限制业务处理器的重试次数。持续失败的消息可能阻塞分区。系统不会自动跳过消息或将其移至 DLQ。

### 数据库修改和事件发布

数据库提交和 broker 发布并非一个原子操作。如果需要一致地处理数据库修改和事件传递，请另外实现 transactional outbox 和消费者去重机制。

## 后续步骤

请在[安全配置](/zh-Hans/reference/security-configuration)中查看 Kafka 连接配置。连接实际库存存储库时，应持久化记录事件 ID，并将其与库存修改一起提交。
