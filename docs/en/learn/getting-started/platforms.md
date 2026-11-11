# Choosing platforms and DTO validation

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Spine `v0.7.5` keeps public HTTP, WebSocket, event, and DTO validation contracts in core and selects implementations as independent modules. Connect only the implementations your application needs.

## Choose with the CLI

Complete [CLI installation](/en/learn/getting-started/installation) and use a Preview CLI supporting the 0.7.5 API. CLI installation and app dependency channels are independent.

```sh
spine new http-app --module example.com/http-app --channel preview --platform nethttp --no-interactive
spine new chat-app --module example.com/chat-app --channel preview --platform nethttp --websocket-platform gorilla --no-interactive
spine new worker --module example.com/worker --channel preview --platform none --event-platform events:nats --no-interactive
spine new validated-app --module example.com/validated-app --channel preview --validator playground --no-interactive
```

Echo is the default HTTP platform; WebSocket, events, validator, and frontend are not selected by default. `--platform none` creates an event worker and requires an event platform. WebSocket requires an HTTP platform. `--event-platform` can be repeated.

The CLI and core require Go 1.25.5 or later. The playground validator and NATS platform require Go 1.26 or later. Check selected versions in `go.mod` and `spine.toml`. `--skip-install` still resolves versions, but skips installation and building.

## Public contracts and implementations

HTTP uses `contract/http` with Echo or net/http, and WebSocket uses `contract/websocket` with Gorilla. Events can use `contract/event` with Kafka, RabbitMQ, or NATS; validation can use `contract/validator` with playground. Selecting an HTTP platform does not add WebSocket automatically.

An application passes HTTP and WebSocket options, `spine.WithEventAdapter`, and `spine.WithValidator` to `spine.New(...)`. Check generated composition code and handle factory errors. Existing `adapter` compatibility paths are deprecated, and an HTTP v2 implementation is not automatically converted to v3.

## DTO validation

An app generated with `--validator playground` validates bound DTOs before the handler. Without a registered validator, `validate` tags are not executed. This is an example request DTO.

```go
type CreateUserRequest struct {
	Email string `json:"email" validate:"required,email"`
	Age   int    `json:"age" validate:"gte=18"`
}
```

Rule violations result in HTTP 400, WebSocket close 1008, or the consumer failure policy. HTTP field paths and document coverage depend on the selected validator contract.

## Update and verify

`spine update` retains the dependency channel recorded by the project; it does not update the CLI executable or application source. Review the plan and base hash first and apply as directed by the output. Verify external databases, WebSocket behavior, and broker delivery separately in the target environment.

```sh
spine update --dry-run
```

See [release channels and installation](/en/community/release-channels), [input migration](/en/learn/migration/v0.7.5), and [HTTP v3 and boot options](/en/learn/migration/v0.7.5).
