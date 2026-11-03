# 选择平台与 DTO 验证

Spine 0.6.5 将 HTTP、WebSocket、事件和 DTO 验证的公共契约保留在核心中，从独立模块选择具体实现。核心仅使用标准库。CLI 0.4.2 的 `platform-contracts-v0.6.5` 配方选择 Spine v0.6.5 和各实现的 v0.1.0 标签。

## 安装 CLI 并生成项目

常规安装和 CLI 升级使用 `@latest`。以下各项目命令创建不同目录。默认选择 HTTP Echo，不添加 WebSocket、事件平台或验证器。

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
spine new http-app --module example.com/http-app
spine new chat-app --module example.com/chat-app --websocket-platform gorilla
spine new worker --module example.com/worker --platform none --event-platform events:kafka
spine new validated-app --module example.com/validated-app --validator playground
```

支持 `--platform echo|none`、`--websocket-platform none|gorilla`、可重复的 `--event-platform [name:]kafka|rabbitmq` 和 `--validator none|playground`。Gorilla 需要 HTTP Echo。无 HTTP 的 worker 至少需要一个事件平台。只安装选中的实现，生成时不运行应用、factory、监听器或消息代理。

通过生成的 README 中的环境变量配置消息代理地址和凭据。在应用代码中使用 `Config.Consume`、`Config.Publish` 选择消费和发布角色。名为 `events` 的平台使用 `SPINE_EVENTS_` 前缀。`spine.toml` 记录实现选择。

## 公共契约与应用组装

| 契约 | 实现模块 |
| --- | --- |
| `contract/http` | `spine-echo-platform` |
| `contract/websocket` | `spine-gorilla-platform` |
| `contract/event` | `spine-kafka-platform`, `spine-rabbitmq-platform` |
| `contract/validator` | `spine-validator-playground` |

生成的 `BuildApplication` 直接向 `spine.New(...)` 传递所需选项：HTTP 使用 `echoplatform.Option()`，WebSocket 使用 `gorillaplatform.Option()`，事件使用 `spine.WithEventAdapter(name, factory)`，验证使用 `spine.WithValidator(validator)`。返回应用之前检查 factory 和验证器的创建错误。

旧的 `adapter`、`adapter/http`、`adapter/event` 和 `wsadapter` 在 0.6.5 中保留为兼容别名。新实现使用 `contract/` 路径。只选择 HTTP 不会自动添加 WebSocket 实现。

## DTO 验证

`--validator playground` 需要 Go 1.26 或更高版本。CLI 和未选择此验证器的应用需要 Go 1.25.5 或更高版本。将 `playground.New()` 的结果注册到 `spine.WithValidator` 后，在处理器前验证已绑定的 HTTP JSON/表单 DTO 及 WebSocket/消费者消息 DTO。省略验证器时不会自动检查 `validate` 标签。

以下请求 DTO 可用于通过 `--validator playground` 生成的应用。

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=18"`
}
```

规则违反产生包含 `message`、`fields` 的 HTTP 400 响应、WebSocket 1008 关闭或消费者 NACK 策略。HTTP 的 `fields[].field` 使用 JSON Pointer，不会自动暴露被拒绝的输入值。验证器执行错误产生 HTTP 500 或 WebSocket 1011。

## 迁移并验证现有应用

`boot.Options.Kafka`、`boot.Options.RabbitMQ` 和消息代理专用 boot 类型已删除。在外部 Kafka/RabbitMQ `Config` 中设置 `Consume`、`Publish` 和连接信息，然后通过 `WithEventAdapter` 注册。使用 `WithEventConsumerRetry`、`WithEventSettlementTimeout` 配置重连和 ACK/NACK 超时。

重新执行上面的 `go install ...@latest` 来更新 CLI。`spine update` 仅更新所选配方的项目依赖，不会改写源码、实现选择或现有配方。请先手动迁移组装代码和配置，再审查依赖变更。

将现有应用迁移到 0.6.5 时，先保留 `spine.toml` 中的 `module`、`entrypoint`、`composition`、`port`、`layout`，修改或添加配方和实现选择键。以下配置用于仅 HTTP 且不使用验证器的应用。按需将 WebSocket 设为 `gorilla`、验证器设为 `playground`，并使 `event_platforms` 列表与实际注册的事件名称和平台类型一致。将实现选择与应用组装代码对齐后，再执行下面的依赖更新。未指定配方的现有应用即使升级 CLI，仍保留 0.6.0 的依赖组合。

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

审查 dry-run 的变更后，不加 `--dry-run` 执行。静态和本地检查通过后，单独验证实际 HTTP/WebSocket 行为和消息代理传递。

[0.6.5 迁移指南](https://github.com/NARUBROWN/spine/blob/v0.6.5/docs/migration/v0.6.5.md)
