# Security configuration

Spine `v0.7.1` applies HTTP and WebSocket size, time, and connection limits. Independent platforms manage broker transport policies. Check the selected platform version and configuration as well.

## Configuration validation

`App.Validate` checks boot options without opening network connections. `App.Run` performs the same checks before startup. These preliminary checks do not establish whether constructor and dependency configuration or broker connections will succeed.

```go
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

Inspect boot configuration failures through `*boot.ConfigError.Issues`. Check configuration errors returned by external platform `NewFactory` calls separately. Classify failures using public errors and codes rather than message strings, and do not log broker credentials.

| Field | Meaning |
| --- | --- |
| `Path` | Location of the invalid configuration |
| `Code` | Error classification code |
| `Message` | Human-readable error description |
| `Hint` | How to fix the configuration |

## Secure defaults

| Area | Default behavior | How to adjust |
| --- | --- | --- |
| HTTP | Read and write timeouts, header and body size limits | [`boot.HTTPOptions`](/en/reference/api/spine-app#boot-options) |
| Kafka | TLS 1.2 or later for enabled consumers and publishers | `TLS`, `Dialer`, `Transport`. For local plaintext connections, use `AllowInsecureTransport: true` |
| RabbitMQ connections | `amqps://` required | For local plaintext connections, use `amqp://` and `AllowInsecureTransport: true` |
| RabbitMQ publishing | persistent / mandatory / publisher confirm | `OperationTimeout` |
| RabbitMQ processing failures | Reject without requeueing | `rabbitmqplatform.Config.FailurePolicy` |
| RabbitMQ concurrent processing | 1 unacknowledged message per consumer | Positive `PrefetchCount` |
| Consumer transport failures | Recreate the reader with exponential backoff and jitter | `spine.WithEventConsumerRetry` |
| WebSocket origins | Browser requests allowed only from the same scheme and host | `AllowedOrigins` |
| WebSocket connections | 1024 established connections and pending connection requests combined | Positive `MaxConnections` or `boot.UnlimitedWebSocketConnections` |
| WebSocket connection authentication | Only interceptors implementing the optional interface run before the upgrade | Implement `core.WebSocketHandshakeInterceptor` |
| Global interceptors | Apply to both HTTP and WebSocket | Limit the scope with `InterceptorFor` |
| CORS with credentials | Explicit origins required | Cannot combine `*` with `AllowCredentials: true` |
| Cookies | Reject invalid fields before writing the response | Use `httpx.EncodeCookieValue` when arbitrary values must be preserved |

## Kafka

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

The Kafka platform applies TLS 1.2 or later by default. Use `TLS`, `Dialer`, and `Transport` for CA, mTLS, and SASL configuration. Use `AllowInsecureTransport: true` only for an isolated local plaintext broker; it cannot be combined with explicit TLS. `NewFactory` checks configuration only. `Prepare` and `Run` check broker and topic readiness when preparing registered consumer readers. A Kafka publisher-only app can start without a broker connection; verify connectivity and delivery with an actual publication.

`Config.TopicPrefix` prefixes both published names and consumer subscriptions. With `prod.` in both factories, register `order.created` in the app and provision `prod.order.created` in the broker. Include the separator in the prefix.

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})` controls reconnection after reader and ACK/NACK failures. Defaults are 100ms initial delay, 5s maximum delay, multiplier 2, jitter 0.2, and unlimited transport retries with `MaxAttempts: 0`. It does not set a handler retry budget or DLQ policy. `WithEventSettlementTimeout` defaults to a 5s ACK/NACK limit. Failed Kafka records are not skipped by later offset commits; a poison record can block a partition.

## RabbitMQ

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

Omitting `PrefetchCount` permits one unacknowledged message per consumer. The default policy is `rabbitmqplatform.FailureReject`; `FailureRequeue` can redeliver an unprocessable message indefinitely. Provision a `DeadLetter` exchange before using it. `TopicPrefix` applies to published routing keys and subscription bindings; `QueuePrefix` applies to queue names.

Publishers use persistent messages, mandatory routing, and publisher confirms. `OperationTimeout` defaults to 5s. There is no `PublisherRetry` option that automatically republishes failed messages. Application retries after lost confirmation can duplicate delivery, so consumers must be idempotent.

## WebSocket

Select Echo or net/http for HTTP and the independent Gorilla implementation for WebSocket. WebSocket routes require HTTP upgrade support and a WS factory. Pass `playground.New()` to `spine.WithValidator` for validation.

Configure origin, connection, and message limits in `boot.HTTPOptions.WebSocket`. Specify the exact origins and connection limit for your application.

```go
HTTP: &boot.HTTPOptions{
    WebSocket: boot.WebSocketOptions{
        AllowedOrigins: []string{"https://app.example.com"},
        MaxConnections: 4096,
    },
},
```

| `WebSocketOptions` field | Type | Default and constraints |
| --- | --- | --- |
| `MaxConnections` | `int` | `0` means `boot.DefaultWebSocketMaxConnections`, or 1024. Set a positive limit or disable it with `boot.UnlimitedWebSocketConnections` |
| `CapacityRetryAfter` | `time.Duration` | 5 seconds. `Retry-After` value when the connection limit is exceeded. Must not be negative |
| `AllowedOrigins` | `[]string` | Same origin if empty. Explicit values must be `http://` or `https://` origins without paths, queries, or fragments. `*` is also supported, but allows all origins |
| `TrustedProxyCIDRs` | `[]string` | No default. List of proxy CIDRs whose forwarded headers are trusted |
| `MaxMessageBytes` | `int64` | 1 MiB. Must not be negative |
| `HandshakeTimeout` | `time.Duration` | 10 seconds. Must not be negative |
| `ReadTimeout` | `time.Duration` | 60 seconds. Must not be negative |
| `WriteTimeout` | `time.Duration` | 10 seconds. Must not be negative |
| `PingInterval` | `time.Duration` | Half the read timeout. 30 seconds with the default read timeout. Must not be negative |

