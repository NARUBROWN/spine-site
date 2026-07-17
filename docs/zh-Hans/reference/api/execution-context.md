# core.ExecutionContext

## 概览

`core.ExecutionContext` 是拦截器、解析器与管道使用的公共运行时上下文。它适用于 HTTP、消息消费者和 WebSocket。

```go
type ExecutionContext interface {
    Context() context.Context
    EventBus() eventbus.EventBus
    Method() string
    Path() string
    Header(key string) string
    Params() map[string]string
    PathKeys() []string
    Queries() url.Values
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

## 方法

- `Context()`：获取 Go 上下文。
- `EventBus()`：访问事件发布能力。
- `Method()`、`Path()`、`Header()`：读取 HTTP 请求信息。
- `Params()`、`PathKeys()`、`Queries()`：读取路径与查询参数。
- `Set()`、`Get()`：在同一次执行内共享数据。

## 专用接口

`HttpRequestContext` 额外支持 `Param`、`Query`、`Bind` 与 `MultipartForm`；`ConsumerRequestContext` 提供事件名称和负载；`WebSocketContext` 提供连接 ID、消息类型与负载。

## 示例

```go
func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, _ core.HandlerMeta) error {
    log.Printf("%s %s", ctx.Method(), ctx.Path())
    return nil
}
```

仅在拦截器和参数解析器中使用协议细节；控制器保持面向用例的签名。
