# spine.App

`App`은 생성자, HTTP 라우트, 인터셉터, 이벤트 소비자, WebSocket 핸들러와 사용자 정의 전송 방식을 등록하고 애플리케이션을 실행하는 진입점입니다. 이 참조는 Spine v0.6.5의 공개 API와 부트 옵션을 다룹니다.

```go
import (
    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
)
```

## 인터페이스 정의

```go
type App interface {
    Constructor(constructors ...any)
    Route(method string, path string, handler any, opts ...router.RouteOption)
    Interceptor(interceptors ...core.Interceptor)
    InterceptorFor(scope boot.InterceptorScope, interceptors ...core.Interceptor)
    RegisterTransport(t core.CustomTransport)
    Validate(opts boot.Options) error
    Prepare(ctx context.Context, opts boot.Options) (PreparedApplication, error)
    Run(opts boot.Options) error
    RunContext(ctx context.Context, opts boot.Options) error
    Consumers() *consumer.Registry
    WebSocket() *ws.Registry
}
```

`Route`의 옵션은 앱 코드에서 `pkg/route`의 함수를 사용해 전달합니다. 반환 타입이 내부 패키지에 있는 `Consumers()`와 `WebSocket()`도 타입을 직접 선언하지 않고 메서드를 이어 호출할 수 있습니다.

## 생성자

### New

```go
func New(options ...Option) App
```

`spine.New(options ...Option)`에 필요한 구현을 전달합니다. HTTP 앱은 `spine.New(echoplatform.Option())`를 사용합니다. HTTP 없는 워커는 HTTP 옵션을 생략하고 필요한 이벤트 factory를 등록합니다.

새로운 Spine 애플리케이션 인스턴스를 생성합니다.

**반환값**

- `App` - 애플리케이션 인스턴스

**예시**

```go
app := spine.New(echoplatform.Option())
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

## 구현 선택 옵션 {#platform-options}

HTTP는 Echo, WebSocket은 독립 Gorilla 구현을 선택해야 합니다. WS 등록이 있으면 HTTP의 업그레이드 지원과 WS factory가 모두 필요합니다. 검증기를 선택하려면 `playground.New()`의 결과를 `spine.WithValidator`로 전달합니다.

| 옵션 | 연결하는 구현 |
| --- | --- |
| `spine.WithHTTPAdapter(factory)` | `echoplatform.Option()` / `contract/http` |
| `spine.WithWebSocketAdapter(factory)` | `gorillaplatform.Option()` / `contract/websocket` |
| `spine.WithEventAdapter(name, factory, options...)` | Kafka / RabbitMQ / `contract/event` |
| `spine.WithValidator(validator)` | playground / `contract/validator` |

[플랫폼과 DTO 검증 선택](/ko/learn/getting-started/platforms)

## 메서드

### Constructor

```go
Constructor(constructors ...any)
```

의존성 주입 컨테이너에 생성자 함수를 등록합니다. 생성자의 매개변수 타입에 맞춰 다른 등록된 객체를 주입합니다.

**매개변수**

- `constructors` - 생성자 함수들 (가변 인자)

**생성자 규칙**

- 함수여야 합니다
- 반환값은 정확히 하나여야 합니다
- 매개변수 타입을 제공하는 생성자도 등록해야 합니다

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

// 이벤트 소비자 생성자
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

HTTP 라우트를 등록합니다. `method`의 앞뒤 공백은 제거하고 대문자로 변환합니다.

**매개변수**

- `method` - HTTP 메서드 (`"GET"`, `"POST"`, `"PUT"`, `"DELETE"` 등). 대소문자 무시
- `path` - URL 경로 패턴. `:param` 형식으로 경로 매개변수 정의
- `handler` - 컨트롤러 메서드 표현식
- `opts` - 라우트 옵션 (선택)

**경로 패턴**
- `/users` - 정적 경로
- `/users/:id` - 단일 매개변수
- `/users/:userId/posts/:postId` - 다중 매개변수

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

`route.WithInterceptors`로 특정 라우트에만 인터셉터를 적용합니다.

```go
import "github.com/NARUBROWN/spine/pkg/route"

