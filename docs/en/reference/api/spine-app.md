# spine.App

API reference for the main application interface.

## Overview

`App` is the entry point for Spine applications. It is responsible for registering constructors, defining routes, configuring interceptors, registering event consumers, and running the server.

```go
import "github.com/NARUBROWN/spine"
```

## Interface Definition

```go
type App interface {
    // Declare Constructors
    Constructor(constructors ...any)
    // Declare Route
    Route(method string, path string, handler any, opts ...router.RouteOption)
    // Declare Interceptors
    Interceptor(interceptors ...core.Interceptor)
    // HTTP Transport Extension (Echo, etc.)
    Transport(fn func(any))
    // Run
    Run(opts boot.Options) error
    // Return Event Consumer Registry
    Consumers() *consumer.Registry
}
```

## Constructors

### New

```go
func New() App
```

Creates a new Spine application instance.

**Returns**
- `App` - Application instance

**Example**
```go
app := spine.New()
app.Run(boot.Options{
    Address: ":8080",
})
```

## Methods

### Constructor

```go
Constructor(constructors ...any)
```

Registers constructor functions to the IoC Container. Registered constructors are used for dependency injection.

**Parameters**
- `constructors` - Constructor functions (variadic)

**Constructor Rules**
- Must be a function
- Must return exactly one value
- Parameters must be other registered types (dependencies)

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

// Event Consumer Constructor
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

Registers an HTTP route.

**Parameters**
- `method` - HTTP method (`"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, etc.)
- `path` - URL path pattern. Define path parameters with `:param` format
- `handler` - Controller method expression
- `opts` - Route options (optional)

**Path Patterns**
- `/users` - Static path
- `/users/:id` - Single parameter
- `/users/:userId/posts/:postId` - Multiple parameters

**Example**
```go
// Basic Routes
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// Nested Paths
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

#### Route Options

Use `route.WithInterceptors` to apply Interceptors to specific routes only.

```go
import "github.com/NARUBROWN/spine/pkg/route"

// Apply Route-specific Interceptor
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// Apply Multiple Interceptors
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

Registers global Interceptors. `PreHandle` is executed in registration order, while `PostHandle` and `AfterCompletion` are executed in reverse order.

**Parameters**
- `interceptors` - Interceptor instances (variadic)

**Execution Order**
1. Global Interceptors (Registration order)
2. Route Interceptors (Registration order)
3. Controller Execution
4. Route Interceptors PostHandle (Reverse order)
5. Global Interceptors PostHandle (Reverse order)

**Example**
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

Registers an HTTP Transport (Echo) extension hook. Allows direct access to the Echo instance to add middlewares or configurations.

**Parameters**
- `fn` - Callback function receiving the Echo instance

**Example**
```go
import "github.com/labstack/echo/v4"
import "github.com/labstack/echo/v4/middleware"

app.Transport(func(e any) {
    echo := e.(*echo.Echo)
    
    // Add Echo Middleware
    echo.Use(middleware.Recover())
    echo.Use(middleware.RequestID())
    
    // Serve Static Files
    echo.Static("/static", "public")
})
```

### Consumers

```go
Consumers() *consumer.Registry
```

Returns the event consumer registry. Registers handlers to receive events from message brokers like Kafka or RabbitMQ.

**Returns**
- `*consumer.Registry` - Consumer registry

**Example**
```go
// Register Event Consumer
app.Consumers().Register(
    "order.created",           // Topic/Event Name
    (*OrderConsumer).OnCreated, // Handler Method
)

app.Consumers().Register(
    "stock.created",
    (*StockConsumer).OnCreated,
)
```

#### Consumer Handler

Consumer handlers have a signature similar to HTTP controllers.

```go
type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

// Event Handler
func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("Event received:", eventName)
    log.Println("Order ID:", event.OrderID)
    return nil
}

