# Current releases

The examples were verified on 2026-11-02 with Spine v0.6.0 and CLI v0.4.0. General installation uses `@latest`; check `spine version` and the generated `go.mod` for the actual CLI and dependency versions.

## Spine v0.6.0

The public API and runtime in Spine v0.6.0 provide the following features.

- Separate the HTTP contract from Echo and create HTTP apps through `spine-echo-platform`
- CLI `v0.4.0` installs the platform, checks the static contract, and builds the app through default `new`

- Four interceptor stages, including `BeforeResponse`, and HTTP responses prepared before transmission
- `App.Validate`, which checks configuration without connecting to the network and returns a structured `boot.ConfigError`
- HTTP and WebSocket interceptor scoping with `InterceptorFor`
- Kafka TLS and consumer retry settings, reader recreation after ACK/NACK failures, and safe shutdown
- RabbitMQ encrypted connections, persistent message publisher confirms, prefetch, failure policies, and DLX
- WebSocket same-origin checks, trusted proxy settings, connection limits, and authentication before upgrade
- Strict validation of credentialed CORS requests and cookie settings
- Readiness checks during boot and shutdown in a defined order
- Safe DI singleton resolution, router fallback handling, and argument conversion

See [Security configuration](/en/reference/security-configuration) for production defaults and constraints.

## Spine CLI v0.4.0

CLI v0.4.0 supports Spine v0.6.0, Echo platform v0.1.0, and the HTTP adapter v2 contract.

- [Install the CLI](/en/learn/getting-started/installation)
- [Build your first app](/en/learn/getting-started/first-app)
