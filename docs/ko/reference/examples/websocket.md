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
	"maps"
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

func (c *ChatController) OnMessage(ctx context.Context, connID ws.ConnectionID, msg ChatMessage) error {
	c.trackConnection(ctx, connID)

	trimmed := strings.TrimSpace(msg.Message)
	if trimmed == "" {
		return nil
	}

	event := ChatEvent{
		Type:    "message",
		From:    connID.Value,
		Message: trimmed,
		At:      time.Now().UTC().Format(time.RFC3339),
	}

	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return c.broadcast(ws.TextMessage, data)
}

func (c *ChatController) trackConnection(ctx context.Context, connID ws.ConnectionID) {
	sender, ok := ctx.Value(ws.SenderKey).(ws.Sender)
	if !ok || sender == nil {
		return
	}

	c.mu.Lock()
	c.clients[connID.Value] = sender
	c.mu.Unlock()
}

func (c *ChatController) broadcast(messageType int, data []byte) error {
	c.mu.RLock()
	snapshot := make(map[string]ws.Sender, len(c.clients))
	maps.Copy(snapshot, c.clients)
	c.mu.RUnlock()

	var firstErr error
	for id, client := range snapshot {
		if err := client.Send(messageType, data); err != nil {
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

func RegisterChatRoutes(app spine.App) {
	app.WebSocket().Register("/ws/chat", (*controller.ChatController).OnMessage)
}
```

## Main

```go
package main

import (
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

	routes.RegisterChatRoutes(app)

	app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP:                   &boot.HTTPOptions{},
	})
}
```
