# spine.App

`App` is the entry point for registering constructors, HTTP routes, interceptors, event consumers, WebSocket handlers, and custom transports, and for running the application. This reference covers the public API and boot options in Spine v0.5.1.

```go
import "github.com/NARUBROWN/spine"
```

## Interface definition

```go
type App interface {
    // 생성자 선언
    Constructor(constructors ...any)
    // 라우트 선언
    Route(method string, path string, handler any, opts ...router.RouteOption)
    // 인터셉터 선언
    Interceptor(interceptors ...core.Interceptor)
    // HTTP/WebSocket 범위를 지정한 전역 인터셉터 선언
    InterceptorFor(scope boot.InterceptorScope, interceptors ...core.Interceptor)
    // HTTP 서버 확장 (Echo 등)
    Transport(fn func(any))
    // 독립 실행되는 사용자 정의 전송 방식 등록
    RegisterTransport(t core.CustomTransport)
    // 네트워크 연결 없이 설정 검증
    Validate(opts boot.Options) error
    // 실행
    Run(opts boot.Options) error
    // 이벤트 소비자 레지스트리 반환
    Consumers() *consumer.Registry
    // 웹소켓 레지스트리 반환
    WebSocket() *ws.Registry
}
```

Pass options to `Route` using functions from `pkg/route` in your application code. You can also chain method calls on the values returned by `Consumers()` and `WebSocket()` without declaring their types, even though those types belong to internal packages.

## Constructors

### New

```go
func New() App
```

Creates a new Spine application instance.

**Returns**

- `App` - The application instance

**Example**

```go
app := spine.New()
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

## Methods

### Constructor

```go
Constructor(constructors ...any)
```

Registers constructor functions with the dependency injection container. The container injects other registered objects according to the constructors' parameter types.

**Parameters**

- `constructors` - Constructor functions (variadic)

**Constructor rules**

- Must be a function
- Must return exactly one value
- Constructors that provide its parameter types must also be registered

**Example**

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

Registers an HTTP route. Leading and trailing whitespace in `method` is removed, and the method is converted to uppercase.

**Parameters**

- `method` - HTTP method (`"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, etc.). Case-insensitive
- `path` - URL path pattern. Define path parameters with `:param`
- `handler` - Controller method expression
- `opts` - Route options (optional)

**Path patterns**
- `/users` - Static path
- `/users/:id` - Single parameter
- `/users/:userId/posts/:postId` - Multiple parameters

**Example**

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

#### Route options

Use `route.WithInterceptors` to apply interceptors to a specific route.

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

Registers global interceptors for HTTP requests and WebSocket messages. `app.Interceptor(...)` is equivalent to `app.InterceptorFor(boot.InterceptorAll, ...)`. `PreHandle` runs in registration order; `PostHandle`, `BeforeResponse`, and `AfterCompletion` run in reverse order.

If you register the same pointer instance in multiple scopes, the scopes are combined and the instance runs once. Different instances run separately, even if they have the same type. If you register a typed nil pointer such as `(*AuthInterceptor)(nil)`, the container looks up and uses a shared instance.

**Parameters**

- `interceptors`: List of interceptor instances

**Execution order**

1. Run global interceptors' `PreHandle` in registration order.
2. Resolve inputs after routing.
3. Run route interceptors' `PreHandle` in registration order.
4. Execute the controller, prepare the response, and invoke the post-execution hooks.
5. Run `PostHandle` for route interceptors, followed by global interceptors. Each group runs in reverse registration order.
6. Run `BeforeResponse` in the same reverse order, then write the actual response.
7. After response processing, run `AfterCompletion` in the same reverse order.

For behavior on errors and aborted execution, see the [interceptor reference](/en/reference/api/interceptor).

**Example**

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

Selects the transports to which global interceptors apply. They do not apply to event consumers.

| Scope | Applies to |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP requests |
| `boot.InterceptorWebSocket` | WebSocket messages and supported processing before connection establishment |
| `boot.InterceptorAll` | Both scopes |

```go
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsAuthInterceptor)
app.InterceptorFor(boot.InterceptorAll, loggingInterceptor)
```

### Transport

```go
Transport(fn func(any))
```

Registers a callback that configures the HTTP server's Echo instance. Use the callback to add middleware or static file paths.

**Parameters**

- `fn` - Callback function that receives an Echo instance

**Example**

