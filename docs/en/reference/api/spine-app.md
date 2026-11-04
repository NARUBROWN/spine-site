# spine.App

::: warning v0.7.0 Preview input API migration
The existing API descriptions and examples on this page target stable `v0.6.5`. From `v0.7.0-preview.1`, source-specific Path, Query, and Header DTOs are supported. `query.Values`, `header.Values` and their construction and lookup APIs, `query.Pagination`, `path.Int`, `path.String`, and `path.Boolean` are Deprecated.

The new DTO approach cannot be applied unchanged to `v0.6.5`. In Preview, mixing new DTOs with Deprecated inputs in one handler fails during boot. Existing body DTOs and contexts can still be used alongside either approach.

See [Preview handler input migration](/en/learn/migration/v0.7.0-preview) for versions and migration examples, and [Runtime OpenAPI](/en/reference/api/openapi) for specification options.
:::

`App` is the entry point for registering constructors, HTTP routes, interceptors, event consumers, WebSocket handlers, and custom transports, and for running the application. This reference covers the public API and boot options in Spine v0.6.5.

```go
import (
    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
)
```

## Interface definition

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

Pass options to `Route` using functions from `pkg/route` in your application code. You can also chain method calls on the values returned by `Consumers()` and `WebSocket()` without declaring their types, even though those types belong to internal packages.

## Constructors

### New

```go
func New(options ...Option) App
```

Pass the required implementations to `spine.New(options ...Option)`. Use `spine.New(echoplatform.Option())` for HTTP apps. HTTP-less workers omit the HTTP option and register the required event factories.

Creates a new Spine application instance.

**Returns**

- `App` - The application instance

**Example**

```go
app := spine.New(echoplatform.Option())
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

## Implementation selection options {#platform-options}

Select Echo for HTTP and the independent Gorilla implementation for WebSocket. Registered WS routes require both HTTP upgrade support and a WS factory. To enable validation, pass the result of `playground.New()` to `spine.WithValidator`.

| Option | Implementation |
| --- | --- |
| `spine.WithHTTPAdapter(factory)` | `echoplatform.Option()` / `contract/http` |
| `spine.WithWebSocketAdapter(factory)` | `gorillaplatform.Option()` / `contract/websocket` |
| `spine.WithEventAdapter(name, factory, options...)` | Kafka / RabbitMQ / `contract/event` |
| `spine.WithValidator(validator)` | playground / `contract/validator` |

[Select platforms and DTO validation](/en/learn/getting-started/platforms)

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
// Constructor without dependencies
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// Constructor with dependencies
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

// Event consumer constructor
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
// Basic route
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// Nested path
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

#### Route options

Use `route.WithInterceptors` to apply interceptors to a specific route.

```go
import "github.com/NARUBROWN/spine/pkg/route"

// Apply interceptors to a route
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// Resolve typed nil pointers from the container
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// Apply multiple interceptors
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

### WithEcho

```go
echoplatform.WithEcho(fn func(*echo.Echo)) echoplatform.EchoOption
```

Register Echo extensions through the typed `WithEcho` option when constructing the platform. Replace the existing `app := spine.New(echoplatform.Option())` with the code below and keep the constructor and route registrations that follow. `App.Transport` was removed in Spine v0.6.0.

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

Native Echo routes added through platform options bypass Spine HTTP interceptors and response staging, and are outside the static Spine route contract. Check their actual behavior separately.

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
    // Init is called after the DI container is ready.
    Init(container Container) error
    // Start is called in a separate goroutine after Init.
    Start() error
    // Stop is called during graceful shutdown.
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
    // Resolve a service from the container
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

`RunContext` starts graceful shutdown when its context is canceled. `Prepare` prepares an app without a listener and returns `Handler()` and `Close(ctx)`. It does not start consumers or custom transports, but broker readiness and custom Init may open network connections depending on configuration. The caller owns closing the prepared result and shutting down the external HTTP server.

### Consumers

```go
Consumers() *consumer.Registry
```

Returns the registry for registering event consumers. Register event names and handlers for events received from Kafka or RabbitMQ. Consumer constructors must also be registered with `Constructor`.

**Returns**

- `*consumer.Registry` - Consumer registry

**Example**