// 라우트별 인터셉터 적용
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// 타입이 있는 nil 포인터는 컨테이너에서 조회
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// 여러 인터셉터 적용
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors(
        (*AuthInterceptor)(nil),
        &AdminRoleInterceptor{},
    ),
)
```

### Interceptor

```go
Interceptor(interceptors ...core.Interceptor)
```

HTTP 요청과 WebSocket 메시지에 전역 인터셉터를 등록합니다. `app.Interceptor(...)`는 `app.InterceptorFor(boot.InterceptorAll, ...)`과 같습니다. 등록 순서대로 `PreHandle`이 실행되고, 역순으로 `PostHandle`, `BeforeResponse`, `AfterCompletion`이 실행됩니다.

같은 포인터 인스턴스를 여러 범위에 등록하면 범위를 합쳐 한 번 실행합니다. 같은 타입이어도 서로 다른 인스턴스는 각각 실행합니다. `(*AuthInterceptor)(nil)`처럼 타입이 있는 nil 포인터를 등록하면 컨테이너에서 공유 인스턴스를 찾아 사용합니다.

**매개변수**

- `interceptors`: 인터셉터 인스턴스 목록

**실행 순서**

1. 전역 인터셉터의 `PreHandle`을 등록 순서로 실행합니다.
2. 라우팅 후 입력값을 해석합니다.
3. 라우트 인터셉터의 `PreHandle`을 등록 순서로 실행합니다.
4. 컨트롤러를 실행하고 응답을 준비한 뒤 실행 후 훅을 호출합니다.
5. 라우트 인터셉터, 전역 인터셉터 순서로 `PostHandle`을 실행합니다. 각각 등록의 역순입니다.
6. 같은 역순으로 `BeforeResponse`를 실행한 뒤 실제 응답을 기록합니다.
7. 응답 처리 후 같은 역순으로 `AfterCompletion`을 실행합니다.

오류와 중단 시의 동작은 [인터셉터 참조](/ko/reference/api/interceptor)를 참고하십시오.

**예시**

```go
app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "OPTIONS"},
        AllowHeaders: []string{"Content-Type"},
    }),
    &LoggingInterceptor{},
)
```

### InterceptorFor

```go
InterceptorFor(scope boot.InterceptorScope, interceptors ...core.Interceptor)
```

전역 인터셉터를 적용할 전송 방식을 선택합니다. 이벤트 소비자에는 적용하지 않습니다.

| 범위 | 적용 대상 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP 요청 |
| `boot.InterceptorWebSocket` | WebSocket 메시지와 지원하는 연결 전 처리 |
| `boot.InterceptorAll` | 두 범위 모두 |

```go
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsAuthInterceptor)
app.InterceptorFor(boot.InterceptorAll, loggingInterceptor)
```

### WithEcho

```go
echoplatform.WithEcho(fn func(*echo.Echo)) echoplatform.EchoOption
```

Echo 확장은 플랫폼 생성 시 `*echo.Echo` 타입을 받는 `WithEcho` 옵션으로 등록합니다. 아래 코드로 기존 `app := spine.New(echoplatform.Option())`를 교체하고 기존 생성자와 라우트 등록은 이어서 유지합니다. `App.Transport`는 Spine v0.6.0에서 제거되었습니다.

```go
import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/labstack/echo/v5"
    "github.com/labstack/echo/v5/middleware"
)

app := spine.New(echoplatform.Option(echoplatform.WithEcho(func(e *echo.Echo) {
    e.Use(middleware.RequestID())
    e.Static("/static", "public")
})))
```

플랫폼 옵션으로 추가한 native Echo 경로는 Spine의 HTTP 인터셉터와 응답 staging을 거치지 않으며 CLI의 정적 Spine 라우트 계약에도 포함되지 않습니다. 실제 경로는 별도로 확인하세요.

### RegisterTransport

```go
RegisterTransport(t core.CustomTransport)
```

HTTP 파이프라인과 독립적으로 실행할 전송 방식을 등록합니다. 예를 들어 gRPC 서버를 Spine의 의존성 주입과 시작 및 종료 흐름에 연결할 때 사용합니다.

**매개변수**

- `t` - `core.CustomTransport` 인터페이스 구현체

**CustomTransport 인터페이스**
```go
// core/transport.go
type CustomTransport interface {
    // Init은 DI 컨테이너 준비 이후 호출됩니다.
    Init(container Container) error
    // Start는 Init 이후 별도 고루틴에서 호출됩니다.
    Start() error
    // Stop은 정상 종료 시 호출됩니다.
    Stop(ctx context.Context) error
}

