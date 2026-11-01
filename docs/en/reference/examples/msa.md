# Kafka MSA Example

Generate an order HTTP service and a stock consumer service with CLI. The order service publishes `order.created`; the stock service handles it without an HTTP listener.

## Generate two services with CLI

Complete [CLI installation](/en/learn/getting-started/installation) first. Run the following commands from `spine-msa/`. CLI 0.1.4 provides typed consumer skeletons but does not generate Kafka brokers or transport configuration.

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --module example.com/order-app --dry-run
spine new stock-app --module example.com/stock-app --dry-run
```

Review the generated files and registration changes in the preview, then run the command below to generate them.

```sh
spine new order-app --module example.com/order-app
spine new stock-app --module example.com/stock-app
```

## Generate the consumer skeleton

Default automatic registration adds a checked `order.Register(app)` call to `stock-app/internal/application/application.go`. The generated handler returns an unimplemented error until you replace it below, so verification is expected to fail before implementation.

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

## Final structure

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

## Shared event

`order-app/src/events` is the event package reused by both services. This example imports only that package from the order module into the stock module. The `go mod edit` commands below connect the local modules.

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

## Order service: publish events

Add or replace the following two files manually. Keep the CLI-generated root `main.go` and `spine.toml`. `publish.Event` queues an event in the current request and returns no value; the configured Kafka writer publishes after the handler and response preparation succeed.

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

## Stock service: handle events

Replace generated `order_message.go` with a shared-event alias and implement `order_handler.go`. The memory deduplication works only within one process. Implement real stock changes and durable deduplication in the same database transaction. Replace the assembly file with the complete version below; do not add automatic registration twice.

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

## Connect modules and verify

Each service has its own `go.mod` and `spine.toml`. Start these commands in `spine-msa/`; the final command returns there. Each generated `main.go` calls `BuildApplication`, `Validate`, then `Run`.

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

Each service is expected to report one `INSECURE_TRANSPORT_ENABLED` warning for this local plaintext setup. Default checks pass; `--warnings-as-errors` fails until the transport configuration is secured.

`contract check` checks the static contract; `verify` checks the contract, gofmt, vet, and Go tests. Neither checks broker connectivity or message delivery.

## Run after preparing the broker

Prepare Kafka separately at `localhost:9092` and create the `order.created` topic. Use separate terminals, both starting in `spine-msa/`.

```sh
spine run --root stock-app
```

```sh
spine run --root order-app
```

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

The POST response is HTTP 202 with body `accepted`. With a working broker, check the stock process for `topic=order.created order_id=12345`. An HTTP response alone does not prove consumption.

## Transport and consistency boundaries

`AllowInsecureTransport: true` is for an isolated local plaintext broker. Remove it in production and configure TLS/SASL and broker addresses. Default transport uses TLS 1.2 or later; custom configuration must secure both reads and writes.

`TopicPrefix` uses simple string concatenation. If the writer uses `prod.`, explicitly register the consumer under `prod.order.created`. Both services here use unprefixed `order.created`. Use the same settings for inspection and execution.

Kafka delivery is at least once. Use stable event IDs and durable deduplication. `ConsumerRetry` controls reader/transport reconstruction, not an application handler retry budget. A permanently failing record can block its partition; Spine does not automatically skip it or select a DLQ.

Database commit and broker publication are not atomic. Implement a transactional outbox and consumer deduplication when reliable database-plus-event handling is needed. See [security configuration](/en/reference/security-configuration).
