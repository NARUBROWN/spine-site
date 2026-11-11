# WebSocket messages

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

This standalone example echoes to the current connection. Broadcasting needs a separate hub with connection lifetime and sending policies.

## Install and code

```sh
go mod init example.com/spine-websocket
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-gorilla-platform@v0.2.0-preview.2
```

Save as main.go with Go 1.26 or later. Select HTTP and Gorilla separately. WebSocket message DTOs do not use the HTTP Body wrapper. ws.Send takes three arguments: standard context, message type and []byte, and sends only to the current connection. Do not retain request contexts or internal sender keys.

```go
package main

import (
	"encoding/json"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	gorillaplatform "github.com/NARUBROWN/spine-gorilla-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/NARUBROWN/spine/pkg/ws"
	"log"
	"strings"
	"time"
)

type ChatMessage struct {
	Message string `json:"message"`
}
type ChatEvent struct {
	Type    string `json:"type"`
	From    string `json:"from"`
	Message string `json:"message"`
	At      string `json:"at"`
}
type HealthController struct{}

func (*HealthController) Constructor() *HealthController { return &HealthController{} }
func (*HealthController) RegisterRoutes(r *api.Registry) {
	r.GET("/health", func(ctx spinectx.Ctx) httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
	})
}

type ChatSocket struct{}

func (*ChatSocket) Constructor() *ChatSocket { return &ChatSocket{} }
func (*ChatSocket) Handle(ctx spinectx.Ctx, id ws.ConnectionID, message ChatMessage) error {
	text := strings.TrimSpace(message.Message)
	if text == "" {
		return nil
	}
	payload, err := json.Marshal(ChatEvent{Type: "message", From: id.Value, Message: text, At: time.Now().UTC().Format(time.RFC3339)})
	if err != nil {
		return err
	}
	return ws.Send(ctx.ExecutionContext().Context(), ws.TextMessage, payload)
}
func BuildApplication() (spine.App, boot.Options, error) {
	app := spine.New(echoplatform.Option(), gorillaplatform.Option())
	app.Constructor(constructor.Controller(&HealthController{}), constructor.Custom(&ChatSocket{}))
	if err := app.WebSocket().Register("/ws/chat", (*ChatSocket).Handle); err != nil {
		return nil, boot.Options{}, err
	}
	return app, boot.Options{Address: ":8080", EnableGracefulShutdown: true, HTTP: &boot.HTTPOptions{
		WebSocket: boot.WebSocketOptions{MaxConnections: 1024, MaxMessageBytes: 1 << 20,
			HandshakeTimeout: 10 * time.Second, ReadTimeout: 60 * time.Second, WriteTimeout: 10 * time.Second, PingInterval: 30 * time.Second},
	}}, nil
}
func main() {
	app, options, err := BuildApplication()
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

```sh
go run .
```

## Browser check

Run in the developer console of a tab opened at `http://localhost:8080/health`. The console receives an event with message: "hello". Other tabs do not receive it.

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

## Authentication and limits

Authenticate handshakes in WebSocketHandshakeInterceptor.PreHandshake; message PreHandle alone does not protect upgrades. Without AllowedOrigins, requests with Origin require same origin; clients without Origin are allowed. Configure exact origins, trusted proxies and connection limits for production.

## References

[Interceptors](/en/reference/api/interceptor) / [Security](/en/reference/security-configuration)
