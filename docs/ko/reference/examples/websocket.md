# 웹소켓 채팅 예제

웹소켓을 활용한 간단한 실시간 채팅 예제입니다.

## 개요

Spine의 웹소켓(WebSocket) 지원을 이용해 실시간 채팅 서버를 구현하는 방법을 보여주는 예제입니다. 한 클라이언트로부터 받은 메시지를 모든 접속된 클라이언트에게 브로드캐스트합니다.

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

## Handshake 인증과 용량

인증이 필요한 route의 인터셉터는 `core.WebSocketHandshakeInterceptor`도 구현합니다. 연결 slot은 `PreHandshake`보다 먼저 예약되고, `PreHandshake`는 HTTP upgrade 전에 실행됩니다. 인증되지 않은 대기 handshake도 `MaxConnections`에 포함됩니다. 메시지별 `PreHandle`은 별도로 계속 실행됩니다.

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

`AllowedOrigins`를 생략하면 scheme과 host가 모두 같은 요청만 허용됩니다. 연결 상한을 넘으면 upgrade 대신 HTTP 503, `Retry-After`, `WEBSOCKET_CAPACITY_EXCEEDED` JSON을 반환합니다. TLS 종료 proxy를 신뢰해야 한다면 정확한 `TrustedProxyCIDRs`를 설정하십시오.
