# Build a WebSocket Chat Server

Build a chat server that broadcasts messages received at `/ws/chat` to registered clients. Generate WebSocket components with the CLI, implement the handler, then check message sending and receiving in a browser.

## Prerequisites

Complete [Installation and Your First App](/en/learn/getting-started/first-app) first. This example is local learning code that runs in one server process. It does not include authentication or broadcasting across multiple servers.

## 1. Generate the Project and Message Handler

Generate the project and WebSocket handler. Run subsequent commands from `chat-app/`.

```sh
spine new chat-app --layout legacy --module example.com/chat-app --websocket-platform gorilla
cd chat-app
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

The command generates `chat_message.go`, `chat_handler.go`, and `module.go` in `src/websocket/chat/`. It also adds a `chatwebsocket.Register(app)` call and error handling to `BuildApplication`. Do not register the same path or constructor again.

## 2. Implement the Broadcast Handler

The generated handler returns a not-implemented error. Replace the entire contents of `src/websocket/chat/chat_handler.go` with the code below. Replacing the entire file also removes the existing `errors` import and not-implemented error declaration. Keep `ChatMessage` in `chat_message.go` and `module.go` as generated.

The handler registers the sender for the connection that sent the message, then forwards non-empty messages to all registered connections. It removes connections from the list when sending fails.

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

## 3. Configure WebSocket Runtime Options

In `BuildApplication` in `internal/application/application.go`, replace only the returned options with the code below and add a `time` import. Keep the existing health registration and `chatwebsocket.Register(app)` call. The generated root `main.go` calls `BuildApplication`, `Validate`, and `Run` in that order.

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

## 4. Validate and Start the Server

From the project root, check the code, export the AsyncAPI document, and start the server.

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check` checks static contracts. `verify` checks static contracts, gofmt, go vet, and Go tests. `contract export` writes the registered WebSocket contracts to `asyncapi.json`. Check actual connections and message exchange in the next step.

## 5. Test Sending and Receiving Messages in a Browser

With the server running, open `http://localhost:8080/health` in a browser. Run the following code in the developer tools console of the same tab.

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

Check that the console displays an object with the fields `type`, `from`, `message`, and `at`. The `message` value is `hello`. Running the same code in another tab lets both the previously registered connection and the new connection receive messages.

To receive broadcasts, each connection must first send a message to register its sender. The sender list is stored only in process memory, and closed connections are removed when a later send fails. Persisting connection state or sharing it across multiple servers requires a separate implementation.

## Before Using This in Production

### Handshake Authentication

To add authentication, implement the four methods of `core.Interceptor` and `core.WebSocketHandshakeInterceptor.PreHandshake`, then register the interceptor with `app.InterceptorFor(boot.InterceptorWebSocket, auth)`. By verifying credentials in `PreHandshake` and returning an error, you can reject requests before they upgrade to a WebSocket connection. `PreHandle` during message processing alone cannot protect the handshake.

### Origin and Connection Limits

If you omit `AllowedOrigins`, requests that include an Origin must have the same scheme and host. Clients without an Origin are allowed. In production, set the exact public Origin and, if needed, specify only the CIDRs of trusted proxies. When the connection limit is exceeded, the response returns HTTP 503 with `Retry-After` and `WEBSOCKET_CAPACITY_EXCEEDED`.

## Next Steps

See the [Interceptor API](/en/reference/api/interceptor) for the methods needed to implement authentication, and review Origin and connection limits in [Security Configuration](/en/reference/security-configuration).
