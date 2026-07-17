# ExecutionContext

## 概览

`ExecutionContext` 是管道在执行请求时传递的运行时上下文。它统一提供 HTTP、消息消费者和 WebSocket 所需的公共能力，同时保留各协议特有的数据。

## 上下文层级

`ContextCarrier` 提供 `context.Context`，`EventBusCarrier` 提供事件总线。`ExecutionContext` 在此基础上增加请求方法、路径、头、参数、查询参数和内部存储。

```go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier
    Method() string
    Path() string
    Params() map[string]string
    PathKeys() []string
    Queries() url.Values
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

## 协议专用上下文

- `HttpRequestContext`：`Param`、`Query`、`Headers`、`Bind` 与 `MultipartForm`。
- `ConsumerRequestContext`：`EventName` 与 `Payload`。
- `WebSocketContext`：连接 ID、消息类型与消息负载。
- `ControllerContext`：读取由拦截器放入内部存储的值。

## 在拦截器中使用

```go
func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, _ core.HandlerMeta) error {
    log.Printf("%s %s", ctx.Method(), ctx.Path())
    ctx.Set("requestID", uuid.NewString())
    return nil
}
```

## 在参数解析器中使用

参数解析器接收 `ExecutionContext` 并根据协议类型断言。例如 HTTP 解析器可读取路径和查询参数，消费者解析器可读取事件负载。控制器不需要直接依赖底层上下文。

## 设计原则

控制器表达用例；解析器与拦截器处理传输细节。所有协议共享同一条管道，但各自的上下文能力仍清晰隔离。
