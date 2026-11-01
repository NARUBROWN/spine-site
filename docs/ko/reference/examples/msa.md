# Kafka 기반 MSA 예제

CLI로 주문 HTTP 서비스와 재고 소비 서비스를 각각 생성합니다. 주문 서비스가 `order.created` 이벤트를 발행하고 재고 서비스가 처리합니다. 재고 서비스에는 HTTP 리스너가 필요하지 않습니다.

## CLI로 두 서비스 생성

먼저 [CLI 설치](/ko/learn/getting-started/installation)를 완료합니다. 이후 명령은 `spine-msa/`에서 실행합니다. CLI 0.1.4는 타입이 있는 consumer 골격을 제공하지만 Kafka 브로커나 전송 설정을 생성하지 않습니다.

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --module example.com/order-app --dry-run
spine new stock-app --module example.com/stock-app --dry-run
```

미리보기에서 생성 파일과 등록 코드 변경을 확인한 뒤 아래 명령으로 생성합니다.

```sh
spine new order-app --module example.com/order-app
spine new stock-app --module example.com/stock-app
```

## 소비자 골격 생성

기본 자동 등록은 `stock-app/internal/application/application.go`에 오류를 확인하는 `order.Register(app)` 호출을 추가합니다. 생성 직후 handler는 미구현 오류를 반환하므로 아래 구현으로 교체하기 전에는 검증에 통과하지 않습니다.

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

## 최종 구조

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

## 공유 이벤트

`order-app/src/events`는 두 서비스가 재사용하는 이벤트 패키지입니다. 이 예제는 stock 모듈이 order 모듈의 해당 패키지만 가져옵니다. 로컬 모듈 연결은 뒤의 `go mod edit` 명령으로 설정합니다.

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

## 주문 서비스: 이벤트 발행

아래 두 파일을 직접 추가·교체합니다. 루트 `main.go`와 `spine.toml`은 CLI가 생성한 상태를 유지합니다. `publish.Event`는 현재 요청에 이벤트를 추가하며 반환값이 없습니다. 성공한 핸들러와 응답 준비 이후 설정된 Kafka writer가 발행합니다.

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

## 재고 서비스: 이벤트 처리

생성된 `order_message.go`를 공유 이벤트의 별칭으로 바꾸고 `order_handler.go`의 미구현 오류를 제거합니다. 메모리 중복제거는 같은 프로세스에서만 유효하며, 실제 재고 변경과 영속 중복제거는 같은 DB 트랜잭션으로 구현해야 합니다. 구성 파일은 아래 전체 코드로 교체하므로 자동 등록을 중복 추가하지 않습니다.

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

## 모듈 연결과 검증

두 서비스는 각각 독립된 `go.mod`와 `spine.toml`을 갖습니다. 다음 명령은 `spine-msa/`에서 시작하고 마지막에 같은 위치로 돌아옵니다. 생성된 각 `main.go`는 `BuildApplication` → `Validate` → `Run`을 실행합니다.

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

로컬 평문 설정 때문에 각 서비스에서 `INSECURE_TRANSPORT_ENABLED` 경고 1개가 나오는 것이 예상 결과입니다. 기본 검사에서는 통과하지만 `--warnings-as-errors`를 사용하면 실패합니다.

`contract check`는 정적 계약, `verify`는 계약·gofmt·vet·Go 테스트를 검사합니다. 브로커 연결이나 메시지 전달은 확인하지 않습니다.

## 브로커 준비 후 실행

별도로 Kafka를 `localhost:9092`에 준비하고 `order.created` 토픽을 생성합니다. 서로 다른 터미널에서 모두 `spine-msa/`를 기준으로 실행합니다.

```sh
spine run --root stock-app
```

```sh
spine run --root order-app
```

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

`POST` 응답은 HTTP 202, 본문은 `accepted`입니다. 실제 브로커가 정상일 때 재고 프로세스에서 `topic=order.created order_id=12345` 로그를 확인합니다. HTTP 응답만으로 소비 완료를 판단하지 않습니다.

## 전송과 일관성 경계

`AllowInsecureTransport: true`는 격리된 로컬 평문 브로커 전용입니다. 운영에서는 이를 제거하고 TLS/SASL과 broker 주소를 설정합니다. 기본 전송은 TLS 1.2 이상이며, 사용자 지정 설정으로 읽기와 쓰기를 모두 보호해야 합니다.

`TopicPrefix`는 단순 문자열 연결입니다. writer에 `prod.`를 쓰면 소비자의 등록 토픽도 `prod.order.created`로 직접 맞춥니다. 이 예제는 양쪽 모두 접두사 없는 `order.created`를 사용합니다. 검사와 실행에 같은 설정을 사용하세요.

Kafka 전달은 최소 한 번이므로 안정적인 이벤트 ID와 영속 중복제거가 필요합니다. `ConsumerRetry`는 reader/전송 재구성을 조정하며 업무 handler의 재시도 횟수를 제한하지 않습니다. 영구 실패 메시지는 파티션을 막을 수 있고 자동으로 건너뛰거나 DLQ로 이동하지 않습니다.

DB 커밋과 broker 발행은 원자적이지 않습니다. 신뢰할 수 있는 DB·이벤트 처리가 필요하면 transactional outbox와 소비자 중복제거를 별도로 구현합니다. [보안 설정](/ko/reference/security-configuration)도 확인하세요.