type Container interface {
    Resolve(t reflect.Type) (any, error)
}
```

**예시**

```go
type GRPCTransport struct {
    server *grpc.Server
}

func (t *GRPCTransport) Init(container core.Container) error {
    // 컨테이너에서 서비스 조회
    svc, err := container.Resolve(reflect.TypeOf((*MyService)(nil)))
    if err != nil {
        return err
    }
    t.server = grpc.NewServer()
    RegisterMyServiceServer(t.server, svc.(*MyService))
    return nil
}

func (t *GRPCTransport) Start() error {
    lis, err := net.Listen("tcp", ":9090")
    if err != nil {
        return err
    }
    return t.server.Serve(lis)
}

func (t *GRPCTransport) Stop(ctx context.Context) error {
    t.server.GracefulStop()
    return nil
}

app.RegisterTransport(&GRPCTransport{})
```

### RunContext / Prepare

```go
RunContext(ctx context.Context, opts boot.Options) error
Prepare(ctx context.Context, opts boot.Options) (PreparedApplication, error)

type PreparedApplication interface {
    Handler() http.Handler
    Close(ctx context.Context) error
}
```

`RunContext`는 context 취소로 정상 종료를 시작합니다. `Prepare`는 리스너 없이 앱을 준비하고 `Handler()`와 `Close(ctx)`를 반환합니다. consumer와 custom transport의 Start는 실행하지 않지만, 설정에 따라 broker readiness와 custom Init에서 네트워크 연결이 발생할 수 있습니다. 준비 결과의 Close와 외부 HTTP 서버의 종료는 호출자가 관리합니다.

### Consumers

```go
Consumers() *consumer.Registry
```

이벤트 소비자 등록용 레지스트리를 반환합니다. Kafka나 RabbitMQ에서 수신할 이벤트 이름과 핸들러를 등록합니다. 소비자 생성자도 `Constructor`로 등록해야 합니다.

**반환값**

- `*consumer.Registry` - 소비자 레지스트리

**예시**

```go
// 이벤트 소비자 등록
app.Consumers().Register(
    "order.created",            // 토픽/이벤트 이름
    (*OrderConsumer).OnCreated, // 핸들러 메서드
)

app.Consumers().Register(
    "stock.created",
    (*StockConsumer).OnCreated,
)
```

#### 이벤트 핸들러

이벤트 핸들러는 표준 컨텍스트, 이벤트 이름과 이벤트 DTO를 매개변수로 받을 수 있습니다.

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

### WebSocket

```go
WebSocket() *ws.Registry
```

WebSocket 레지스트리를 반환합니다. WebSocket 경로와 핸들러를 등록합니다.

**반환값**

- `*ws.Registry` - WebSocket 레지스트리

**예시**

```go
if err := app.WebSocket().Register("/ws/chat", (*ChatController).OnMessage); err != nil {
    log.Fatal(err)
}
```

#### WebSocket 핸들러

WebSocket 핸들러는 `ws` 패키지의 연결 ID와 메시지 DTO를 매개변수로 받습니다. 다음 예는 연결별 전송 객체를 저장하고 메시지를 전체 연결에 전송합니다. `ChatController` 생성자는 `Constructor`로 등록합니다.

```go
import "github.com/NARUBROWN/spine/pkg/ws"

type ChatController struct {
    mu      sync.RWMutex
    clients map[string]ws.Sender
}

func NewChatController() *ChatController {
    return &ChatController{clients: make(map[string]ws.Sender)}
}

type ChatMessage struct {
    Message string `json:"message"`
}

type ChatEvent struct {
    Type    string `json:"type"`
    From    string `json:"from"`
    Message string `json:"message"`
    At      string `json:"at"`
}

