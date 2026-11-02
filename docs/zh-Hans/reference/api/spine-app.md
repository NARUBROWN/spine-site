# spine.App

`App` 是注册构造函数、HTTP 路由、拦截器、事件消费者、WebSocket 处理器和自定义传输方式，并运行应用程序的入口。本参考介绍 Spine v0.6.0 的公开 API 和启动选项。

```go
import (
    "github.com/NARUBROWN/spine"
    platform "github.com/NARUBROWN/spine-echo-platform"
)
```

## 接口定义

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

在应用代码中，使用 `pkg/route` 中的函数传递 `Route` 的选项。虽然 `Consumers()` 和 `WebSocket()` 的返回类型位于内部包中，但仍可通过链式调用使用，无需直接声明这些类型。

## 构造函数

### New

```go
func New(options ...Option) App
```

`spine.New(options ...Option)` 创建不选择 HTTP 实现的内核应用。无 HTTP 的 worker 使用 `spine.New()`，Echo HTTP 应用使用 `platform.New()` 或 `spine.New(platform.Option())`。

创建新的 Spine 应用程序实例。

**返回值**

- `App` - 应用程序实例

**示例**

```go
app := platform.New()
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

## 方法

### Constructor

```go
Constructor(constructors ...any)
```

向依赖注入容器注册构造函数。容器根据构造函数的参数类型注入其他已注册的对象。

**参数**

- `constructors` - 构造函数列表（可变参数）

**构造函数规则**

- 必须是函数
- 必须且只能有一个返回值
- 还必须注册提供其参数类型的构造函数

**示例**

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

注册 HTTP 路由。移除 `method` 首尾的空格，并将其转换为大写。

**参数**

- `method` - HTTP 方法（`"GET"`、`"POST"`、`"PUT"`、`"DELETE"` 等）。不区分大小写
- `path` - URL 路径模式。使用 `:param` 格式定义路径参数
- `handler` - 控制器方法表达式
- `opts` - 路由选项（可选）

**路径模式**
- `/users` - 静态路径
- `/users/:id` - 单个参数
- `/users/:userId/posts/:postId` - 多个参数

**示例**

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

#### 路由选项

使用 `route.WithInterceptors` 将拦截器仅应用于特定路由。

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

为 HTTP 请求和 WebSocket 消息注册全局拦截器。`app.Interceptor(...)` 等同于 `app.InterceptorFor(boot.InterceptorAll, ...)`。`PreHandle` 按注册顺序执行，`PostHandle`、`BeforeResponse` 和 `AfterCompletion` 按相反顺序执行。

将同一个指针实例注册到多个范围时，会合并范围并仅执行一次。同一类型的不同实例会分别执行。注册 `(*AuthInterceptor)(nil)` 这样的有类型 nil 指针时，会从容器中查找并使用共享实例。

**参数**

- `interceptors`：拦截器实例列表

**执行顺序**

1. 按注册顺序执行全局拦截器的 `PreHandle`。
2. 路由完成后解析输入值。
3. 按注册顺序执行路由拦截器的 `PreHandle`。
4. 执行控制器并准备响应，然后调用执行后钩子。
5. 依次执行路由拦截器和全局拦截器的 `PostHandle`。各自按注册的相反顺序执行。
6. 按同样的相反顺序执行 `BeforeResponse`，然后实际写入响应。
7. 响应处理完成后，按同样的相反顺序执行 `AfterCompletion`。

有关错误和中止时的行为，请参阅[拦截器参考](/zh-Hans/reference/api/interceptor)。

**示例**

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

选择全局拦截器适用的传输方式。不应用于事件消费者。

| 范围 | 适用对象 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP 请求 |
| `boot.InterceptorWebSocket` | WebSocket 消息和受支持的连接前处理 |
| `boot.InterceptorAll` | 两种范围 |

```go
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsAuthInterceptor)
app.InterceptorFor(boot.InterceptorAll, loggingInterceptor)
```

### WithEcho

```go
platform.WithEcho(fn func(*echo.Echo)) platform.EchoOption
```

创建平台时，通过具有明确类型的 `WithEcho` 选项注册 Echo 扩展。用以下代码替换现有的 `app := platform.New()`，保留后续的构造函数和路由注册。Spine v0.6.0 已移除 `App.Transport`。

```go
import (
    platform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/labstack/echo/v5"
    "github.com/labstack/echo/v5/middleware"
)

