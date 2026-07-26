# spine.App

API reference for configuring and running a Spine application.

## Interface

```go
type App interface {
    Constructor(constructors ...any)
    Route(method string, path string, handler any, opts ...router.RouteOption)
    Interceptor(interceptors ...core.Interceptor)
    InterceptorFor(scope boot.InterceptorScope, interceptors ...core.Interceptor)
    Transport(fn func(any))
    RegisterTransport(t core.CustomTransport)
    Validate(opts boot.Options) error
    Run(opts boot.Options) error
    Consumers() *consumer.Registry
    WebSocket() *ws.Registry
}
```

Create an application with `spine.New()`.

## Constructor

```go
app.Constructor(NewDB, NewRepository, NewService, NewController)
```

Constructors are order-independent. Spine builds the dependency graph and warms required controllers, consumer handlers, interceptors, and transports before starting the HTTP listener.

A constructor must be a non-nil function with injectable parameters. Nil constructors and invalid nil pointer/interface/function/channel provider results fail explicitly. Nil slice and map results remain valid empty collections. Resolving one provider through its concrete type or an implemented interface shares one singleton.

## Route

```go
app.Route(
    "GET",
    "/users/:id",
    (*UserController).Get,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

The method is trimmed and normalized to uppercase. Handlers must be method expressions with pointer receivers. Path semantic values bind in declaration order.

Static routes take precedence, but a static dead end backtracks to a matching parameter route.

## Interceptor and InterceptorFor

```go
app.Interceptor(&LoggingInterceptor{}) // HTTP and WebSocket

app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsAuthInterceptor)
```

Scopes are `boot.InterceptorHTTP`, `boot.InterceptorWebSocket`, and `boot.InterceptorAll`. See [core.Interceptor](/en/reference/api/interceptor) for lifecycle and registration-identity rules.

## Transport extension

`Transport(func(any))` customizes the built-in HTTP transport after it is created. The callback receives the adapter value and is intended for adapter-specific middleware or configuration.

`RegisterTransport` adds an independently managed transport:

```go
type CustomTransport interface {
    Init(container core.Container) error
    Start() error
    Stop(ctx context.Context) error
}
```

Custom transports initialize after DI is ready, start with the application, and stop during graceful shutdown. If initialization fails part-way through, already initialized transports stop in reverse order.

## Validate

```go
if err := app.Validate(opts); err != nil {
    var configErr *boot.ConfigError
    if errors.As(err, &configErr) {
        for _, issue := range configErr.Issues {
            log.Printf("%s [%s]: %s", issue.Path, issue.Code, issue.Hint)
        }
    }
    return err
}
```

`Validate` performs network-free configuration checks and returns all issues in one `*boot.ConfigError`. Each `ConfigIssue` contains `Path`, stable `Code`, human `Message`, and actionable `Hint`. `Run` performs the same preflight automatically.

Use `Validate` in deployment checks. It does not prove broker reachability, credentials, TLS handshakes, queue topology, listener binding, or reverse-proxy behavior.

## Run

```go
if err := app.Run(opts); err != nil {
    log.Fatal(err)
}
```

Startup order is intentionally fail-fast:

1. validate configuration without network access;
2. build DI and compile routes/pipelines;
3. warm controllers, interceptors, consumers, and custom transports;
4. validate an actual Kafka protocol handshake and RabbitMQ topology connection when configured;
5. start consumers and custom transports;
6. start the HTTP listener last.

With graceful shutdown enabled, `Run` waits for consumer handlers, ACK/NACK work, reader close, and custom transports to finish stopping before it returns. A negative `ShutdownTimeout` is rejected with `SHUTDOWN_TIMEOUT_INVALID`.

## Consumers

```go
if err := app.Consumers().Register(
    "order.created",
    (*OrderConsumer).Handle,
); err != nil {
    log.Fatal(err)
}
```

Consumer handlers use the same method-expression and DI model as HTTP handlers. Kafka and RabbitMQ runtime behavior is selected by `boot.Options`.

Kafka can redeliver after handler, NACK, or commit failures. A failed ACK/NACK invalidates and rebuilds the reader before any later message is read. A permanently failing record can block its partition because Spine does not automatically skip or dead-letter Kafka records. Handlers must be idempotent.

RabbitMQ handler failure defaults to reject without requeue. Configure a pre-provisioned DLX when failures must be retained.

## WebSocket

```go
if err := app.WebSocket().Register(
    "/ws/chat",
    (*ChatController).OnMessage,
); err != nil {
    log.Fatal(err)
}
```

WebSocket handlers receive message semantic types and may assert `core.WebSocketMessageContext` for immutable handshake headers, queries, cookies, host, remote address, and request URI.

Use `core.WebSocketHandshakeInterceptor` to authenticate before upgrade. Spine reserves capacity before the hook, so pending unauthenticated handshakes count toward `MaxConnections`.

## boot.Options

```go
type Options struct {
    Address                string
    EnableGracefulShutdown bool
    ShutdownTimeout        time.Duration
    Kafka                  *KafkaOptions
    RabbitMQ               *RabbitMqOptions
    HTTP                   *HTTPOptions
}
```

`HTTP == nil` disables the HTTP server. Zero values select bounded framework defaults for timeouts and sizes. `HTTP.MaxBodyBytes < 0` is the explicit body-limit opt-out; other negative timeout/size values fail validation.

### HTTPOptions

```go
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

