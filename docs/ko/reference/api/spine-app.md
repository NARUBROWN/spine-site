# spine.App

메인 애플리케이션 인터페이스에 대한 API 참조.

## 개요

`App`은 Spine 애플리케이션의 진입점입니다. 생성자 등록, 라우트 정의, Interceptor 설정, 이벤트 컨슈머 등록, 서버 실행을 담당합니다.

```go
import "github.com/NARUBROWN/spine"
```

## 인터페이스 정의

```go
type App interface {
    // 생성자 선언
    Constructor(constructors ...any)
    // 라우트 선언
    Route(method string, path string, handler any, opts ...router.RouteOption)
    // 인터셉터 선언
    Interceptor(interceptors ...core.Interceptor)
    // HTTP Transport 확장 (Echo 등)
    Transport(fn func(any))
    // 실행
    Run(opts boot.Options) error
    // 이벤트 소비자 레지스트리 반환
    Consumers() *consumer.Registry
}
```

## 생성자

### New

```go
func New() App
```

새로운 Spine 애플리케이션 인스턴스를 생성합니다.

**반환값**
- `App` - 애플리케이션 인스턴스

**예시**
```go
app := spine.New()
app.Run(boot.Options{
    Address: ":8080",
})
```


## 메서드

### Constructor

```go
Constructor(constructors ...any)
```

IoC Container에 생성자 함수를 등록합니다. 등록된 생성자는 의존성 주입에 사용됩니다.

**매개변수**
- `constructors` - 생성자 함수들 (가변 인자)

**생성자 규칙**
- 함수여야 합니다
- 반환값은 정확히 하나여야 합니다
- 매개변수는 다른 등록된 타입이어야 합니다 (의존성)

**예시**
```go
// 의존성 없는 생성자
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// 의존성 있는 생성자
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

// 이벤트 컨슈머 생성자
func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

app.Constructor(
    NewUserRepository,
    NewUserController,
    NewOrderConsumer,
)
```

### Route

```go
Route(method string, path string, handler any, opts ...router.RouteOption)
```

HTTP 라우트를 등록합니다.

**매개변수**
- `method` - HTTP 메서드 (`"GET"`, `"POST"`, `"PUT"`, `"DELETE"` 등)
- `path` - URL 경로 패턴. `:param` 형식으로 경로 파라미터 정의
- `handler` - Controller 메서드 표현식
- `opts` - 라우트 옵션 (선택)

**경로 패턴**
- `/users` - 정적 경로
- `/users/:id` - 단일 파라미터
- `/users/:userId/posts/:postId` - 다중 파라미터

**예시**
```go
// 기본 라우트
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// 중첩 경로
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

#### 라우트 옵션

`route.WithInterceptors`를 사용하여 특정 라우트에만 Interceptor를 적용할 수 있습니다.

```go
import "github.com/NARUBROWN/spine/pkg/route"

// 라우트별 Interceptor 적용
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// 여러 Interceptor 적용
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors(
        &AuthInterceptor{},
        &AdminRoleInterceptor{},
    ),
)
```

### Interceptor

```go
Interceptor(interceptors ...core.Interceptor)
```

전역 Interceptor를 등록합니다. 등록 순서대로 `PreHandle`이 실행되고, 역순으로 `PostHandle`과 `AfterCompletion`이 실행됩니다.

**매개변수**
- `interceptors` - Interceptor 인스턴스들 (가변 인자)

**실행 순서**
1. 전역 Interceptor (등록 순서)
2. 라우트 Interceptor (등록 순서)
3. Controller 실행
4. 라우트 Interceptor PostHandle (역순)
5. 전역 Interceptor PostHandle (역순)

**예시**
```go
app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "OPTIONS"},
        AllowHeaders: []string{"Content-Type"},
    }),
    &LoggingInterceptor{},
    &AuthInterceptor{},
)
```

### Transport

```go
Transport(fn func(any))
```

HTTP Transport(Echo) 확장 훅을 등록합니다. Echo 인스턴스에 직접 접근하여 미들웨어나 설정을 추가할 수 있습니다.

**매개변수**
- `fn` - Echo 인스턴스를 받는 콜백 함수

**예시**
```go
import "github.com/labstack/echo/v4"
import "github.com/labstack/echo/v4/middleware"

