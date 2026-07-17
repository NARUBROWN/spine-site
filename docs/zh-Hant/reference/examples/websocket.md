# WebSocket 聊天範例

```go
func (c *ChatController) Message(ctx core.WebSocketContext) error {
    return c.hub.Broadcast(ctx.Payload())
}

app.WebSocket("/chat", (*ChatController).Message)
```

`WebSocketContext` 提供連線 ID、訊息型別和負載。處理器和 HTTP 控制器一樣由容器解析，並經由同一執行管線執行。
