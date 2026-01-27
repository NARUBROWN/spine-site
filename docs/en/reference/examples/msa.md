# Kafka-based MSA Example

Implement a Kafka event-based microservices architecture with Spine.

## Architecture

```
┌─────────────────┐      Kafka Event        ┌─────────────────┐
│  Order Service  │ ──────────────────────> │  Stock Service  │
│   (HTTP API)    │   "order.created"       │    (Consumer)   │
│   Port: 8080    │                         │   Port: 8081    │
└─────────────────┘                         └─────────────────┘
```

When an order is created in the Order Service, it publishes an event to Kafka, and the Stock Service subscribes to that event to process it.


## Project Structure

```
spine-simple-msa/
├── go.mod
├── order-app/
│   ├── main.go
│   └── controller/
│       └── order_controller.go
├── stock-app/
│   ├── main.go
│   └── consumer/
│       └── order_consumer.go
└── shared/
    └── events/
        └── order_created.go
```


## Create Project

```bash
mkdir spine-simple-msa
cd spine-simple-msa
go mod init github.com/your-org/spine-simple-msa
```

## Install Dependencies

```bash
go get github.com/NARUBROWN/spine
```


## Define Events

Define events shared by both services.

```go
// shared/events/order_created.go
package events

import "time"

type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}

func (o *OrderCreated) Name() string {
    return "order.created"
}

func (o *OrderCreated) OccurredAt() time.Time {
    return o.At
}
```

Events must implement the `Name()` and `OccurredAt()` methods.


## Order Service (Event Publishing)

### Controller

```go
// order-app/controller/order_controller.go
package controller

import (
    "context"
    "time"

    "github.com/your-org/spine-simple-msa/shared/events"
    "github.com/NARUBROWN/spine/pkg/event/publish"
    "github.com/NARUBROWN/spine/pkg/path"
)

type OrderController struct{}

func NewOrderController() *OrderController {
    return &OrderController{}
}

func (c *OrderController) Create(ctx context.Context, orderId path.Int) string {
    // Publish event to Kafka
    publish.Event(ctx, &events.OrderCreated{
        OrderID: orderId.Value,
        At:      time.Now(),
    })

    return "OK"
}
```

Calling `publish.Event()` publishes to Kafka using the event's `Name()` as the topic.

### main.go

```go
// order-app/main.go
package main

import (
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/your-org/spine-simple-msa/order-app/controller"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    app.Constructor(
        controller.NewOrderController,
    )

    app.Route(
        "POST",
        "/orders/:order_id",
        (*controller.OrderController).Create,
    )

    app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            Write: &boot.KafkaWriteOptions{
                TopicPrefix: "",
            },
        },
        HTTP: &boot.HTTPOptions{},
    })
}
```


## Stock Service (Event Consumption)

### Consumer

```go
// stock-app/consumer/order_consumer.go
package consumer

import (
    "context"
    "log"

    "github.com/your-org/spine-simple-msa/shared/events"
)

type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

func (c *OrderConsumer) OnCreated(ctx context.Context, eventName string, event events.OrderCreated) error {
    log.Println("Kafka Event:", eventName)
    log.Println("OrderID:", event.OrderID)
    
    // Add stock processing logic
    
    return nil
}
```

Consumer method signature:
- `ctx context.Context` — Request context
- `eventName string` — Event name (topic)
- `event T` — Event payload

### main.go

```go
// stock-app/main.go
package main

import (
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/your-org/spine-simple-msa/stock-app/consumer"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    app.Constructor(
        consumer.NewOrderConsumer,
    )

    // Register Consumer
    app.Consumers().Register(
        "order.created",
        (*consumer.OrderConsumer).OnCreated,
    )

    app.Run(boot.Options{
        Address:                ":8081",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            Read: &boot.KafkaReadOptions{
                GroupID: "stock-service",
            },
        },
        HTTP: &boot.HTTPOptions{},
    })
}
```


## Run

### 1. Run Stock Service

```bash
cd stock-app
go run main.go
```

### 2. Run Order Service

Open a new terminal and:

```bash
cd order-app
go run main.go
```


## API Test

### Create Order

```bash
curl -X POST http://localhost:8080/orders/12345
```

Response:

```
OK
```

You can check the following log in the Stock Service console:

```
Kafka Event: order.created
OrderID: 12345
```


## Event Flow

```
POST /orders/12345
   │
   ├─→ OrderController.Create
   │       │
   │       └─→ publish.Event(&OrderCreated{...})
   │               │
   │               └─→ Kafka Topic: "order.created"
   │
   └─→ Response "OK"

              ↓ Kafka ↓

Stock Service (Consumer)
   │
   └─→ OrderConsumer.OnCreated
           │
           ├─→ log: "Kafka Event: order.created"
           └─→ log: "OrderID: 12345"
```


## Kafka Configuration Options

### Event Publishing (Write)

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"localhost:9092"},
    Write: &boot.KafkaWriteOptions{
        TopicPrefix: "prod.",  // Topic prefix (e.g., prod.order.created)
    },
},
```

### Event Consumption (Read)

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"localhost:9092"},
    Read: &boot.KafkaReadOptions{
        GroupID: "stock-service",  // Consumer Group ID
    },
},
```


## Key Takeaways

| Service | Role | Port | Kafka Config |
|--------|------|------|-----------|
| order-app | HTTP API + Event Publishing | 8080 | Write |
| stock-app | Event Consumption | 8081 | Read (GroupID) |

| Component | Description |
|-----------|------|
| `publish.Event()` | Publishes event to Kafka |
| `app.Consumers().Register()` | Connects topic and handler method |
| `Event.Name()` | Used as Kafka topic name |
| `boot.KafkaOptions` | Sets Kafka brokers and options |
