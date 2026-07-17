# WebSocket 聊天示例

本示例展示一个 WebSocket 聊天处理器。

```go
func (c *ChatController) Message(ctx core.WebSocketContext) error {
    message := ctx.Payload()
    return c.hub.Broadcast(message)
}

app.WebSocket("/chat", (*ChatController).Message)
```

`WebSocketContext` 提供连接 ID、消息类型和负载。处理器与 HTTP 控制器一样由容器解析，并通过同一执行管道运行。