func (c *ChatController) OnMessage(
    ctx context.Context,
    connID ws.ConnectionID,
    msg ChatMessage,
) error {
    sender, ok := ctx.Value(ws.SenderKey).(ws.Sender)
    if ok && sender != nil {
        c.mu.Lock()
        c.clients[connID.Value] = sender
        c.mu.Unlock()
    }

    message := strings.TrimSpace(msg.Message)
    if message == "" {
        return nil
    }

    payload, err := json.Marshal(ChatEvent{
        Type:    "message",
        From:    connID.Value,
        Message: message,
        At:      time.Now().UTC().Format(time.RFC3339),
    })
    if err != nil {
        return err
    }

    c.mu.RLock()
    clients := make(map[string]ws.Sender, len(c.clients))
    for id, client := range c.clients {
        clients[id] = client
    }
    c.mu.RUnlock()

    var firstErr error
    for id, client := range clients {
        if err := client.Send(ws.TextMessage, payload); err != nil {
            if firstErr == nil {
                firstErr = err
            }
            c.mu.Lock()
            delete(c.clients, id)
            c.mu.Unlock()
        }
    }
    return firstErr
}
```

WebSocket은 HTTP 서버와 같은 Echo 인스턴스에 경로를 등록하므로 `boot.Options.HTTP`가 필요합니다. 출처, 연결 수와 인증 설정은 [보안 설정](/ko/reference/security-configuration#websocket)을 참고하십시오.

### Validate

```go
Validate(opts boot.Options) error
```

네트워크 연결 없이 HTTP와 WebSocket 제한, 이벤트 factory 계약과 공통 정책, 검증기 등록을 검사합니다. `Run`도 같은 사전 검사를 수행합니다. 구체 브로커 `Config`는 플랫폼의 `NewFactory`에서 먼저 검사하므로 생성 오류도 확인해야 합니다.

부트 옵션 오류는 `*boot.ConfigError`의 `Issues`에서 `Path`, `Code`, `Message`, `Hint`를 확인합니다. 이벤트, HTTP, WebSocket factory와 검증기 계약 오류도 반환할 수 있으므로 공개 오류에 `errors.Is`와 `errors.As`를 사용합니다. 유효한 구성이면 `nil`입니다.

`Validate`는 생성자의 의존성을 만들거나 브로커에 접속하지 않습니다. 생성자와 라우트의 적합성, DI 구성, 실제 인프라 연결까지 성공했다고 볼 수는 없습니다.

```go
options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

### Run

```go
Run(opts boot.Options) error
```

등록한 구성과 `boot.Options`에 따라 HTTP 서버, WebSocket, 이벤트 소비자와 사용자 정의 전송 방식을 시작합니다. 실행 중에는 종료 신호나 런타임 오류를 기다립니다. 설정이나 초기화, 실행 또는 종료에 실패하면 오류를 반환합니다.

```go
if err := app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
}); err != nil {
    log.Fatal(err)
}
```

## boot.Options

`boot.Options`는 HTTP 실행과 종료 정책을 지정합니다. HTTP를 실행할 때 `HTTP`를 지정합니다. 이벤트 연결과 역할은 외부 플랫폼 `Config`와 `spine.WithEventAdapter`에서 선택합니다.

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### 구조체 정의

```go
type Options struct {
    Address                string
    EnableGracefulShutdown bool
    ShutdownTimeout        time.Duration
    HTTP                   *HTTPOptions
}

type HTTPOptions struct {
    GlobalPrefix      string
    DisableRecover    bool
    ReadHeaderTimeout time.Duration
    ReadTimeout       time.Duration
    WriteTimeout      time.Duration
    IdleTimeout       time.Duration
    MaxHeaderBytes    int
    MaxBodyBytes      int64
    WebSocket         WebSocketOptions
}
```

| `Options` 필드 | 의미와 기본 동작 |
| --- | --- |
| `Address` | HTTP 서버가 수신할 주소. 예: `":8080"` |
| `EnableGracefulShutdown` | `true`이면 HTTP 서버에서 `SIGINT`, `SIGTERM`을 받아 정상 종료. 기본값 `false` |
| `ShutdownTimeout` | HTTP 종료와 사용자 정의 전송 방식 종료 시 사용할 대기 시간. `0`이면 10초. 음수 불가 |
| `HTTP` | HTTP와 WebSocket 설정. `nil`이면 HTTP 서버 비활성화 |