```go
import "github.com/labstack/echo/v4"
import "github.com/labstack/echo/v4/middleware"

app.Transport(func(e any) {
    echo := e.(*echo.Echo)

    // Echo 미들웨어 추가
    echo.Use(middleware.RequestID())

    // 정적 파일 서빙
    echo.Static("/static", "public")
})
```

### RegisterTransport

```go
RegisterTransport(t core.CustomTransport)
```

Registers a transport that runs independently of the HTTP pipeline. For example, use it to connect a gRPC server to Spine's dependency injection, startup, and shutdown flows.

**Parameters**

- `t` - Implementation of the `core.CustomTransport` interface

**CustomTransport interface**
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

**Example**

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

### Consumers

```go
Consumers() *consumer.Registry
```

Returns the registry for registering event consumers. Register event names and handlers for events received from Kafka or RabbitMQ. Consumer constructors must also be registered with `Constructor`.

**Returns**

- `*consumer.Registry` - Consumer registry

**Example**

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

#### Event handlers

Event handlers can accept a standard context, an event name, and an event DTO as parameters.

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

Returns the WebSocket registry. Register WebSocket paths and handlers with it.

**Returns**

- `*ws.Registry` - WebSocket registry

**Example**

```go
if err := app.WebSocket().Register("/ws/chat", (*ChatController).OnMessage); err != nil {
    log.Fatal(err)
}
```

#### WebSocket handlers

WebSocket handlers accept connection IDs and message DTOs from the `ws` package as parameters. The following example stores an object for sending to each connection and broadcasts messages to all connections. Register the `ChatController` constructor with `Constructor`.

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

