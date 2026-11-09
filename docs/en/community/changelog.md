# Release notes

See the [version catalog](/en/community/versions) for the latest tags and next target versions.

See [Release channels and installation](/en/community/release-channels) to choose Preview, RC, or stable and understand the publication process.

## Spine v0.7.1

Spine `v0.7.1` provides controller routes, constructor roles, source-specific HTTP inputs, runtime OpenAPI, and HTTP v3. Legacy input APIs remain compatible but are deprecated and cannot be mixed with new inputs in one handler.

See the [v0.7.1 migration guide](/en/learn/migration/v0.7.1) and [runtime OpenAPI](/en/reference/api/openapi). Select the CLI version separately from app dependencies. Check the installed CLI with `spine version` and resolved dependencies in `go.mod`. The entries below record the named historical versions.

## Preview CLI @preview {#cli-preview-branch}

Install the CLI with `@preview` if desired. Choose application dependencies independently with `spine new --channel preview`, `rc`, or `main`. The Preview channel resolves the selected dependencies from moving `@preview` branches. Keep app source, `go.mod`, and `go.sum` for reproducibility.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

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