// Event DTO
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}
```

### Run

```go
Run(opts boot.Options) error
```

Starts the application. runs the HTTP server and event consumer runtime together.

**Parameters**
- `opts` - Boot options (`boot.Options`)

**Returns**
- `error` - Error if server failed to start

**Example**
```go
if err := app.Run(boot.Options{Address: ":8080"}); err != nil {
    log.Fatal(err)
}
```

## boot.Options

Application bootstrap options.

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### Struct Definition

```go
type Options struct {
    // Address to bind the server to (e.g., ":8080")
    Address string

    // Whether to enable Graceful Shutdown
    EnableGracefulShutdown bool

    // Maximum wait time during Graceful Shutdown
    ShutdownTimeout time.Duration

    // Kafka Event Infrastructure Configuration
    // If nil, Kafka is not configured
    Kafka *KafkaOptions

    // RabbitMQ Event Infrastructure Configuration
    // If nil, RabbitMQ is not configured
    RabbitMQ *RabbitMqOptions
}
```

### Basic Usage

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

When Graceful Shutdown is enabled:
- Receives `SIGINT`, `SIGTERM` signals
- Waits until ongoing requests are completed
- Forcefully terminates after `ShutdownTimeout`

## Kafka Configuration

### KafkaOptions

```go
type KafkaOptions struct {
    // List of Kafka broker addresses
    Brokers []string

    // Event Consumption (Consumer) Configuration
    // If nil, Kafka Consumer is not enabled
    Read *KafkaReadOptions

    // Event Publishing (Producer) Configuration
    // If nil, events are not published to Kafka
    Write *KafkaWriteOptions
}

type KafkaReadOptions struct {
    // Kafka Consumer Group ID
    GroupID string
}

type KafkaWriteOptions struct {
    // Topic Prefix to prepend to event names
    TopicPrefix string
}
```

### Example

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

## RabbitMQ Configuration

### RabbitMqOptions

```go
type RabbitMqOptions struct {
    // RabbitMQ AMQP Connection String
    // e.g., amqp://guest:guest@localhost:5672/
    URL string

    // Event Consumption (Consumer) Configuration
    // If nil, RabbitMQ Consumer is not enabled
    Read *RabbitMqReadOptions

    // Event Publishing (Publisher) Configuration
    // If nil, events are not published to RabbitMQ
    Write *RabbitMqWriteOptions
}

type RabbitMqReadOptions struct {
    // Queue name to consume messages from
    Queue string
    // Exchange name to bind the queue to
    Exchange string
    // Routing key condition
    RoutingKey string
}

type RabbitMqWriteOptions struct {
    // Exchange name to publish events to
    Exchange string
    // Routing key to use when publishing
    RoutingKey string
}
```

### Example

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

## Event Publishing

Domain events can be published from the Controller.

### DomainEvent Interface

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

type DomainEvent interface {
    Name() string
    OccurredAt() time.Time
}
```

### Event Definition

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

### Publishing from Controller

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

func (c *OrderController) Create(ctx context.Context, req *CreateOrderRequest) Order {
    order := c.repo.Save(req)
    
    // Publish Event
    publish.Event(ctx, OrderCreated{
        OrderID: order.ID,
        At:      time.Now(),
    })
    
    return order
}
```

## Full Example

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

    // Register Constructors
    app.Constructor(
        NewUserController,
        NewOrderConsumer,
    )

    // Register Routes
    app.Route("GET", "/users", (*UserController).List)
    app.Route("GET", "/users/:id", (*UserController).GetUser)
    app.Route(
        "POST",
        "/orders/:orderId",
        (*UserController).CreateOrder,
        route.WithInterceptors(&LoggingInterceptor{}),
    )

    // Register Global Interceptors
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
            AllowMethods: []string{"GET", "POST", "OPTIONS"},
            AllowHeaders: []string{"Content-Type"},
        }),
    )

    // Register Event Consumers
    app.Consumers().Register(
        "order.created",
        (*OrderConsumer).OnCreated,
    )

    // Run Server
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
    // Publish Event
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
    log.Println("Event received:", eventName)
    log.Println("Order ID:", event.OrderID)
    return nil
}
```

## Bootstrap Order

Initialization proceeds in the following order when `Run()` is called:

1. Create IoC Container
2. Register Constructors
3. Configure Router and create HandlerMeta
4. Controller Warm-up (Pre-resolve dependencies)
5. Configure HTTP Pipeline
   - Register ArgumentResolvers
   - Register ReturnValueHandlers
6. Configure Event Infrastructure (if configured)
   - Kafka Publisher / Consumer
   - RabbitMQ Publisher / Consumer
7. Register Interceptors
   - Global Interceptors
   - Resolve Route Interceptors
8. Mount HTTP Server
9. Start Event Consumer Runtime (if configured)
10. Start HTTP Server

### On Graceful Shutdown

1. Receive `SIGINT` / `SIGTERM` signals
2. Stop Event Consumer Runtime
3. Shutdown HTTP Server (Wait for timeout)
4. Exit

## See Also

- [Interceptor](/en/reference/api/interceptor) - Interceptor Interface
- [Execution Pipeline](/en/learn/core-concepts/pipeline) - Request Processing Flow
- [IoC Container](/en/learn/getting-started/intro) - Dependency Injection
