# Security configuration

Spine v0.6.0 applies encrypted broker connections and HTTP and WebSocket size, time, and connection limits by default. Use this reference to check defaults and configuration constraints, then choose the origins, authentication, and message failure policies for your deployed application.

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

Errors are returned as `*boot.ConfigError`. Each `ConfigIssue` in `Issues` provides the following fields. Use `Code` to classify errors programmatically instead of parsing the message. Credentials in broker URLs are not exposed in configuration errors.

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
| RabbitMQ publishing | Persistent messages, mandatory routing, publisher confirms, finite retries | `PublisherRetry` |
| RabbitMQ processing failures | Reject without requeueing | `FailurePolicy` |
| RabbitMQ concurrent processing | 1 unacknowledged message per consumer | Positive `PrefetchCount` |
| Consumer transport failures | Recreate the reader with exponential backoff and jitter | `ConsumerRetry` |
| WebSocket origins | Browser requests allowed only from the same scheme and host | `AllowedOrigins` |
| WebSocket connections | 1024 established connections and pending connection requests combined | Positive `MaxConnections` or `boot.UnlimitedWebSocketConnections` |
| WebSocket connection authentication | Only interceptors implementing the optional interface run before the upgrade | Implement `core.WebSocketHandshakeInterceptor` |
| Global interceptors | Apply to both HTTP and WebSocket | Limit the scope with `InterceptorFor` |
| CORS with credentials | Explicit origins required | Cannot combine `*` with `AllowCredentials: true` |
| Cookies | Reject invalid fields before writing the response | Use `httpx.EncodeCookieValue` when arbitrary values must be preserved |

## Kafka

Enable `Read` and `Write` in `boot.KafkaOptions` independently. Configuring either requires `Brokers`; using `Read` also requires `GroupID`. TLS 1.2 or later is applied to both consumers and publishers unless separate transport settings are provided.

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    Read:  &boot.KafkaReadOptions{GroupID: "orders"},
    Write: &boot.KafkaWriteOptions{},
}
```

Configure `TLS`, `Dialer`, and `Transport` if you need a custom CA, mTLS, or SASL. Configuring both explicit TLS and `AllowInsecureTransport` for an enabled role produces a `KAFKA_TLS_INSECURE_CONFLICT` error. Explicitly allow plaintext connections only in an isolated local development environment.

```go
Kafka: &boot.KafkaOptions{
    Brokers:                []string{"localhost:9092"},
    AllowInsecureTransport: true,
    Read:                   &boot.KafkaReadOptions{GroupID: "local"},
}
```

After a reader error or ACK/NACK failure, the existing reader is closed and a new one is created according to `ConsumerRetry`. This option controls transport reconnection; it does not change the handler's message processing policy.

| `ConsumerRetryOptions` field | Type | Default |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5 seconds |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2, or 20% |
| `MaxAttempts` | `int` | `0`, unlimited retries |

`0` selects the default for each field. Negative values are not allowed. An explicit maximum delay must be at least the initial delay; the multiplier must be at least 1, and jitter must be between 0 and 1. The same options apply to RabbitMQ consumers.

Implement Kafka handlers idempotently to account for redelivery. Permanently unprocessable messages are not automatically skipped or sent to a separate failure queue.

## RabbitMQ

Use `amqps://` for production URLs. Each enabled `Read` and `Write` requires `Exchange`. The default failure policy rejects messages without requeueing.

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

| Read setting | Default and constraints |
| --- | --- |
| `PrefetchCount` | `0` means 1 unacknowledged message per consumer. Must be positive when explicitly set |
| `FailurePolicy` | `boot.RabbitMqFailureReject` if omitted. Use `boot.RabbitMqFailureRequeue` to requeue |
| `DeadLetter` | Default: `nil`. When configured, requires `Exchange` for a pre-created DLX; `RoutingKey` is also optional |
| `RequeueOnError` | Compatibility with earlier versions. `true` requeues. A conflict with an explicit `FailurePolicy` produces a configuration error |

A DLX is an exchange that receives messages that could not be processed. An operator must create it first. Without a matching DLX configuration, rejected messages may be discarded. If an existing queue's arguments differ from the new settings, RabbitMQ may return a queue declaration precondition failure.

`RabbitMqFailureRequeue` can redeliver unprocessable messages indefinitely. Use the reject policy and a DLX for new configurations. `RequeueOnError` is planned for deprecation; use `FailurePolicy` in new code. Handlers are selected by the `RoutingKey` used to bind the queue, rather than the AMQP `Type`.

The publisher uses persistent messages, `mandatory=true`, and publisher confirms. It does not treat publishing as successful if a message cannot be routed or a confirm is rejected or lost. Retrying after a lost confirm can publish the same message more than once, so consumers must be idempotent.

| `PublisherRetryOptions` field | Type | Default |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5 seconds |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2, or 20% |
| `MaxAttempts` | `int` | 3 attempts in total |
| `ConfirmTimeout` | `time.Duration` | 5 seconds |

`0` selects the default for each field. Negative values are not allowed. Delay range, multiplier, and jitter constraints are the same as for `ConsumerRetryOptions`. Consider the possibility of duplicate publishing when increasing `MaxAttempts`.

## WebSocket

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

## Operational constraints

- Monitor `WEBSOCKET_CAPACITY_EXCEEDED`, exhausted consumer reconnection attempts, and RabbitMQ `Type` and `RoutingKey` mismatches.
- Implement Kafka and RabbitMQ consumers idempotently. Prepare operational procedures for unprocessable Kafka messages and RabbitMQ DLXs as well.
- Actual socket writes and broker publishing are not atomic with DB commits. If atomicity is required, use a transactional outbox and idempotency keys.
- Check supported versions in the [current release](/en/community/changelog).