| `HTTPOptions` 필드 | `0` 또는 생략했을 때 | 제약 |
| --- | --- | --- |
| `GlobalPrefix` | 접두사 없음 | 아래 경로 규칙 적용 |
| `DisableRecover` | `false`, panic을 HTTP 500으로 바꾸는 복구 미들웨어 사용 | `true`이면 미들웨어 비활성화 |
| `ReadHeaderTimeout` | 5초 | 음수 불가 |
| `ReadTimeout` | 30초 | 음수 불가 |
| `WriteTimeout` | 30초 | 음수 불가 |
| `IdleTimeout` | 120초 | 음수 불가 |
| `MaxHeaderBytes` | 1 MiB | 음수 불가 |
| `MaxBodyBytes` | 32 MiB | 음수이면 본문 크기 제한 비활성화 |
| `WebSocket` | [WebSocket 기본값](/ko/reference/security-configuration#websocket) | `boot.WebSocketOptions` |

### GlobalPrefix 검증 규칙

`Validate`와 `Run`은 다음 규칙에 맞지 않는 값을 `HTTP_GLOBAL_PREFIX_INVALID` 설정 오류로 반환합니다. 빈 문자열은 접두사를 적용하지 않습니다.

- `"/"`로 시작해야 합니다
- `":"`(경로 매개변수)를 포함할 수 없습니다
- `"*"`(와일드카드)를 포함할 수 없습니다
- 끝의 `"/"`는 자동으로 제거됩니다

```go
// 유효한 접두사
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// Validate와 Run이 설정 오류 반환
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // '/'로 시작하지 않음
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // 경로 매개변수 포함
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // 와일드카드 포함
```

### 기본 사용

```go
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

### 정상 종료

```go
app.Run(boot.Options{
    Address:                ":8080",
    EnableGracefulShutdown: true,
    ShutdownTimeout:        10 * time.Second,
    HTTP: &boot.HTTPOptions{
        GlobalPrefix: "/api/v1",
    },
})
```

HTTP 정상 종료를 활성화하면 `SIGINT`, `SIGTERM`을 받아 새 요청의 유입을 닫고 처리 중인 요청을 기다립니다. WebSocket 연결을 닫고 이벤트 소비자를 중지한 뒤 사용자 정의 전송 방식의 `Stop(ctx)`를 호출합니다.

`ShutdownTimeout`은 HTTP 종료와 사용자 정의 전송 방식의 종료 컨텍스트에 적용합니다. 소비자의 `Stop`은 작업, ACK/NACK와 리더가 종료될 때까지 기다리므로 이 값을 전체 프로세스의 강제 종료 시한으로 해석하지 마십시오. HTTP 없이 소비자나 사용자 정의 전송 방식만 실행할 때도 종료 신호를 처리합니다.

### Recover 미들웨어

기본적으로 panic을 HTTP 500 응답으로 변환하는 복구 미들웨어가 활성화되어 있습니다.

```go
// Recover 비활성화
HTTP: &boot.HTTPOptions{
    DisableRecover: true,
}
```

## Kafka 설정

### factory 생성과 등록

`kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"`을 import합니다. `Config.Consume`과 `Config.Publish`로 역할을 선택하며 `Brokers`가 필요합니다. 소비자는 `GroupID`도 지정합니다. 다음 코드는 `BuildApplication` 안에서 사용하며 `echoplatform`, `spine`, `boot`, `time`도 import합니다.

```go
factory, err := kafkaplatform.NewFactory(kafkaplatform.Config{
    Brokers: []string{"kafka.example.com:9093"},
    Consume: true,
    Publish: true,
    GroupID: "orders",
    TopicPrefix: "prod.",
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory,
    spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{MaxAttempts: 5}),
    spine.WithEventSettlementTimeout(5 * time.Second),
))
```

### 정책과 제약

Kafka 플랫폼은 별도 설정이 없으면 TLS 1.2 이상을 적용합니다. `TLS`, `Dialer`, `Transport`로 CA, mTLS, SASL을 설정합니다. `AllowInsecureTransport: true`는 격리된 로컬 평문 연결에만 사용하며 명시적 TLS와 함께 지정할 수 없습니다. `NewFactory`는 설정만 검사합니다. `Prepare`와 `Run`은 등록된 소비자의 reader를 준비할 때 브로커와 토픽을 확인합니다. Kafka 발행 전용 앱은 브로커 연결 없이 기동할 수 있으므로 실제 발행으로 연결과 전달을 별도로 확인하세요.

`Config.TopicPrefix`는 발행 이름과 소비 구독 모두에 접두사를 붙입니다. 양쪽 factory에 `prod.`를 설정하면 앱에는 `order.created`를 등록하고 브로커 토픽은 `prod.order.created`로 준비합니다. 접두사에는 구분자를 직접 포함합니다.

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})`는 리더와 ACK/NACK 실패 뒤 재연결을 제어합니다. 기본값은 최초 100ms, 최대 5초, 배수 2, 지터 0.2, `MaxAttempts: 0`의 무제한 전송 재시도입니다. 핸들러 재시도 횟수나 DLQ 정책은 지정하지 않습니다. `WithEventSettlementTimeout`의 기본 ACK/NACK 제한은 5초입니다. Kafka의 처리 실패는 뒤의 offset 커밋으로 건너뛰지 않으며 영구 실패 메시지가 파티션을 막을 수 있습니다.

## RabbitMQ 설정

### factory 생성과 등록

`rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"`을 import합니다. 공통 `Config.Exchange`와 `Consume`, `Publish`를 설정합니다. 기본 URL은 `amqps://`이며 로컬 `amqp://`는 `AllowInsecureTransport: true`로 명시적으로 허용합니다. 다음 코드는 `BuildApplication` 안에서 사용합니다.

