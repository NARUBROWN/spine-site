# Select platforms and DTO validation

Spine 0.6.5 keeps the public HTTP, WebSocket, event, and DTO validation contracts in the core and selects concrete implementations from independent modules. The core uses only the standard library. CLI 0.4.2 uses the `platform-contracts-v0.6.5` recipe, selecting Spine v0.6.5 and v0.1.0 tags for the implementations.

## Install the CLI and generate projects

Use `@latest` for general installation and CLI upgrades. Each project command below creates a separate directory. Defaults are Echo HTTP with no WebSocket, event platform, or validator.

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
spine new http-app --module example.com/http-app
spine new chat-app --module example.com/chat-app --websocket-platform gorilla
spine new worker --module example.com/worker --platform none --event-platform events:kafka
spine new validated-app --module example.com/validated-app --validator playground
```

Supported options are `--platform echo|none`, `--websocket-platform none|gorilla`, repeatable `--event-platform [name:]kafka|rabbitmq`, and `--validator none|playground`. Gorilla requires Echo HTTP. An HTTP-less worker requires at least one event platform. Only selected implementations are installed; generation does not execute the app, factories, listeners, or brokers.

Configure broker addresses and credentials through the environment variables in the generated README. Select consumption and publication roles with `Config.Consume` and `Config.Publish` in application code. A platform named `events` uses the `SPINE_EVENTS_` prefix. `spine.toml` records implementation selections.

## Public contracts and application assembly

| Contract | Implementation module |
| --- | --- |
| `contract/http` | `spine-echo-platform` |
| `contract/websocket` | `spine-gorilla-platform` |
| `contract/event` | `spine-kafka-platform`, `spine-rabbitmq-platform` |
| `contract/validator` | `spine-validator-playground` |

The generated `BuildApplication` passes options directly to `spine.New(...)`: `echoplatform.Option()` for HTTP, `gorillaplatform.Option()` for WebSocket, `spine.WithEventAdapter(name, factory)` for events, and `spine.WithValidator(validator)` for validation. Check factory and validator creation errors before returning the app.

The older `adapter`, `adapter/http`, `adapter/event`, and `wsadapter` paths remain compatibility aliases in 0.6.5. New implementations use `contract/` paths. Selecting HTTP alone does not add a WebSocket implementation.

## DTO validation

`--validator playground` requires Go 1.26 or later. The CLI and applications without that validator require Go 1.25.5 or later. Register the result of `playground.New()` with `spine.WithValidator` to validate bound HTTP JSON/form DTOs and decoded WebSocket/consumer DTOs before handlers run. Without a validator, `validate` tags are not checked automatically.

This request DTO can be used in an app generated with `--validator playground`.

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=18"`
}
```

Rule violations produce HTTP 400 with `message` and `fields`, close WebSocket with 1008, or follow the consumer NACK policy. HTTP `fields[].field` uses JSON Pointer and rejected values are not exposed automatically. Validator execution errors produce HTTP 500 or WebSocket 1011.

## Migrate and verify existing apps

`boot.Options.Kafka`, `boot.Options.RabbitMQ`, and broker-specific boot types were removed. Select `Consume`/`Publish` and connection settings in external Kafka/RabbitMQ `Config` values, then register them with `WithEventAdapter`. Use `WithEventConsumerRetry` and `WithEventSettlementTimeout` for reconnection and ACK/NACK time limits.

Upgrade the CLI by rerunning `go install ...@latest` above. `spine update` updates project dependencies for the selected recipe; it does not rewrite source, implementation selections, or an existing recipe. Manually migrate assembly and settings before reviewing dependency changes.

To migrate an existing app to 0.6.5, first update or add the recipe and implementation selection keys in `spine.toml`, preserving `module`, `entrypoint`, `composition`, `port`, and `layout`. The following configuration is for an HTTP-only app without a validator. Use `gorilla` for WebSocket, `playground` for validation, and an `event_platforms` list matching the actual event names and providers when needed. Align these selections with application assembly before updating dependencies below. An existing app without a recipe keeps the 0.6.0 dependency combination even after a CLI upgrade.

```toml
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
event_platforms = []
```

```sh
spine update --dry-run
spine update
spine contract check
spine verify
```

Review the dry-run changes, then apply without `--dry-run`. After static and local checks pass, verify live HTTP/WebSocket behavior and broker delivery separately.

[0.6.5 migration guide](https://github.com/NARUBROWN/spine/blob/v0.6.5/docs/migration/v0.6.5.md)
