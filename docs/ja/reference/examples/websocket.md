# WebSocketチャットの例

Webソケットを活用した簡単なリアルタイムチャットの例です。

## 概要

SpineのWebSocketサポートを使用してリアルタイムチャットサーバーを実装する方法を示す例です。あるクライアントから受信したメッセージをすべての接続されたクライアントにブロードキャストします。

## Controller
```go
package controller

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/NARUBROWN/spine/pkg/ws"
)

type ChatController struct {
	mu      sync.RWMutex
	clients map[string]ws.Sender
}

func NewChatController() *ChatController {
	return &ChatController{
		clients: make(map[string]ws.Sender),
	}
}

type ChatMessage struct {
	Message string `json:"message"`
}

type ChatEvent struct {
	Type    string `json:"type"`
	From    string `json:"from"`
	Message string `json:"message"`
	At      string `json:"at"`
}

func (c *ChatController) OnMessage(
	ctx context.Context,
	connID ws.ConnectionID,
	msg ChatMessage,
) error {
	sender, ok := ctx.Value(ws.SenderKey).(ws.Sender)
	if ok && sender != nil {
		c.mu.Lock()
		c.clients[connID.Value] = sender
		c.mu.Unlock()
	}

	message := strings.TrimSpace(msg.Message)
	if message == "" {
		return nil
	}

	payload, err := json.Marshal(ChatEvent{
		Type:    "message",
		From:    connID.Value,
		Message: message,
		At:      time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	c.mu.RLock()
	clients := make(map[string]ws.Sender, len(c.clients))
	for id, client := range c.clients {
		clients[id] = client
	}
	c.mu.RUnlock()

	var firstErr error
	for id, client := range clients {
		if err := client.Send(ws.TextMessage, payload); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			c.mu.Lock()
			delete(c.clients, id)
			c.mu.Unlock()
		}
	}
	return firstErr
}
```

## Routes


```go
package routes

import (
	"github.com/NARUBROWN/spine"
	"github.com/NARUBROWN/spine-simple-chat-demo/controller"
)

func RegisterChatRoutes(app spine.App) error {
	return app.WebSocket().Register("/ws/chat", (*controller.ChatController).OnMessage)
}
```

## Main


```go
package main

import (
	"log"
	"time"

	"github.com/NARUBROWN/spine"
	"github.com/NARUBROWN/spine-simple-chat-demo/controller"
	"github.com/NARUBROWN/spine-simple-chat-demo/routes"
	"github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
	app := spine.New()

	app.Constructor(
		controller.NewChatController,
	)

	if err := routes.RegisterChatRoutes(app); err != nil {
		log.Fatal(err)
	}

	if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{
			WebSocket: boot.WebSocketOptions{
				AllowedOrigins: []string{"https://app.example.com"},
				MaxConnections: 1024,
			},
		},
	}); err != nil {
		log.Fatal(err)
	}
}
```

## Handshake認証と容量

認証が必要なrouteのinterceptorは`core.WebSocketHandshakeInterceptor`も実装します。接続slotは`PreHandshake`より先に予約され、`PreHandshake`はHTTP upgradeより前に実行されます。未認証の待機中handshakeも`MaxConnections`に含まれます。メッセージごとの`PreHandle`は別に引き続き実行されます。

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

`AllowedOrigins`を省略するとschemeとhostの両方が一致する要求だけが許可されます。接続上限を超えるとupgradeせず、HTTP 503、`Retry-After`、`WEBSOCKET_CAPACITY_EXCEEDED` JSONを返します。TLS終端proxyを信頼する場合は、正確な`TrustedProxyCIDRs`を設定してください。
