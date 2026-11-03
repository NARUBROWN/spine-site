# Current releases

Use `@latest` for general installation. The current documentation targets Spine v0.6.5 and CLI v0.4.2. Check the installed CLI with `spine version` and the actual dependencies in the generated `go.mod`.

## Spine v0.6.5 / CLI v0.4.2

Public HTTP, WebSocket, event, and DTO validation contracts now live under `contract/`. Select independent platforms through `spine.New(...)`; Kafka/RabbitMQ boot options were removed. CLI 0.4.2 generates implementation selections and the v0.6.5 recipe.

[Select platforms and DTO validation](/en/learn/getting-started/platforms)

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

## Spine CLI v0.4.1

The official installation path is `github.com/NARUBROWN/spine-cli/cmd/spine`, and the executable command is `spine`. This patch adds an existing-app migration guide and module cache preparation for offline contract inspection while preserving CLI v0.4.0 commands and generation behavior.

- [CLI v0.4.1 release](https://github.com/NARUBROWN/spine-cli/releases/tag/v0.4.1)
- [Existing-app migration guide](https://github.com/NARUBROWN/spine-cli/blob/v0.4.1/migration/v0.4.0.md)

## Spine CLI v0.4.0

CLI v0.4.0 supports Spine v0.6.0, Echo platform v0.1.0, and the HTTP adapter v2 contract.

- [Install the CLI](/en/learn/getting-started/installation)
- [Build your first app](/en/learn/getting-started/first-app)