```go
// Register an event consumer
app.Consumers().Register(
    "order.created",            // Topic or event name
    (*OrderConsumer).OnCreated, // Handler method
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

// Event handler
func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("이벤트 수신:", eventName)
    log.Println("주문 ID:", event.OrderID)
    return nil
}

// Event DTO
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

Without network access, validate HTTP/WebSocket limits, event factory contracts and common policies, and validator registration. `Run` performs the same checks. Platform `NewFactory` functions check concrete broker configuration first; check their creation errors too.

For boot option errors, inspect `Path`, `Code`, `Message`, and `Hint` in `*boot.ConfigError.Issues`. Event, HTTP, WebSocket factory, and validator contract errors can also be returned; use `errors.Is` and `errors.As` with public errors. Valid configuration returns `nil`.

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

`boot.Options` configures HTTP execution and shutdown policy. Set `HTTP` when running HTTP. Select event connections and roles through external platform `Config` values and `spine.WithEventAdapter`.

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### Struct definition

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

| `Options` field | Meaning and default behavior |
| --- | --- |
| `Address` | Address on which the HTTP server listens. Example: `":8080"` |
| `EnableGracefulShutdown` | If `true`, the HTTP server handles `SIGINT` and `SIGTERM` for graceful shutdown. Default: `false` |
| `ShutdownTimeout` | Wait time for HTTP shutdown and custom transport shutdown. `0` means 10 seconds. Must not be negative |
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
// Valid prefixes
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// Validate and Run return configuration errors
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // Does not start with '/'
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // Contains a path parameter
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // Contains a wildcard
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
// Disable Recover
HTTP: &boot.HTTPOptions{
    DisableRecover: true,
}
```

## Kafka configuration

### Create and register the factory

Import `kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"`. Select roles with `Config.Consume` and `Config.Publish`, and provide `Brokers`. Consumers also require `GroupID`. Use this code inside `BuildApplication`, importing `echoplatform`, `spine`, `boot`, and `time` as well.

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

### Policies and constraints

The Kafka platform applies TLS 1.2 or later by default. Use `TLS`, `Dialer`, and `Transport` for CA, mTLS, and SASL configuration. Use `AllowInsecureTransport: true` only for an isolated local plaintext broker; it cannot be combined with explicit TLS. `NewFactory` checks configuration only. `Prepare` and `Run` check broker and topic readiness when preparing registered consumer readers. A Kafka publisher-only app can start without a broker connection; verify connectivity and delivery with an actual publication.

`Config.TopicPrefix` prefixes both published names and consumer subscriptions. With `prod.` in both factories, register `order.created` in the app and provision `prod.order.created` in the broker. Include the separator in the prefix.

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})` controls reconnection after reader and ACK/NACK failures. Defaults are 100ms initial delay, 5s maximum delay, multiplier 2, jitter 0.2, and unlimited transport retries with `MaxAttempts: 0`. It does not set a handler retry budget or DLQ policy. `WithEventSettlementTimeout` defaults to a 5s ACK/NACK limit. Failed Kafka records are not skipped by later offset commits; a poison record can block a partition.

## RabbitMQ configuration

### Create and register the factory

Import `rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"`. Configure the shared `Config.Exchange` and select `Consume`/`Publish`. URLs require `amqps://` by default; local `amqp://` requires explicit `AllowInsecureTransport: true`. Use this code inside `BuildApplication`.

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

### Policies and constraints

Omitting `PrefetchCount` permits one unacknowledged message per consumer. The default policy is `rabbitmqplatform.FailureReject`; `FailureRequeue` can redeliver an unprocessable message indefinitely. Provision a `DeadLetter` exchange before using it. `TopicPrefix` applies to published routing keys and subscription bindings; `QueuePrefix` applies to queue names.

Publishers use persistent messages, mandatory routing, and publisher confirms. `OperationTimeout` defaults to 5s. There is no `PublisherRetry` option that automatically republishes failed messages. Application retries after lost confirmation can duplicate delivery, so consumers must be idempotent.

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

    // Publish an event
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

// BuildApplication configures the app for server startup, contract checks, and offline verification.
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

## Startup and shutdown order

After validating options, `Run` configures the dependency injection container and event publishers. It calls `Init` on custom transports, resolves HTTP and WebSocket routes and interceptors, and creates the required controllers in advance. If consumers are registered, it also validates the broker runtime.

Once this preparation is complete, it runs consumers and custom transports' `Start` in separate goroutines, then starts the HTTP server last. Startup fails if HTTP route paths overlap ambiguously for the same method. For example, `/users/:id` and `/users/me` are treated as overlapping paths.

During shutdown, it first stops incoming WebSocket and HTTP requests, waits for consumers to stop, and then calls custom transports' `Stop` in reverse initialization order. It then releases event publisher resources. For the implementation, see the [v0.6.5 startup and shutdown code](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/bootstrap/bootstrap.go).

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
