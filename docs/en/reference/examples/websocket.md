# Build WebSocket chat with the CLI

Generate a WebSocket component, then implement broadcast logic. This local learning example runs in one process.

## Generate the project and handler

Install the CLI using [installation and the first app](/en/learn/getting-started/first-app), then generate the project and WebSocket handler with these commands.

```sh
spine new chat-app --module example.com/chat-app
cd chat-app
go mod tidy
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

The generator writes `src/websocket/chat/chat_message.go`, `chat_handler.go`, and `module.go`, and adds a checked `chatwebsocket.Register(app)` call to `BuildApplication`. Do not register the same path or constructor again.

## Implement broadcast

The generated handler returns a not-implemented error. Replace all of `chat_handler.go` with the following code, removing the `errors` import and sentinel error. Keep `ChatMessage` in the generated `chat_message.go`.

```go
package chat

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/NARUBROWN/spine/pkg/ws"
)

type ChatSocket struct {
	mu      sync.RWMutex
	clients map[string]ws.Sender
}

func NewChatSocket() *ChatSocket {
	return &ChatSocket{
		clients: make(map[string]ws.Sender),
	}
}

type ChatEvent struct {
	Type    string `json:"type"`
	From    string `json:"from"`
	Message string `json:"message"`
	At      string `json:"at"`
}

func (c *ChatSocket) Handle(
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

	for id, client := range clients {
		if err := client.Send(ws.TextMessage, payload); err != nil {
			c.mu.Lock()
			delete(c.clients, id)
			c.mu.Unlock()
		}
	}
	return nil
}
```

## Keep the generated assembly

In `internal/application/application.go`, keep the health registration and checked `chatwebsocket.Register(app)` call in `BuildApplication`. Set its returned options as follows and add the `time` import. Keep the generated `main.go` sequence: `BuildApplication` → `Validate` → `Run`.

```go
return app, boot.Options{
    Address: address,
    EnableGracefulShutdown: true,
    ShutdownTimeout: 10 * time.Second,
    HTTP: &boot.HTTPOptions{
        WebSocket: boot.WebSocketOptions{
            MaxConnections: 1024,
            MaxMessageBytes: 1 << 20,
            HandshakeTimeout: 10 * time.Second,
            ReadTimeout: 60 * time.Second,
            WriteTimeout: 10 * time.Second,
            PingInterval: 30 * time.Second,
        },
    },
}, nil
```

## Verify and run

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check` checks the static contract; `verify` runs local Go checks. Verify actual connections and message exchange separately. With the server running, open `http://localhost:8080/health` in a browser and execute this in that tab’s developer console.

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

Each connection must send a message before it is included in the sender map. The map is process-local, and stale senders are removed on a later send failure. This is not durable presence or cross-server broadcast.

## Authentication, origins, and capacity

The basic example has no authentication. To add it, implement all four `core.Interceptor` methods and `core.WebSocketHandshakeInterceptor.PreHandshake`, and register the instance with `app.InterceptorFor(boot.InterceptorWebSocket, auth)`. Verify credentials and return an error in `PreHandshake` to reject before upgrade. Message-level `PreHandle` alone does not protect the handshake.

With no `AllowedOrigins`, requests with Origin must match both scheme and host; clients without Origin are allowed. Set exact public origins in production and trust only the required proxy CIDRs. Capacity rejection returns HTTP 503, `Retry-After`, and `WEBSOCKET_CAPACITY_EXCEEDED`.

[Interceptor API](/en/reference/api/interceptor) · [Security configuration](/en/reference/security-configuration)