```go
factory, err := rabbitmqplatform.NewFactory(rabbitmqplatform.Config{
    URL: "amqps://user:pass@rabbit.example.com/vhost",
    Exchange: "events",
    Consume: true,
    Publish: true,
    PrefetchCount: 16,
    FailurePolicy: rabbitmqplatform.FailureReject,
    DeadLetter: &rabbitmqplatform.DeadLetter{
        Exchange: "events.dlx",
        RoutingKey: "events.failed",
    },
    OperationTimeout: 5 * time.Second,
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory))
```

### 정책과 제약

`PrefetchCount`를 생략하면 소비자당 미확인 메시지는 1개입니다. 실패 정책의 기본값은 `rabbitmqplatform.FailureReject`이며 `FailureRequeue`는 처리 불가능한 메시지를 무기한 다시 전달할 수 있습니다. `DeadLetter`에 지정할 교환기는 먼저 준비해야 합니다. `TopicPrefix`는 발행 라우팅 키와 구독 바인딩에 적용하고 `QueuePrefix`는 큐 이름에 적용합니다.

발행기는 영속 메시지, mandatory 라우팅과 publisher confirm을 사용합니다. `OperationTimeout` 기본값은 5초입니다. 실패한 메시지를 자동 재발행하는 `PublisherRetry` 옵션은 없습니다. 확인 유실 뒤 앱이 재시도하면 중복이 생길 수 있으므로 소비자는 멱등하게 구현합니다.

## 이벤트 발행 {#event-publishing}

컨트롤러에서 도메인 이벤트를 수집하고, 등록된 Kafka나 RabbitMQ 발행기로 전송할 수 있습니다.

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

### 컨트롤러에서 발행

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

