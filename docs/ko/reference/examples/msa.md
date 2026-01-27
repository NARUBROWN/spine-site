# Kafka 기반 MSA 예제

Spine으로 Kafka 이벤트 기반 마이크로서비스 아키텍처를 구현합니다.

## 아키텍처

```
┌─────────────────┐      Kafka Event        ┌─────────────────┐
│  Order Service  │ ──────────────────────> │  Stock Service  │
│   (HTTP API)    │   "order.created"       │    (Consumer)   │
│   Port: 8080    │                         │   Port: 8081    │
└─────────────────┘                         └─────────────────┘
```

Order Service에서 주문이 생성되면 Kafka로 이벤트를 발행하고, Stock Service가 해당 이벤트를 구독하여 처리합니다.


## 프로젝트 구조

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


## 프로젝트 생성

```bash
mkdir spine-simple-msa
cd spine-simple-msa
go mod init github.com/your-org/spine-simple-msa
```

## 의존성 설치

```bash
go get github.com/NARUBROWN/spine
```


## 이벤트 정의

두 서비스가 공유하는 이벤트를 정의합니다.

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

이벤트는 `Name()`과 `OccurredAt()` 메서드를 구현해야 합니다.


## Order Service (이벤트 발행)

### 컨트롤러

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
    // Kafka로 이벤트 발행
    publish.Event(ctx, &events.OrderCreated{
        OrderID: orderId.Value,
        At:      time.Now(),
    })

    return "OK"
}
```

`publish.Event()`를 호출하면 이벤트의 `Name()`을 토픽으로 사용해 Kafka에 발행합니다.

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


## Stock Service (이벤트 소비)

### 컨슈머

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
    
    // 재고 처리 로직 추가
    
    return nil
}
```

컨슈머 메서드 시그니처:
- `ctx context.Context` — 요청 컨텍스트
- `eventName string` — 이벤트 이름 (토픽)
- `event T` — 이벤트 페이로드

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

    // 컨슈머 등록
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


## 실행

### 1. Stock Service 실행

```bash
cd stock-app
go run main.go
```

### 2. Order Service 실행

새 터미널을 열고:

```bash
cd order-app
go run main.go
```


## API 테스트

### 주문 생성

```bash
curl -X POST http://localhost:8080/orders/12345
```

응답:

```
OK
```

Stock Service 콘솔에서 다음 로그를 확인할 수 있습니다:

```
Kafka Event: order.created
OrderID: 12345
```


## 이벤트 흐름

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


## Kafka 설정 옵션

### 이벤트 발행 (Write)

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"localhost:9092"},
    Write: &boot.KafkaWriteOptions{
        TopicPrefix: "prod.",  // 토픽 접두사 (예: prod.order.created)
    },
},
```

### 이벤트 소비 (Read)

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"localhost:9092"},
    Read: &boot.KafkaReadOptions{
        GroupID: "stock-service",  // Consumer Group ID
    },
},
```


## 핵심 정리

| 서비스 | 역할 | 포트 | Kafka 설정 |
|--------|------|------|-----------|
| order-app | HTTP API + 이벤트 발행 | 8080 | Write |
| stock-app | 이벤트 소비 | 8081 | Read (GroupID) |

| 구성 요소 | 설명 |
|-----------|------|
| `publish.Event()` | 이벤트를 Kafka로 발행 |
| `app.Consumers().Register()` | 토픽과 핸들러 메서드 연결 |
| `Event.Name()` | Kafka 토픽 이름으로 사용 |
| `boot.KafkaOptions` | Kafka 브로커 및 옵션 설정 |