The recover middleware is enabled unless `DisableRecover` is true. Ordinary internal errors and recovered panics produce a generic 500 body.

### WebSocketOptions

```go
type WebSocketOptions struct {
    MaxConnections    int
    CapacityRetryAfter time.Duration
    AllowedOrigins    []string
    TrustedProxyCIDRs []string
    MaxMessageBytes   int64
    HandshakeTimeout  time.Duration
    ReadTimeout       time.Duration
    WriteTimeout      time.Duration
    PingInterval      time.Duration
}
```

The zero connection limit uses `boot.DefaultWebSocketMaxConnections` (1024). Use a positive value or `boot.UnlimitedWebSocketConnections`; other negatives are invalid. Capacity rejection happens before upgrade with HTTP 503, `Retry-After`, and `WEBSOCKET_CAPACITY_EXCEEDED` JSON.

With no `AllowedOrigins`, browser requests require the same scheme and host. Prefer exact origins. `TrustedProxyCIDRs` permits forwarding headers to determine the public scheme only for direct peers in those networks; the trusted proxy must remove or overwrite client-supplied forwarding headers.

## KafkaOptions

```go
type KafkaOptions struct {
    Brokers                []string
    TLS                    *tls.Config
    Dialer                 *kafka.Dialer
    Transport              *kafka.Transport
    AllowInsecureTransport bool
    ConsumerRetry          ConsumerRetryOptions
    Read                   *KafkaReadOptions
    Write                  *KafkaWriteOptions
}
```

Enabled readers and writers use implicit TLS 1.2+ by default. Supply `TLS`, `Dialer`, or `Transport` for custom CA, mTLS, SASL, or dialing. Plaintext local development requires `AllowInsecureTransport: true`.

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    TLS:     &tls.Config{MinVersion: tls.VersionTLS12},
    Read:    &boot.KafkaReadOptions{GroupID: "orders"},
    Write:   &boot.KafkaWriteOptions{TopicPrefix: "prod."},
    ConsumerRetry: boot.ConsumerRetryOptions{
        InitialDelay: 200 * time.Millisecond,
        MaxDelay:     5 * time.Second,
        Multiplier:   2,
        Jitter:       0.2,
    },
}
```

`ConsumerRetry` covers initial readiness and reader reconstruction after transport or ACK/NACK failure. Zero values select 100 ms initial delay, 5 s maximum, multiplier 2, 20% jitter, and unlimited attempts.

## RabbitMqOptions

```go
type RabbitMqOptions struct {
    URL                    string
    AllowInsecureTransport bool
    ConsumerRetry          ConsumerRetryOptions
    PublisherRetry         PublisherRetryOptions
    Read                   *RabbitMqReadOptions
    Write                  *RabbitMqWriteOptions
}
```

RabbitMQ requires `amqps://` by default. Plaintext `amqp://` requires explicit local-only opt-in.

```go
RabbitMQ: &boot.RabbitMqOptions{
    URL: "amqps://user:pass@rabbit.example/vhost",
    PublisherRetry: boot.PublisherRetryOptions{
        InitialDelay:   200 * time.Millisecond,
        MaxDelay:       5 * time.Second,
        MaxAttempts:    5,
        ConfirmTimeout: 5 * time.Second,
    },
    Read: &boot.RabbitMqReadOptions{
        Exchange:      "events",
        PrefetchCount: 16,
        FailurePolicy: boot.RabbitMqFailureReject,
        DeadLetter: &boot.RabbitMqDeadLetterOptions{
            Exchange:   "events.dlx",
            RoutingKey: "events.failed",
        },
    },
    Write: &boot.RabbitMqWriteOptions{Exchange: "events"},
}
```

The publisher uses persistent messages, mandatory routing, publisher confirms, and bounded retry. A zero prefetch uses the safe default of 1. `RequeueOnError` is deprecated; use `FailurePolicy` explicitly. Broker dispatch uses AMQP `RoutingKey`, not producer-controlled `Type`.

## Minimal HTTP application

```go
func main() {
    app := spine.New()
    app.Constructor(NewUserService, NewUserController)
    app.Route("GET", "/users/:id", (*UserController).Get)

    opts := boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        HTTP:                   &boot.HTTPOptions{},
    }
    if err := app.Run(opts); err != nil {
        log.Fatal(err)
    }
}
```

## See also

- [Security configuration](/en/reference/security-configuration)
- [Current Release](/en/community/changelog)
- [Interceptor API](/en/reference/api/interceptor)