app := platform.New(platform.WithEcho(func(e *echo.Echo) {
    e.Use(middleware.RequestID())
    e.Static("/static", "public")
}))
```

通过平台选项添加的原生 Echo 路由不会经过 Spine HTTP 拦截器和响应 staging，也不包含在静态 Spine 路由契约中。请单独检查其实际行为。

### RegisterTransport

```go
RegisterTransport(t core.CustomTransport)
```

注册独立于 HTTP 流水线运行的传输方式。例如，将 gRPC 服务器接入 Spine 的依赖注入、启动和关闭流程时使用。

**参数**

- `t` - `core.CustomTransport` 接口实现

**CustomTransport 接口**
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

**示例**

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

`RunContext` 在 context 取消时开始正常关闭。`Prepare` 在不启动监听器的情况下准备应用，返回 `Handler()` 和 `Close(ctx)`。它不会启动 consumer 或 custom transport，但根据配置，broker readiness 和 custom Init 可能建立网络连接。调用方负责关闭准备结果和外部 HTTP 服务器。

### Consumers

```go
Consumers() *consumer.Registry
```

返回用于注册事件消费者的注册表。注册从 Kafka 或 RabbitMQ 接收的事件名称及其处理器。消费者的构造函数也必须通过 `Constructor` 注册。

**返回值**

- `*consumer.Registry` - 消费者注册表

**示例**

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

#### 事件处理器

事件处理器可以接收标准上下文、事件名称和事件 DTO 作为参数。

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

返回 WebSocket 注册表。用于注册 WebSocket 路径和处理器。

**返回值**

- `*ws.Registry` - WebSocket 注册表

**示例**

```go
if err := app.WebSocket().Register("/ws/chat", (*ChatController).OnMessage); err != nil {
    log.Fatal(err)
}
```

#### WebSocket 处理器

WebSocket 处理器接收 `ws` 包中的连接 ID 和消息 DTO 作为参数。以下示例保存每个连接的发送对象，并向所有连接发送消息。`ChatController` 的构造函数通过 `Constructor` 注册。

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

WebSocket 在与 HTTP 服务器相同的 Echo 实例上注册路径，因此需要 `boot.Options.HTTP`。有关来源、连接数和认证设置，请参阅[安全配置](/zh-Hans/reference/security-configuration#websocket)。

### Validate

```go
Validate(opts boot.Options) error
```

检查启动选项，不打开网络连接，也不启动服务器或消费者。检查内容包括 Kafka 和 RabbitMQ 的连接设置、HTTP 和 WebSocket 的限制值，以及全局拦截器是否为 nil、范围是否有效等。`Run` 也会在启动前执行相同的检查。

存在错误时返回 `*boot.ConfigError`。`Issues` 中的每一项都包含配置位置 `Path`、错误分类 `Code`、说明 `Message` 和修复提示 `Hint`。选项有效时返回 `nil`。

`Validate` 不会创建构造函数的依赖，也不会连接到消息代理。验证成功并不表示构造函数和路由有效、DI 配置正确或实际基础设施连接成功。

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

根据已注册的配置和 `boot.Options` 启动 HTTP 服务器、WebSocket、事件消费者和自定义传输方式。运行期间等待关闭信号或运行时错误。配置、初始化、运行或关闭失败时返回错误。

```go
if err := app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
}); err != nil {
    log.Fatal(err)
}
```

## boot.Options

指定服务器运行方式及是否使用外部基础设施。`HTTP`、`Kafka` 或 `RabbitMQ` 为 `nil` 时，不配置相应功能。

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### 结构体定义

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

| `Options` 字段 | 含义和默认行为 |
| --- | --- |
| `Address` | HTTP 服务器的监听地址。例如 `":8080"` |
| `EnableGracefulShutdown` | 为 `true` 时，HTTP 服务器接收 `SIGINT`、`SIGTERM` 后优雅关闭。默认值为 `false` |
| `ShutdownTimeout` | HTTP 和自定义传输方式关闭时的等待时间。为 `0` 时使用 10 秒。不能为负数 |
| `Kafka` | Kafka 发布和消费配置。为 `nil` 时禁用 |
| `RabbitMQ` | RabbitMQ 发布和消费配置。为 `nil` 时禁用 |
| `HTTP` | HTTP 和 WebSocket 配置。为 `nil` 时禁用 HTTP 服务器 |

| `HTTPOptions` 字段 | 为 `0` 或省略时 | 约束 |
| --- | --- | --- |
| `GlobalPrefix` | 无前缀 | 应用下方的路径规则 |
| `DisableRecover` | `false`，使用将 panic 转换为 HTTP 500 的恢复中间件 | 为 `true` 时禁用中间件 |
| `ReadHeaderTimeout` | 5 秒 | 不能为负数 |
| `ReadTimeout` | 30 秒 | 不能为负数 |
| `WriteTimeout` | 30 秒 | 不能为负数 |
| `IdleTimeout` | 120 秒 | 不能为负数 |
| `MaxHeaderBytes` | 1 MiB | 不能为负数 |
| `MaxBodyBytes` | 32 MiB | 为负数时禁用请求体大小限制 |
| `WebSocket` | [WebSocket 默认值](/zh-Hans/reference/security-configuration#websocket) | `boot.WebSocketOptions` |

### GlobalPrefix 验证规则

对于不符合以下规则的值，`Validate` 和 `Run` 返回 `HTTP_GLOBAL_PREFIX_INVALID` 配置错误。空字符串表示不应用前缀。

- 必须以 `"/"` 开头
- 不能包含 `":"`（路径参数）
- 不能包含 `"*"`（通配符）
- 末尾的 `"/"` 会自动移除

```go
// 유효한 접두사
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// Validate와 Run이 설정 오류 반환
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // '/'로 시작하지 않음
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // 경로 매개변수 포함
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // 와일드카드 포함
```

### 基本用法

```go
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

