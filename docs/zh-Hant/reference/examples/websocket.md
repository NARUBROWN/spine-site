# 安全的 WebSocket 聊天範例

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

> WebSocket 的實際註冊 API 是 `app.WebSocket().Register(...)`，不是 `app.WebSocket(path, handler)`。

## upgrade 前驗證

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

驗證攔截器必須同時實作完整 `core.Interceptor` 介面，並透過 `InterceptorFor(boot.InterceptorWebSocket, auth)` 註冊。容量槽位會先保留，接著執行 `PreHandshake`，最後才進行 HTTP upgrade；待驗證握手因此也計入容量。

## 有界設定

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

`MaxConnections` 為零時預設 1024；明確使用 `boot.UnlimitedWebSocketConnections` 才會停用容量限制。達到上限時，Spine 在 upgrade 前回傳 HTTP 503、`Retry-After` 和 `WEBSOCKET_CAPACITY_EXCEEDED`。

預設來源檢查要求 scheme 與 host 同時相符。只有直接對端屬於 `TrustedProxyCIDRs` 時才信任 forwarding headers，且代理必須覆寫客戶端提供的相關 header。
