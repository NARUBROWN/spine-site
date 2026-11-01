# Current releases

This documentation site is based on Spine v0.5.1 and Spine CLI v0.1.4.

## Spine v0.5.1

The public API and runtime in Spine v0.5.1 provide the following features.

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

## Spine CLI v0.1.4

The installation and project creation examples use Spine CLI v0.1.4. This CLI version creates projects that use Spine v0.5.1.

- [Install the CLI](/en/learn/getting-started/installation)
- [Build your first app](/en/learn/getting-started/first-app)