### 优雅关闭

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

启用 HTTP 优雅关闭后，收到 `SIGINT`、`SIGTERM` 时停止接收新请求，并等待正在处理的请求完成。关闭 WebSocket 连接并停止事件消费者后，调用自定义传输方式的 `Stop(ctx)`。

`ShutdownTimeout` 应用于 HTTP 和自定义传输方式的关闭上下文。消费者的 `Stop` 会等待任务、ACK/NACK 和读取器结束，因此不要将此值理解为整个进程的强制退出时限。即使不运行 HTTP，仅运行消费者或自定义传输方式，也会处理关闭信号。

### Recover 中间件

默认启用恢复中间件，将 panic 转换为 HTTP 500 响应。

```go
// Recover 비활성화
HTTP: &boot.HTTPOptions{
    DisableRecover: true,
}
```

## Kafka 配置

### KafkaOptions

`Read` 和 `Write` 相互独立。只要启用其中一项，就必须提供 `Brokers`；使用 `Read` 时还需要 `GroupID`。未单独配置传输设置时，使用 TLS 1.2 或更高版本。

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

### 示例

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

## RabbitMQ 配置

### RabbitMqOptions

`Read` 和 `Write` 相互独立。为每个已启用的角色指定 `Exchange`。默认要求使用 `amqps://` URL，明文 `amqp://` 只能在隔离的开发环境中显式允许。

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