func (c *OrderController) Create(ctx context.Context, req *CreateOrderRequest) httpx.Response[Order] {
    order := c.repo.Save(req)

    // 이벤트 발행
    publish.Event(ctx, OrderCreated{
        OrderID: order.ID,
        At:      time.Now(),
    })

    return httpx.Response[Order]{Body: order}
}
```

`publish.Event()`는 `context.Context`에 연결된 이벤트 버스에 이벤트를 수집합니다. 컨트롤러 실행과 응답 준비가 성공하면 실행 후 훅에서 등록된 Kafka 또는 RabbitMQ 발행기로 일괄 전송합니다. 이 전송은 `BeforeResponse`보다 앞서 실행되므로 DB 트랜잭션의 커밋과 원자적으로 묶이지 않습니다. 원자적 처리가 필요하면 트랜잭셔널 아웃박스를 구성하십시오.

## CLI 프로젝트에서 사용

[첫 앱 만들기](/ko/learn/getting-started/first-app)에서 생성한 프로젝트는 `internal/application/application.go`의 `BuildApplication`에서 앱을 구성하고, 루트 `main.go`에서 `Validate` 오류를 확인한 뒤 `Run`을 호출합니다. 다음 명령으로 프로젝트를 점검할 수 있습니다.

```sh
spine doctor
spine contract check
spine verify
```

다음은 생성되는 `BuildApplication`의 기본 형태입니다.

```go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"os"

	"github.com/NARUBROWN/spine"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
	return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

// BuildApplication은 서버 실행, 계약 검사와 오프라인 검증이 함께 사용하는 앱 구성 함수입니다.
func BuildApplication() (spine.App, boot.Options, error) {
	app := spine.New(echoplatform.Option())
	app.Constructor(NewHealthController)
	app.Route("GET", "/health", (*HealthController).Get)

	address := ":8080"
	if port := os.Getenv("SPINE_PORT"); port != "" {
		address = ":" + port
	}
	return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## 시작과 종료 순서

`Run`은 옵션 사전 검증 후 의존성 주입 컨테이너와 이벤트 발행기를 구성합니다. 사용자 정의 전송 방식의 `Init`을 호출하고, HTTP와 WebSocket의 라우트 및 인터셉터를 해석하며 필요한 컨트롤러를 미리 생성합니다. 등록된 소비자가 있으면 브로커 런타임도 검증합니다.

이 준비가 끝난 뒤 소비자와 사용자 정의 전송 방식의 `Start`를 별도 고루틴에서 실행하고, 마지막에 HTTP 서버를 시작합니다. HTTP 라우트는 같은 메서드에서 경로가 모호하게 겹치면 시작에 실패합니다. 예를 들어 `/users/:id`와 `/users/me`는 겹치는 경로로 검사합니다.

종료 시에는 WebSocket과 HTTP로 들어오는 요청을 먼저 닫고, 소비자가 멈출 때까지 기다린 뒤 사용자 정의 전송 방식의 `Stop`을 초기화 역순으로 호출합니다. 이후 이벤트 발행기의 자원을 정리합니다. 구체적인 구현은 [v0.6.5 시작 및 종료 코드](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/bootstrap/bootstrap.go)를 참고하십시오.

## 제약과 오류

- 생성자는 반환값이 정확히 하나여야 합니다. `(T, error)`를 반환하는 생성자는 등록할 수 없습니다.
- HTTP 입력 DTO는 포인터로 받고, 성공 응답은 `httpx.Response[T]`처럼 지원하는 응답 타입으로 반환합니다. [컨트롤러 작성법](/ko/learn/tutorial/2-controller)을 참고하십시오.
- `Validate`에 성공해도 `Run`에서 생성자, 의존성, 라우트 또는 브로커 연결 오류가 발생할 수 있습니다. 두 메서드의 반환 오류를 모두 확인하십시오.
- WebSocket 경로를 등록하고 `HTTP`를 생략하면 `WEBSOCKET_HTTP_REQUIRED` 설정 오류가 발생합니다.
- `InterceptorFor`의 범위는 `InterceptorHTTP`, `InterceptorWebSocket`, `InterceptorAll` 중 하나를 사용합니다. `0`이나 지원하지 않는 비트가 있으면 `INTERCEPTOR_SCOPE_INVALID` 설정 오류가 발생합니다.
- 네트워크 전송, 이벤트 발행과 DB 커밋은 하나의 원자적 작업이 아닙니다. 재시도와 중복 처리가 필요한지 앱에서 결정해야 합니다.

## 참고

- [인터셉터](/ko/reference/api/interceptor): 공개 인터페이스와 실행 순서
- [실행 파이프라인](/ko/learn/core-concepts/pipeline) - 요청 처리 흐름
- [Spine 소개](/ko/learn/getting-started/intro): 의존성 주입과 주요 개념