app.Transport(func(e any) {
    echo := e.(*echo.Echo)
    
    // Echo 미들웨어 추가
    echo.Use(middleware.Recover())
    echo.Use(middleware.RequestID())
    
    // 정적 파일 서빙
    echo.Static("/static", "public")
})
```

### Consumers

```go
Consumers() *consumer.Registry
```

이벤트 컨슈머 레지스트리를 반환합니다. Kafka, RabbitMQ 등의 메시지 브로커에서 이벤트를 수신하는 핸들러를 등록합니다.

**반환값**
- `*consumer.Registry` - 컨슈머 레지스트리

**예시**
```go
// 이벤트 컨슈머 등록
app.Consumers().Register(
    "order.created",           // 토픽/이벤트 이름
    (*OrderConsumer).OnCreated, // 핸들러 메서드
)

app.Consumers().Register(
    "stock.created",
    (*StockConsumer).OnCreated,
)
```

#### 컨슈머 핸들러

컨슈머 핸들러는 HTTP 컨트롤러와 유사한 시그니처를 가집니다.

```go
type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

// 이벤트 핸들러
func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("이벤트 수신:", eventName)
    log.Println("주문 ID:", event.OrderID)
    return nil
}

// 이벤트 DTO
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}
```

### Run

```go
Run(opts boot.Options) error
```

애플리케이션을 시작합니다. HTTP 서버와 이벤트 컨슈머 런타임을 함께 구동합니다.

**매개변수**
- `opts` - 부트 옵션 (`boot.Options`)

**반환값**
- `error` - 서버 시작 실패 시 에러

**예시**
```go
if err := app.Run(boot.Options{Address: ":8080"}); err != nil {
    log.Fatal(err)
}
```


## boot.Options

애플리케이션 부트스트랩 옵션입니다.

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### 구조체 정의

```go
type Options struct {
    // 서버가 바인딩될 주소 (예: ":8080")
    Address string

    // Graceful Shutdown 활성화 여부
    EnableGracefulShutdown bool

    // Graceful Shutdown 시 최대 대기 시간
    ShutdownTimeout time.Duration

    // Kafka 이벤트 인프라 설정
    // nil인 경우 Kafka는 구성되지 않음
    Kafka *KafkaOptions

    // RabbitMQ 이벤트 인프라 설정
    // nil인 경우 RabbitMQ는 구성되지 않음
    RabbitMQ *RabbitMqOptions
}
```

### 기본 사용

```go
app.Run(boot.Options{
    Address: ":8080",
})
```

### Graceful Shutdown

```go
app.Run(boot.Options{
    Address:                ":8080",
    EnableGracefulShutdown: true,
    ShutdownTimeout:        10 * time.Second,
})
```

Graceful Shutdown이 활성화되면:
- `SIGINT`, `SIGTERM` 시그널을 수신합니다
- 진행 중인 요청이 완료될 때까지 대기합니다
- `ShutdownTimeout` 후 강제 종료됩니다


## Kafka 설정

### KafkaOptions

```go
type KafkaOptions struct {
    // Kafka 브로커 주소 목록
    Brokers []string

    // 이벤트 소비(Consumer) 설정
    // nil이면 Kafka Consumer는 활성화되지 않음
    Read *KafkaReadOptions

    // 이벤트 발행(Producer) 설정
    // nil이면 Kafka로 이벤트를 발행하지 않음
    Write *KafkaWriteOptions
}

type KafkaReadOptions struct {
    // Kafka Consumer Group ID
    GroupID string
}

type KafkaWriteOptions struct {
    // 이벤트 이름 앞에 붙일 Topic Prefix
    TopicPrefix string
}
```

### 예시

```go
app.Run(boot.Options{
    Address: ":8080",
    Kafka: &boot.KafkaOptions{
        Brokers: []string{"localhost:9092"},
        Read: &boot.KafkaReadOptions{
            GroupID: "my-consumer-group",
        },
        Write: &boot.KafkaWriteOptions{
            TopicPrefix: "myapp.",
        },
    },
})
```


## RabbitMQ 설정

### RabbitMqOptions

```go
type RabbitMqOptions struct {
    // RabbitMQ AMQP 연결 문자열
    // 예: amqp://guest:guest@localhost:5672/
    URL string

    // 이벤트 소비(Consumer) 설정
    // nil이면 RabbitMQ Consumer는 활성화되지 않음
    Read *RabbitMqReadOptions

    // 이벤트 발행(Publisher) 설정
    // nil이면 RabbitMQ로 이벤트를 발행하지 않음
    Write *RabbitMqWriteOptions
}

type RabbitMqReadOptions struct {
    // 메시지를 소비할 큐 이름
    Queue string
    // 큐가 바인딩될 Exchange 이름
    Exchange string
    // 라우팅 키 조건
    RoutingKey string
}

