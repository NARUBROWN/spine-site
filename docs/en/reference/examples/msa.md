# Connect Order and Stock Services with Kafka

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Create an order HTTP service and a stock consumer service, and pass `order.created` events through Kafka. Send an order request, then check the processing log in the stock service. The stock service runs without an HTTP listener.

## Prerequisites

Complete [CLI installation](/en/learn/getting-started/installation) and use a Preview CLI supporting the 0.7.5 API. CLI installation and app dependency channels are independent.

To test message delivery, you need a Kafka broker at `localhost:9092` and an `order.created` topic. This example uses a plaintext connection in an isolated local environment. The stock consumer logs events; it does not change actual stock quantities.

## 1. Create the Two Services

Create a working directory and preview the files to be generated.

The commands below select Preview dependencies. Check the actual core and platform versions in the generated go.mod.

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --module example.com/order-app --event-platform kafka --channel preview --no-interactive --dry-run
spine new stock-app --module example.com/stock-app --platform none --event-platform kafka --channel preview --no-interactive --dry-run
```

Review the preview, then create both apps. Run subsequent commands from `spine-msa/` unless instructed otherwise.

```sh
spine new order-app --module example.com/order-app --event-platform kafka --channel preview --no-interactive
spine new stock-app --module example.com/stock-app --platform none --event-platform kafka --channel preview --no-interactive
```

## 2. Generate the Stock Consumer Scaffold

Generate a consumer in `stock-app` to receive order events. Review the preview first.

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

The following command creates the consumer files and adds an `order.Register(app)` call and error handling to `stock-app/internal/application/application.go`. The generated handler returns a not-implemented error, so replace it with the code in step 5 before validation can pass.

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

### File Layout

After adding the shared event and order controller and replacing the generated consumer implementation and app configuration, the file layout is as follows.

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

Keep the generated `platform_config.go` and both test files. The BuildApplication examples below use the generated `loadKafkaConfig` to validate environment settings, then select publishing only for orders and consumption only for the stock worker. Supply broker and group settings in each runtime terminal.

## 3. Define the Shared Event

Create `order-app/src/events/order_created.go`. Both services use the event type from this package. In step 6, use `go mod edit` to connect the local modules so that `stock-app` can import the event package from `order-app`.

```go
// order-app/src/events/order_created.go
package events

import "time"

type OrderCreated struct {
	EventID string    `json:"event_id"`
	OrderID int64     `json:"order_id"`
	At      time.Time `json:"at"`
}

func (e OrderCreated) Name() string          { return "order.created" }
func (e OrderCreated) OccurredAt() time.Time { return e.At }
```

## 4. Publish Events from the Order Service

Create `order-app/src/controller/order_controller.go` and replace `order-app/internal/application/application.go` with the code below. Keep the root `main.go` and `spine.toml` as generated.

`publish.Event` adds an event to the current request and has no return value. After the handler succeeds and response preparation finishes, the configured Kafka publisher sends the event.

```go
// order-app/src/controller/order_controller.go
package controller

import (
	"fmt"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"time"

	"example.com/order-app/src/events"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/event/publish"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
)

type OrderController struct{}

func (*OrderController) Constructor() *OrderController { return &OrderController{} }

func (c *OrderController) RegisterRoutes(r *api.Registry) {
	r.POST("/orders/:order_id", c.Create)
}

func (c *OrderController) Create(ctx spinectx.Ctx, id input.Path[int64]) (httpx.Response[string], error) {
	if *id <= 0 {
		return httpx.Response[string]{}, httperr.BadRequest("order ID must be positive")
	}
	publish.Event(ctx.ExecutionContext().Context(), events.OrderCreated{
		EventID: fmt.Sprintf("order.created:%d", *id),
		OrderID: *id,
		At:      time.Now().UTC(),
	})
	return httpx.Response[string]{
		Body:    "accepted",
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
	"github.com/NARUBROWN/spine/pkg/constructor"
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
	app.Constructor(constructor.Controller(&controller.OrderController{}))

	return app, boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP:                   &boot.HTTPOptions{},
	}, nil
}
```

## 5. Handle Events in the Stock Service

Replace each of the following three files with the corresponding code below. Change `order_message.go` to a type alias for the shared event. In `order_handler.go`, replace the not-implemented error with validation, duplicate checking, and logging. Keep the generated `module.go` as is.

The full replacement for `stock-app/internal/application/application.go` already includes `order.Register(app)`. Do not append the registration code added during generation again.

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
	"fmt"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
	"sync"
)

type OrderConsumer struct {
	mu        sync.Mutex
	processed map[string]struct{}
}

func NewOrderConsumer() *OrderConsumer {
	return &OrderConsumer{processed: make(map[string]struct{})}
}

func (c *OrderConsumer) Handle(ctx spinectx.Ctx, eventName string, event OrderEvent) error {
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
		ShutdownTimeout:        10 * time.Second,
	}, nil
}
```

## 6. Connect Local Modules and Validate the Code

Each service has its own `go.mod` and `spine.toml`. The following commands start from `spine-msa/`, connect and check the two modules, then return to the same directory. The `main.go` generated in each app calls `BuildApplication`, `Validate`, and `Run` in that order.

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

The example factories explicitly allow local plaintext connections. Static CLI contract checks do not execute factory configuration or prove transport security and broker readiness.

`contract check` checks static contracts. `verify` checks static contracts, gofmt, go vet, and Go tests. Check broker connectivity and actual message delivery in the next step.

## 7. Run the Services and Test Event Delivery

Make sure Kafka is running at `localhost:9092` and the `order.created` topic exists. Set each terminal's working directory to `spine-msa/`.

Run the stock service in the first terminal.

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=stock-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root stock-app
```

Run the order service in the second terminal.

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=order-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root order-app
```

Send a create-order request in the third terminal.

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

Check that the response returns HTTP 202 with the body `accepted`. Then look for `topic=order.created order_id=12345` in the stock service terminal. The HTTP response shows the result of the order request, and the stock service log shows the result of event consumption. Check both to verify delivery between the services.

## Before Using This in Production

### Transport Security and Topic Names

Use `AllowInsecureTransport: true` only with an isolated local plaintext broker. In production, remove this option and configure TLS/SASL and the broker addresses. The default transport uses TLS 1.2 or later. If you supply your own transport configuration, protect both reads and writes.

`Config.TopicPrefix` prefixes both published names and consumer subscriptions. With `prod.` in both factories, register `order.created` in the app and provision `prod.order.created` in the broker. Include the separator in the prefix.

### Duplicate Handling and Failing Messages

Kafka delivers messages at least once, so the same event can arrive again. You need an event ID that stays the same when the event is resent, along with persistent deduplication. This example's deduplication works only within the same process. Implement actual stock changes and persistent deduplication in the same database transaction.

`spine.WithEventConsumerRetry` controls reader and transport reconfiguration; it does not limit retry attempts for the business handler. A message that keeps failing can block a partition. Messages are not automatically skipped or moved to a DLQ.

### Database Changes and Event Publishing

A database commit and a broker publish are not a single atomic operation. If database changes and event delivery must remain consistent, implement a transactional outbox and consumer deduplication separately.

## Next Steps

See [Security Configuration](/en/reference/security-configuration) for Kafka connection settings. When you connect a real stock repository, persist event IDs and commit them together with stock changes.