WebSocket registers paths on the same Echo instance as the HTTP server, so it requires `boot.Options.HTTP`. For origin, connection limit, and authentication settings, see [security configuration](/en/reference/security-configuration#websocket).

### Validate

```go
Validate(opts boot.Options) error
```

Checks boot options without opening network connections or starting servers and consumers. It checks Kafka and RabbitMQ connection settings, HTTP and WebSocket limits, and global interceptor nil values and scopes, among other settings. `Run` performs the same checks before startup.

Returns `*boot.ConfigError` if any errors are found. Each item in `Issues` contains the configuration location in `Path`, the error category in `Code`, a description in `Message`, and guidance for fixing it in `Hint`. Returns `nil` for valid options.

`Validate` does not construct dependencies or connect to brokers. Success does not establish that constructors, routes, the DI configuration, or actual infrastructure connections will work.

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

Starts the HTTP server, WebSocket, event consumers, and custom transports according to the registered configuration and `boot.Options`. While running, it waits for a shutdown signal or runtime error. Returns an error if configuration, initialization, execution, or shutdown fails.

```go
if err := app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
}); err != nil {
    log.Fatal(err)
}
```

## boot.Options

Specifies how the server runs and whether to use external infrastructure. If `HTTP`, `Kafka`, or `RabbitMQ` is `nil`, the corresponding feature is not configured.

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### Struct definition

```go
type Options struct {
    Address                string
    EnableGracefulShutdown bool
    ShutdownTimeout        time.Duration
    Kafka                  *KafkaOptions
    RabbitMQ               *RabbitMqOptions
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

| `Options` field | Meaning and default behavior |
| --- | --- |
| `Address` | Address on which the HTTP server listens. Example: `":8080"` |
| `EnableGracefulShutdown` | If `true`, the HTTP server handles `SIGINT` and `SIGTERM` for graceful shutdown. Default: `false` |
| `ShutdownTimeout` | Wait time for HTTP shutdown and custom transport shutdown. `0` means 10 seconds. Must not be negative |
| `Kafka` | Kafka publishing and consumer settings. Disabled if `nil` |
| `RabbitMQ` | RabbitMQ publishing and consumer settings. Disabled if `nil` |
| `HTTP` | HTTP and WebSocket settings. The HTTP server is disabled if `nil` |

| `HTTPOptions` field | When `0` or omitted | Constraint |
| --- | --- | --- |
| `GlobalPrefix` | No prefix | The path rules below apply |
| `DisableRecover` | `false`; use recovery middleware that converts panics to HTTP 500 responses | `true` disables the middleware |
| `ReadHeaderTimeout` | 5 seconds | Must not be negative |
| `ReadTimeout` | 30 seconds | Must not be negative |
| `WriteTimeout` | 30 seconds | Must not be negative |
| `IdleTimeout` | 120 seconds | Must not be negative |
| `MaxHeaderBytes` | 1 MiB | Must not be negative |
| `MaxBodyBytes` | 32 MiB | A negative value disables the body size limit |
| `WebSocket` | [WebSocket defaults](/en/reference/security-configuration#websocket) | `boot.WebSocketOptions` |

### GlobalPrefix validation rules

`Validate` and `Run` return an `HTTP_GLOBAL_PREFIX_INVALID` configuration error for values that do not meet the following rules. An empty string applies no prefix.

- Must start with `"/"`
- Must not contain `":"` (path parameters)
- Must not contain `"*"` (wildcards)
- A trailing `"/"` is removed automatically

```go
// 유효한 접두사
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// Validate와 Run이 설정 오류 반환
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // '/'로 시작하지 않음
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // 경로 매개변수 포함
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // 와일드카드 포함
```

### Basic usage

```go
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

### Graceful shutdown

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

When HTTP graceful shutdown is enabled, the server handles `SIGINT` and `SIGTERM`, stops accepting new requests, and waits for requests in progress. It closes WebSocket connections, stops event consumers, and then calls `Stop(ctx)` on custom transports.

`ShutdownTimeout` applies to the shutdown contexts for HTTP and custom transports. Consumers' `Stop` waits for workers, ACK/NACK processing, and readers to finish, so do not interpret this value as a forced shutdown deadline for the entire process. Shutdown signals are also handled when running only consumers or custom transports without HTTP.

### Recover middleware

Recovery middleware that converts panics to HTTP 500 responses is enabled by default.

```go
// Recover 비활성화
HTTP: &boot.HTTPOptions{
    DisableRecover: true,
}
```

## Kafka configuration

### KafkaOptions

`Read` and `Write` are independent. Enabling either requires `Brokers`, and using `Read` also requires `GroupID`. TLS 1.2 or later is used unless separate transport settings are provided.

```go
type KafkaOptions struct {
    // Kafka 브로커 주소 목록
    Brokers []string

    // 사용자 정의 TLS, 리더 Dialer, 라이터 Transport
    TLS *tls.Config
    Dialer *kafka.Dialer
    Transport *kafka.Transport

    // 격리된 로컬 환경의 평문 연결 명시적 허용
    AllowInsecureTransport bool

    // 리더 오류와 ACK/NACK 실패 뒤 재연결 정책
    ConsumerRetry ConsumerRetryOptions

    // 이벤트 소비 설정
    // nil이면 Kafka 소비자를 활성화하지 않음
    Read *KafkaReadOptions

    // 이벤트 발행 설정
    // nil이면 Kafka로 이벤트를 발행하지 않음
    Write *KafkaWriteOptions
}

type KafkaReadOptions struct {
    // Kafka 소비자 그룹 ID
    GroupID string
}

type KafkaWriteOptions struct {
    // 이벤트 이름 앞에 붙일 토픽 접두사
    TopicPrefix string
}
```

### Example

```go
app.Run(boot.Options{
    Address: ":8080",
    Kafka: &boot.KafkaOptions{
        Brokers: []string{"localhost:9092"},
        AllowInsecureTransport: true, // 격리된 로컬 개발 환경 전용
        Read: &boot.KafkaReadOptions{
            GroupID: "my-consumer-group",
        },
        Write: &boot.KafkaWriteOptions{
            TopicPrefix: "myapp.",
        },
    },
    HTTP: &boot.HTTPOptions{},
})
```

## RabbitMQ configuration

### RabbitMqOptions

`Read` and `Write` are independent. Specify `Exchange` for each enabled role. An `amqps://` URL is required by default; explicitly allow plaintext `amqp://` only in an isolated development environment.

```go
type RabbitMqOptions struct {
    // RabbitMQ AMQP 연결 문자열
    // 예: amqp://guest:guest@localhost:5672/
    URL string

    // 로컬 amqp:// 연결 명시적 허용
    AllowInsecureTransport bool

    ConsumerRetry  ConsumerRetryOptions
    PublisherRetry PublisherRetryOptions

    // 이벤트 소비 설정
    // nil이면 RabbitMQ 소비자를 활성화하지 않음
    Read *RabbitMqReadOptions

    // 이벤트 발행 설정
    // nil이면 RabbitMQ로 이벤트를 발행하지 않음
    Write *RabbitMqWriteOptions
}

type RabbitMqReadOptions struct {
    // 큐를 바인딩할 교환기 이름
    Exchange string
    PrefetchCount int
    FailurePolicy RabbitMqFailurePolicy
    DeadLetter *RabbitMqDeadLetterOptions

    // Deprecated: FailurePolicy 사용 권장
    RequeueOnError bool
}

type RabbitMqWriteOptions struct {
    // 이벤트를 발행할 교환기 이름
    Exchange string
}
```

For failure policies and retry defaults, see [security configuration](/en/reference/security-configuration#rabbitmq). `RequeueOnError` exists for compatibility with earlier versions; use `FailurePolicy` in new code.

### Example

```go
app.Run(boot.Options{
    Address: ":8080",
    RabbitMQ: &boot.RabbitMqOptions{
        URL:                    "amqp://guest:guest@localhost:5672/",
        AllowInsecureTransport: true, // 격리된 로컬 개발 환경 전용
        Read: &boot.RabbitMqReadOptions{
            Exchange: "stock-exchange",
        },
        Write: &boot.RabbitMqWriteOptions{
            Exchange: "stock-exchange",
        },
    },
    HTTP: &boot.HTTPOptions{},
})
```

## Event publishing {#event-publishing}

You can collect domain events in controllers and send them through registered Kafka or RabbitMQ publishers.

### DomainEvent interface

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

type DomainEvent interface {
    Name() string
    OccurredAt() time.Time
}
```

### Event definition

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

### Publishing from a controller

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

`publish.Event()` collects events in the event bus attached to `context.Context`. Once controller execution and response preparation succeed, a post-execution hook sends the events as a batch through the registered Kafka or RabbitMQ publisher. This happens before `BeforeResponse`, so publishing is not atomic with the DB transaction commit. Configure a transactional outbox if you need atomic processing.

## Using App in a CLI project

Projects created in [Create your first app](/en/learn/getting-started/first-app) configure the app in `BuildApplication` in `internal/application/application.go`. The root `main.go` checks `Validate` errors before calling `Run`. You can check the project with the following commands.

```sh
spine doctor
spine contract check
spine verify
```

The following is the default structure of the generated `BuildApplication`.

```go
package application

import (
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
	app := spine.New()
	app.Constructor(NewHealthController)
	app.Route("GET", "/health", (*HealthController).Get)

	address := ":8080"
	if port := os.Getenv("SPINE_PORT"); port != "" {
		address = ":" + port
	}
	return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## Startup and shutdown order

After validating options, `Run` configures the dependency injection container and event publishers. It calls `Init` on custom transports, resolves HTTP and WebSocket routes and interceptors, and creates the required controllers in advance. If consumers are registered, it also validates the broker runtime.

Once this preparation is complete, it runs consumers and custom transports' `Start` in separate goroutines, then starts the HTTP server last. Startup fails if HTTP route paths overlap ambiguously for the same method. For example, `/users/:id` and `/users/me` are treated as overlapping paths.

During shutdown, it first stops incoming WebSocket and HTTP requests, waits for consumers to stop, and then calls custom transports' `Stop` in reverse initialization order. It then releases event publisher resources. For the implementation, see the [v0.5.1 startup and shutdown code](https://github.com/NARUBROWN/spine/blob/v0.5.1/internal/bootstrap/bootstrap.go).

## Constraints and errors

- Constructors must return exactly one value. You cannot register a constructor that returns `(T, error)`.
- Accept HTTP input DTOs as pointers, and return successful responses using supported response types such as `httpx.Response[T]`. See [Writing controllers](/en/learn/tutorial/2-controller).
- Even if `Validate` succeeds, `Run` can still fail because of constructors, dependencies, routes, or broker connections. Check errors returned by both methods.
- Registering WebSocket paths without `HTTP` produces a `WEBSOCKET_HTTP_REQUIRED` configuration error.
- Use `InterceptorHTTP`, `InterceptorWebSocket`, or `InterceptorAll` as the scope for `InterceptorFor`. `0` or unsupported bits produce an `INTERCEPTOR_SCOPE_INVALID` configuration error.
- Network transmission, event publishing, and DB commits are not a single atomic operation. The application must decide whether retries and duplicate handling are needed.

## See also

- [Interceptors](/en/reference/api/interceptor): Public interface and execution order
- [Execution pipeline](/en/learn/core-concepts/pipeline) - Request processing flow
- [Introduction to Spine](/en/learn/getting-started/intro): Dependency injection and key concepts
