# Kafka로 주문 서비스와 재고 서비스 연결하기

::: info
이 예제는 `v0.7.1`의 컨트롤러와 경로 입력을 사용합니다. 기존 코드의 호환 규칙은 [라우트 전환](/ko/learn/migration/preview-controller-routes), [입력 전환](/ko/learn/migration/v0.7.1-preview), [OpenAPI](/ko/reference/api/openapi)를 참고하세요.
:::

주문 HTTP 서비스와 재고 소비 서비스를 각각 만들고 Kafka로 `order.created` 이벤트를 전달합니다. 주문 요청을 보낸 뒤 재고 서비스의 처리 로그까지 확인합니다. 재고 서비스는 HTTP 리스너 없이 실행합니다.

## 시작 전 준비

[CLI 설치](/ko/learn/getting-started/installation)를 완료한 뒤 CLI `v0.4.3-rc.1` 이상으로 Kafka 플랫폼과 소비자 골격을 생성합니다.

메시지 전달을 확인하려면 `localhost:9092`의 Kafka 브로커와 `order.created` 토픽이 필요합니다. 이 예제는 격리된 로컬 환경의 평문 연결을 사용합니다. 재고 소비자는 이벤트를 로그로 남기며, 실제 재고 수량은 변경하지 않습니다.

## 1. 두 서비스 생성

작업 디렉터리를 만들고 생성할 파일을 먼저 확인합니다.

아래 명령은 정식 의존성 채널을 선택합니다. 호환되는 정식 플랫폼 태그가 아직 없다면 검증에 `--channel rc`를 사용하고, 선택된 버전을 `go.mod`에서 확인하세요.

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --layout legacy --module example.com/order-app --event-platform kafka --channel main --no-interactive --dry-run
spine new stock-app --layout legacy --module example.com/stock-app --platform none --event-platform kafka --channel main --no-interactive --dry-run
```

미리보기를 확인한 뒤 두 앱을 생성합니다. 이후 명령은 별도 안내가 없으면 `spine-msa/`에서 실행합니다.

```sh
spine new order-app --layout legacy --module example.com/order-app --event-platform kafka --channel main --no-interactive
spine new stock-app --layout legacy --module example.com/stock-app --platform none --event-platform kafka --channel main --no-interactive
```

## 2. 재고 소비자 골격 생성

`stock-app`에 주문 이벤트를 받을 소비자를 생성합니다. 먼저 미리보기를 확인합니다.

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

다음 명령은 소비자 파일을 만들고 `stock-app/internal/application/application.go`에 `order.Register(app)` 호출과 오류 확인 코드를 추가합니다. 생성 직후 핸들러는 미구현 오류를 반환하므로 5단계의 코드로 교체해야 검증을 통과합니다.

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

### 파일 배치

공유 이벤트와 주문 컨트롤러를 추가하고 생성된 소비자 구현과 앱 설정을 교체하면 다음 구조가 됩니다.

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

`--event-platform kafka`가 생성한 `platform_config.go`와 두 테스트 파일을 유지합니다. 아래 `BuildApplication`은 생성된 `loadKafkaConfig`로 환경 설정을 검사한 뒤 주문 서비스는 발행만, 재고 워커는 소비만 선택합니다. 실행 시 각 터미널에서 브로커와 그룹 설정을 전달합니다.

## 3. 공유 이벤트 정의

`order-app/src/events/order_created.go`를 새로 만듭니다. 두 서비스는 이 패키지의 이벤트 타입을 함께 사용합니다. `stock-app`이 `order-app`의 이벤트 패키지를 가져올 수 있도록 6단계에서 `go mod edit`로 로컬 모듈을 연결합니다.

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

## 4. 주문 서비스에서 이벤트 발행

`order-app/src/controller/order_controller.go`를 새로 만들고 `order-app/internal/application/application.go`를 아래 코드로 교체합니다. 루트의 `main.go`와 `spine.toml`은 그대로 사용합니다.

`publish.Event`는 현재 요청에 이벤트를 추가하며 반환값이 없습니다. 핸들러가 성공하고 응답 준비가 끝나면 설정한 Kafka 발행기가 이벤트를 보냅니다.

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
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/input"
)

type OrderController struct{}

func (*OrderController) Constructor() *OrderController { return &OrderController{} }

func (c *OrderController) RegisterRoutes(r *api.Registry) {
    r.POST("/orders/:order_id", c.Create)
}

func (c *OrderController) Create(ctx context.Context, id input.Path[int64]) (httpx.Response[string], error) {
    if *id <= 0 {
        return httpx.Response[string]{}, httperr.BadRequest("order ID must be positive")
    }
    publish.Event(ctx, events.OrderCreated{
        EventID: fmt.Sprintf("order.created:%d", *id),
        OrderID: *id,
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
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 5. 재고 서비스에서 이벤트 처리

다음 세 파일을 각각 아래 코드로 교체합니다. `order_message.go`는 공유 이벤트의 타입 별칭으로 바꾸고, `order_handler.go`는 미구현 오류 대신 검증과 중복 확인, 로그 출력을 구현합니다. 생성된 `module.go`는 그대로 사용합니다.

`stock-app/internal/application/application.go`의 전체 교체 코드에는 `order.Register(app)`가 포함되어 있습니다. 생성 시 추가된 등록 코드를 다시 덧붙이지 마세요.

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

## 6. 로컬 모듈 연결과 코드 검증

두 서비스는 각각 독립된 `go.mod`와 `spine.toml`을 사용합니다. 다음 명령은 `spine-msa/`에서 시작해 두 모듈을 연결하고 검사한 뒤 같은 위치로 돌아옵니다. 각 앱에 생성된 `main.go`는 `BuildApplication`, `Validate`, `Run`을 순서대로 실행합니다.

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

이 예제의 factory는 로컬 평문 연결을 명시적으로 허용합니다. CLI의 정적 계약 검사는 factory의 설정값을 실행하거나 보안 연결과 브로커 준비 상태를 증명하지 않습니다.

`contract check`는 정적 계약을 검사합니다. `verify`는 정적 계약과 gofmt, go vet, Go 테스트를 검사합니다. 브로커 연결과 실제 메시지 전달은 다음 단계에서 확인합니다.

## 7. 실행하고 이벤트 전달 확인

Kafka가 `localhost:9092`에서 실행 중이고 `order.created` 토픽이 있는지 확인합니다. 각 터미널의 작업 디렉터리는 `spine-msa/`로 맞춥니다.

첫 번째 터미널에서 재고 서비스를 실행합니다.

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=stock-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root stock-app
```