有关失败策略和重试默认值，请参阅[安全配置](/zh-Hans/reference/security-configuration#rabbitmq)。`RequeueOnError` 用于兼容旧版本，新代码应使用 `FailurePolicy`。

### 示例

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

## 事件发布 {#event-publishing}

可以在控制器中收集领域事件，并通过已注册的 Kafka 或 RabbitMQ 发布器发送。

### DomainEvent 接口

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

type DomainEvent interface {
    Name() string
    OccurredAt() time.Time
}
```

### 定义事件

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

### 在控制器中发布

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

`publish.Event()` 将事件收集到与 `context.Context` 关联的事件总线中。控制器执行和响应准备成功后，在执行后钩子中通过已注册的 Kafka 或 RabbitMQ 发布器批量发送。此发送操作在 `BeforeResponse` 之前执行，因此无法与数据库事务提交构成原子操作。需要原子性时，请配置事务性发件箱。

## 在 CLI 项目中使用

在[创建第一个应用](/zh-Hans/learn/getting-started/first-app)中生成的项目，通过 `internal/application/application.go` 中的 `BuildApplication` 配置应用，并在根目录的 `main.go` 中检查 `Validate` 错误后调用 `Run`。可以通过以下命令检查项目。

```sh
spine doctor
spine contract check
spine verify
```

以下是生成的 `BuildApplication` 的基本形式。

```go
package application

import (
    platform "github.com/NARUBROWN/spine-echo-platform"
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
	app := platform.New()
	app.Constructor(NewHealthController)
	app.Route("GET", "/health", (*HealthController).Get)

	address := ":8080"
	if port := os.Getenv("SPINE_PORT"); port != "" {
		address = ":" + port
	}
	return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## 启动和关闭顺序

`Run` 预先验证选项后，配置依赖注入容器和事件发布器。随后调用自定义传输方式的 `Init`，解析 HTTP 和 WebSocket 的路由及拦截器，并预先创建所需控制器。如果注册了消费者，还会验证消息代理运行时。

准备完成后，在单独的 goroutine 中执行消费者和自定义传输方式的 `Start`，最后启动 HTTP 服务器。对于同一 HTTP 方法，如果路由路径存在歧义重叠，启动会失败。例如，`/users/:id` 和 `/users/me` 会被判定为重叠路径。

关闭时，首先停止接收 WebSocket 和 HTTP 请求，等待消费者停止，再按初始化的相反顺序调用自定义传输方式的 `Stop`。随后释放事件发布器的资源。具体实现请参阅 [v0.6.0 启动和关闭代码](https://github.com/NARUBROWN/spine/blob/v0.6.0/internal/bootstrap/bootstrap.go)。

## 约束和错误

- 构造函数必须且只能有一个返回值。不能注册返回 `(T, error)` 的构造函数。
- HTTP 输入 DTO 通过指针接收，成功响应使用 `httpx.Response[T]` 等受支持的响应类型返回。请参阅[编写控制器](/zh-Hans/learn/tutorial/2-controller)。
- 即使 `Validate` 成功，`Run` 仍可能发生构造函数、依赖、路由或消息代理连接错误。请检查这两个方法返回的错误。
- 注册 WebSocket 路径却省略 `HTTP` 时，会发生 `WEBSOCKET_HTTP_REQUIRED` 配置错误。
- `InterceptorFor` 的范围必须使用 `InterceptorHTTP`、`InterceptorWebSocket` 或 `InterceptorAll`。为 `0` 或包含不支持的位时，会发生 `INTERCEPTOR_SCOPE_INVALID` 配置错误。
- 网络传输、事件发布和数据库提交不是一个原子操作。应用需要决定是否重试，以及是否需要处理重复操作。

## 参考

- [拦截器](/zh-Hans/reference/api/interceptor)：公开接口和执行顺序
- [执行流水线](/zh-Hans/learn/core-concepts/pipeline) - 请求处理流程
- [Spine 简介](/zh-Hans/learn/getting-started/intro)：依赖注入和主要概念