`0` selects the default for time and size fields. To disable the connection limit, use the named constant `boot.UnlimitedWebSocketConnections` instead of `-1`.

If `AllowedOrigins` is empty, browser requests must have the same scheme and host. You can set `TrustedProxyCIDRs` behind a TLS termination proxy. `Forwarded` and `X-Forwarded-Proto` are trusted only when the request's peer is in this list. The proxy must remove or overwrite forwarded headers received from external clients.

Connection requests waiting for authentication count toward the connection limit. Requests above the limit are not upgraded; they receive HTTP 503, a `Retry-After` header, and JSON containing the code `WEBSOCKET_CAPACITY_EXCEEDED`.

If connection authentication is required, also implement `core.WebSocketHandshakeInterceptor` on the interceptor. `PreHandshake` runs after a connection slot is reserved and before the HTTP upgrade. It is separate from the per-message `PreHandle`.

```go
func (i *AuthInterceptor) PreHandshake(
    ctx core.WebSocketHandshakeContext,
    meta core.HandlerMeta,
) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("missing credentials")
    }
    return i.verify(token)
}
```

Contexts used before connection establishment and message contexts preserve the original request's headers, queries, cookies, remote address, host, and request URI. For the public interfaces, see the [execution context reference](/en/reference/api/execution-context#websocket-request-context).

## CORS and cookies {#cors-cookies}

You cannot combine `AllowOrigins: []string{"*"}` with `AllowCredentials: true`. Use `cors.NewValidated` to validate this at startup. `cors.New` also returns a structured error on the first request before writing response headers.

A CORS preflight has `OPTIONS`, `Origin`, and `Access-Control-Request-Method`. An allowed request returns 204; a denied origin, method, or header returns 403. A disallowed origin on an ordinary request receives no CORS allow header, but CORS does not replace server authentication or access control.

`MaxAge` is a pointer to seconds: nil omits the header and 0 sends an explicit zero. `ExposeHeaders` selects exposed headers on ordinary responses, and `AllowOrigin` can make an additional decision for origins not allowed by the static list. A wildcard origin cannot be combined with credentials.

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
    AllowOrigins:     []string{"https://app.example.com"},
    AllowCredentials: true,
})
if err != nil {
    log.Fatal(err)
}
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
```

If a cookie's name, value, path, domain, `SameSite`, or `Priority` is invalid, JSON, string, binary, and redirect responses fail before writing headers or the body. Use `httpx.EncodeCookieValue` and `httpx.DecodeCookieValue` when Unicode or delimiters must be restored to their original values.


### Verify CORS preflight

Save this standalone app as `main.go` in a separate Go module with Spine `v0.7.1` and a compatible Echo platform, then run it. `Authorization` is explicitly listed as an allowed header.

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/interceptor/cors"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/resource", func() httpx.Response[string] { return httpx.Response[string]{Body: "ok"} })
}
func main() {
	maxAge := 60
	policy, err := cors.NewValidated(cors.Config{
		AllowOrigins:     []string{"https://app.example.com"},
		AllowMethods:     []string{"GET"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           &maxAge,
	})
	if err != nil {
		log.Fatal(err)
	}
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}))
	app.InterceptorFor(boot.InterceptorHTTP, policy)
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

The first request returns 204 and `Access-Control-Max-Age: 60`; the second returns 403.

```bash
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization' http://localhost:8080/resource
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: DELETE' http://localhost:8080/resource
```

## Operational constraints

- Monitor `WEBSOCKET_CAPACITY_EXCEEDED`, exhausted consumer reconnection attempts, reader and ACK/NACK failures, and event publishing failures.
- Implement Kafka and RabbitMQ consumers idempotently. Prepare operational procedures for unprocessable Kafka messages and RabbitMQ DLXs as well.
- Actual socket writes and broker publishing are not atomic with DB commits. If atomicity is required, use a transactional outbox and idempotency keys.
- Check supported versions in the [current release](/en/community/changelog).
