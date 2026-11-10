# 选择平台和 DTO 验证

Spine `v0.7.1` 将 HTTP、WebSocket、事件和 DTO 验证的公开契约保留在核心中，并将实现作为独立模块选择。应用只需连接所需实现。

## 使用 CLI 选择

安装正式 CLI `v0.4.3` 或更高版本后，在不同目录中分别运行以下命令。`--channel main` 选择已公开的正式标签。CLI 安装渠道和应用依赖渠道相互独立。

```sh
spine new http-app --module example.com/http-app --channel main --platform nethttp --no-interactive
spine new chat-app --module example.com/chat-app --channel main --platform nethttp --websocket-platform gorilla --no-interactive
spine new worker --module example.com/worker --channel main --platform none --event-platform events:nats --no-interactive
spine new validated-app --module example.com/validated-app --channel main --validator playground --no-interactive
```

默认 HTTP 平台是 Echo，默认不选择 WebSocket、事件、validator 和前端。`--platform none` 创建事件工作进程，需要事件平台。WebSocket 需要 HTTP 平台。`--event-platform` 可以重复指定。

CLI 和核心需要 Go 1.25.5 或更高版本，playground validator 和 NATS 平台需要 Go 1.26 或更高版本。请在 `go.mod` 和 `spine.toml` 中确认所选版本。`--skip-install` 仍会解析版本，但跳过安装和构建。

## 公开契约和实现

HTTP 使用 `contract/http` 与 Echo 或 net/http，WebSocket 使用 `contract/websocket` 与 Gorilla。事件可使用 `contract/event` 与 Kafka、RabbitMQ 或 NATS，验证可使用 `contract/validator` 与 playground。选择 HTTP 平台不会自动添加 WebSocket。

应用将 HTTP 和 WebSocket 选项、`spine.WithEventAdapter` 和 `spine.WithValidator` 传给 `spine.New(...)`。请检查生成的组装代码并处理 factory 错误。旧 `adapter` 兼容路径已弃用，HTTP v2 实现不会自动转换为 v3。

## DTO 验证

通过 `--validator playground` 创建的应用会在处理器前验证绑定的 DTO。未注册 validator 时不会执行 `validate` 标签。以下是请求 DTO 示例。

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=18"`
}
```

规则违反会按 HTTP 400、WebSocket 1008 关闭或消费者失败策略处理。HTTP 字段路径和文档范围取决于所选 validator 契约。

## 更新与验证

`spine update` 保留项目记录的依赖渠道，不会更新 CLI 可执行文件或应用源码。请先检查计划和 base hash，再按输出提示应用。外部数据库、WebSocket 和代理传递需要在实际环境中单独验证。

```sh
spine update --dry-run
```

请参阅[发布渠道与安装](/zh-Hans/community/release-channels)、[输入迁移](/zh-Hans/learn/migration/v0.7.1-preview)和 [HTTP v3 与启动选项](/zh-Hans/learn/migration/preview-features)。