두 번째 터미널에서 주문 서비스를 실행합니다.

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=order-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root order-app
```

세 번째 터미널에서 주문 생성 요청을 보냅니다.

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

HTTP 202와 본문 `accepted`가 반환되는지 확인합니다. 이어 재고 서비스 터미널에서 `topic=order.created order_id=12345` 로그를 확인합니다. HTTP 응답은 주문 요청의 결과이고, 재고 서비스의 로그는 이벤트 소비 결과입니다. 둘을 확인해야 서비스 사이의 전달을 검증할 수 있습니다.

## 운영에 적용하기 전 확인할 점

### 전송 보안과 토픽 이름

`AllowInsecureTransport: true`는 격리된 로컬 평문 브로커에만 사용합니다. 운영에서는 이 옵션을 제거하고 TLS/SASL과 브로커 주소를 설정합니다. 기본 전송은 TLS 1.2 이상을 사용합니다. 전송 설정을 직접 지정한다면 읽기와 쓰기를 모두 보호해야 합니다.

`Config.TopicPrefix`는 발행 이름과 소비 구독 모두에 접두사를 붙입니다. 양쪽 factory에 `prod.`를 설정하면 앱에는 `order.created`를 등록하고 브로커 토픽은 `prod.order.created`로 준비합니다. 접두사에는 구분자를 직접 포함합니다.

### 중복 처리와 실패 메시지

Kafka는 메시지를 최소 한 번 전달하므로 같은 이벤트가 다시 들어올 수 있습니다. 같은 이벤트를 다시 보낼 때도 유지되는 이벤트 ID와 영속적인 중복 처리 방지가 필요합니다. 이 예제의 중복 처리 방지는 같은 프로세스 안에서만 유효합니다. 실제 재고 변경과 영속적인 중복 처리 방지는 같은 DB 트랜잭션으로 구현해야 합니다.

`spine.WithEventConsumerRetry`는 리더와 전송 계층의 재구성을 조정하며 업무 핸들러의 재시도 횟수를 제한하지 않습니다. 계속 실패하는 메시지는 파티션을 막을 수 있습니다. 메시지를 자동으로 건너뛰거나 DLQ로 옮기지 않습니다.

### DB 변경과 이벤트 발행

DB 커밋과 브로커 발행은 하나의 원자적 작업이 아닙니다. DB 변경과 이벤트 전달을 일관되게 처리해야 한다면 transactional outbox와 소비자 중복 처리 방지를 별도로 구현하세요.

## 다음 단계

[보안 설정](/ko/reference/security-configuration)에서 Kafka 연결 설정을 확인하세요. 실제 재고 저장소를 연결할 때는 이벤트 ID를 영속적으로 기록하고 재고 변경과 함께 커밋하도록 구성하세요.