type RabbitMqWriteOptions struct {
    // 이벤트를 발행할 Exchange 이름
    Exchange string
    // 발행 시 사용할 라우팅 키
    RoutingKey string
}
```

### 예시

```go
app.Run(boot.Options{
    Address: ":8080",
    RabbitMQ: &boot.RabbitMqOptions{
        URL: "amqp://guest:guest@localhost:5672/",
        Read: &boot.RabbitMqReadOptions{
            Queue:      "order.events",
            Exchange:   "events-exchange",
            RoutingKey: "order.*",
        },
        Write: &boot.RabbitMqWriteOptions{
            Exchange:   "events-exchange",
            RoutingKey: "order.created",
        },
    },
})
```


## 이벤트 발행

Controller에서 도메인 이벤트를 발행할 수 있습니다.

### DomainEvent 인터페이스

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

type DomainEvent interface {
    Name() string
    OccurredAt() time.Time
}
```

### 이벤트 정의

```go
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}

func (e OrderCreated) Name() string {
    return "order.created"
}

func (e OrderCreated) OccurredAt() time.Time {
    return e.At
}
```

### Controller에서 발행

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

func (c *OrderController) Create(ctx context.Context, req *CreateOrderRequest) Order {
    order := c.repo.Save(req)
    
    // 이벤트 발행
    publish.Event(ctx, OrderCreated{
        OrderID: order.ID,
        At:      time.Now(),
    })
    
    return order
}
```


## 전체 예시

```go
package main

import (
    "context"
    "log"
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/event/publish"
    "github.com/NARUBROWN/spine/pkg/path"
    "github.com/NARUBROWN/spine/pkg/route"
)

func main() {
    app := spine.New()

    // 생성자 등록
    app.Constructor(
        NewUserController,
        NewOrderConsumer,
    )

    // 라우트 등록
    app.Route("GET", "/users", (*UserController).List)
    app.Route("GET", "/users/:id", (*UserController).GetUser)
    app.Route(
        "POST",
        "/orders/:orderId",
        (*UserController).CreateOrder,
        route.WithInterceptors(&LoggingInterceptor{}),
    )

    // 전역 Interceptor 등록
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
            AllowMethods: []string{"GET", "POST", "OPTIONS"},
            AllowHeaders: []string{"Content-Type"},
        }),
    )

    // 이벤트 컨슈머 등록
    app.Consumers().Register(
        "order.created",
        (*OrderConsumer).OnCreated,
    )

    // 서버 실행
    app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            Read: &boot.KafkaReadOptions{
                GroupID: "spine-demo-consumer",
            },
            Write: &boot.KafkaWriteOptions{
                TopicPrefix: "",
            },
        },
    })
}

// Controller
type UserController struct{}

func NewUserController() *UserController {
    return &UserController{}
}

func (c *UserController) CreateOrder(ctx context.Context, orderId path.Int) string {
    // 이벤트 발행
    publish.Event(ctx, OrderCreated{
        OrderID: orderId.Value,
        At:      time.Now(),
    })
    return "OK"
}

// Event
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}

func (e OrderCreated) Name() string {
    return "order.created"
}

func (e OrderCreated) OccurredAt() time.Time {
    return e.At
}

// Consumer
type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("이벤트 수신:", eventName)
    log.Println("주문 ID:", event.OrderID)
    return nil
}
```


## 부트스트랩 순서

`Run()` 호출 시 다음 순서로 초기화됩니다:

1. IoC Container 생성
2. 생성자 등록
3. Router 구성 및 HandlerMeta 생성
4. Controller Warm-up (의존성 미리 해결)
5. HTTP Pipeline 구성
   - ArgumentResolver 등록
   - ReturnValueHandler 등록
6. 이벤트 인프라 구성 (설정된 경우)
   - Kafka Publisher / Consumer
   - RabbitMQ Publisher / Consumer
7. Interceptor 등록
   - 전역 Interceptor
   - 라우트 Interceptor resolve
8. HTTP 서버 마운트
9. 이벤트 컨슈머 런타임 시작 (설정된 경우)
10. HTTP 서버 시작

### Graceful Shutdown 시

1. `SIGINT` / `SIGTERM` 시그널 수신
2. 이벤트 컨슈머 런타임 중지
3. HTTP 서버 Shutdown (타임아웃까지 대기)
4. 종료


## 참고

- [Interceptor](/ko/reference/api/interceptor) - Interceptor 인터페이스
- [실행 파이프라인](/ko/learn/core-concepts/pipeline) - 요청 처리 흐름
- [IoC Container](/ko/learn/getting-started/intro) - 의존성 주입