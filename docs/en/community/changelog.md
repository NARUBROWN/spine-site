# Current Release

## Spine v0.5.1

Spine v0.5.1 provides the current public API and runtime behavior documented on this site:

- four-phase interceptors with `BeforeResponse` and staged HTTP responses;
- network-free `App.Validate` checks with structured `boot.ConfigError` issues;
- scoped HTTP and WebSocket interceptors through `InterceptorFor`;
- Kafka TLS, bounded consumer retry, failed ACK/NACK reader rebuilding, and graceful draining;
- RabbitMQ secure transport, persistent confirmed publishing, prefetch, failure policy, and DLX controls;
- same-origin WebSocket checks, trusted proxies, connection capacity, and pre-upgrade authentication;
- strict credentialed CORS and Cookie validation;
- bootstrap readiness checks and deterministic shutdown;
- safe DI singleton resolution, router fallback, and argument conversion.

Use the [Security Configuration](/en/reference/security-configuration) reference for production settings.
