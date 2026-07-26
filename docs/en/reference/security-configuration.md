# Security Configuration

Spine uses secure transport and bounded runtime defaults. Call `App.Validate` in deployment checks; `App.Run` performs the same network-free preflight automatically.

## Defaults

| Area | Default | Explicit development or compatibility option |
|---|---|---|
| Kafka | implicit TLS 1.2+ for each enabled reader/writer | custom `TLS`/`Dialer`/`Transport`, or local-only `AllowInsecureTransport: true` |
| RabbitMQ | `amqps://` required | `AllowInsecureTransport: true` with `amqp://` |
| RabbitMQ publish | persistent, mandatory routing, publisher confirms, bounded retry | tune `PublisherRetry` |
| RabbitMQ handler failure | reject without requeue | `FailurePolicy: boot.RabbitMqFailureRequeue` |
| RabbitMQ prefetch | one unacknowledged message per consumer | positive `PrefetchCount` |
| Consumer transport failure | rebuild reader with exponential backoff and jitter | configure `ConsumerRetry` |
| WebSocket origin | scheme and host must match | exact `AllowedOrigins` |
| WebSocket capacity | 1024 active and pending connections | positive limit or `UnlimitedWebSocketConnections` |
| WebSocket authentication | implementations of `WebSocketHandshakeInterceptor` run after slot reservation and before upgrade | implement handshake auth on every protected WS route; pending unauthenticated handshakes count against capacity |
| Global interceptors | HTTP and WebSocket | `InterceptorFor` with a narrower scope |
| Credentialed CORS | explicit origins required | none; wildcard credentials are invalid |
| Cookie serialization | reject invalid fields before writing a response | `EncodeCookieValue` for arbitrary values |

## Validate before opening the network

```go
opts := boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{
        WebSocket: boot.WebSocketOptions{
            AllowedOrigins:   []string{"https://app.example.com"},
            MaxConnections:   2_000,
            MaxMessageBytes:  1 << 20,
            TrustedProxyCIDRs: []string{"10.0.0.0/8"},
        },
    },
}

if err := app.Validate(opts); err != nil {
    var configErr *boot.ConfigError
    if errors.As(err, &configErr) {
        for _, issue := range configErr.Issues {
            log.Printf("%s [%s]: %s", issue.Path, issue.Code, issue.Hint)
        }
    }
    log.Fatal(err)
}

if err := app.Run(opts); err != nil {
    log.Fatal(err)
}
```

`ConfigIssue.Code` is the stable, machine-readable deployment signal. Do not parse `Message`, and do not include broker credentials in logs.

## Operational requirements

- Only enable insecure broker transport in an isolated local environment.
- Provision a RabbitMQ dead-letter exchange before configuring it on a Spine consumer queue.
- Make Kafka/RabbitMQ consumers idempotent. Reconnects and lost confirms can legitimately cause at-least-once redelivery or duplicates.
- When enabling trusted proxy CIDRs, configure the proxy to remove or overwrite client-supplied forwarding headers.
- Alert on `WEBSOCKET_CAPACITY_EXCEEDED`, consumer reconnect exhaustion, and RabbitMQ `Type`/`RoutingKey` mismatch logs.
- Treat `boot.ConfigError.Issues` codes as stable machine-readable deployment diagnostics; do not parse the human message.

See the [Current Release](/en/community/changelog) for the supported Spine version.
