# 安全的 WebSocket 聊天示例

```go
type ChatMessage struct {
	Text string `json:"text"`
}

func (c *ChatController) Message(
	ctx context.Context,
	connID pkgws.ConnectionID,
	payload []byte,
	message ChatMessage,
) {
	log.Printf("connection=%s payload=%s", connID.Value, payload)
	response, _ := json.Marshal(message)
	_ = pkgws.Send(ctx, pkgws.TextMessage, response)
}

if err := app.WebSocket().Register("/chat", (*ChatController).Message); err != nil {
	log.Fatal(err)
}

auth := &AuthInterceptor{}
app.InterceptorFor(boot.InterceptorWebSocket, auth)
```

> WebSocket 的实际注册 API 是 `app.WebSocket().Register(...)`，不是 `app.WebSocket(path, handler)`。

## upgrade 前认证

```go
func (i *AuthInterceptor) PreHandshake(
	ctx core.WebSocketHandshakeContext,
	meta core.HandlerMeta,
) error {
	token := ctx.Header("Authorization")
	if token == "" {
		return httperr.Unauthorized("missing credentials")
	}
	return i.verify(token)
}
```

认证拦截器必须同时实现完整 `core.Interceptor` 接口，并通过 `InterceptorFor(boot.InterceptorWebSocket, auth)` 注册。容量槽位会先保留，然后执行 `PreHandshake`，最后才进行 HTTP upgrade；待认证握手因此也计入容量。

## 有界配置

```go
HTTP: &boot.HTTPOptions{
	WebSocket: boot.WebSocketOptions{
		AllowedOrigins:     []string{"https://app.example.com"},
		TrustedProxyCIDRs:  []string{"10.0.0.0/8"},
		MaxConnections:    500,
		CapacityRetryAfter: 5 * time.Second,
		MaxMessageBytes:   1 << 20,
		HandshakeTimeout:  5 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      10 * time.Second,
		PingInterval:      30 * time.Second,
	},
}
```

`MaxConnections` 为零时默认 1024；明确使用 `boot.UnlimitedWebSocketConnections` 才会关闭容量限制。达到上限时，Spine 在 upgrade 前返回 HTTP 503、`Retry-After` 和 `WEBSOCKET_CAPACITY_EXCEEDED`。

默认来源校验要求 scheme 与 host 同时匹配。仅当直接对端属于 `TrustedProxyCIDRs` 时才信任 forwarding headers，且代理必须覆盖客户端提供的相关 header。
