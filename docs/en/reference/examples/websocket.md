# WebSocket Chat Example

A bounded, same-origin WebSocket endpoint with handshake authentication.

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
    return &ChatController{clients: make(map[string]ws.Sender)}
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
        Type: "message", From: connID.Value, Message: message,
        At: time.Now().UTC().Format(time.RFC3339),
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

Copy the client map under the read lock before sending. A `ws.Sender` serializes writes for its connection, but your own shared maps and application objects still need synchronization.

## Handshake authentication

`Interceptor.PreHandle` executes for messages after the connection exists. To reject an unauthenticated HTTP upgrade, implement `core.WebSocketHandshakeInterceptor` on an interceptor registered for the WebSocket scope.

```go
package interceptor

import (
    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
)

type WebSocketAuth struct {
    tokens *TokenService
}

func NewWebSocketAuth(tokens *TokenService) *WebSocketAuth {
    return &WebSocketAuth{tokens: tokens}
}

func (i *WebSocketAuth) PreHandshake(
    ctx core.WebSocketHandshakeContext,
    meta core.HandlerMeta,
) error {
    token, ok := ctx.Cookie("session")
    if !ok || i.tokens.Verify(token) != nil {
        return httperr.Unauthorized("authentication required")
    }
    return nil
}

func (i *WebSocketAuth) PreHandle(core.ExecutionContext, core.HandlerMeta) error {
    return nil
}
func (i *WebSocketAuth) PostHandle(core.ExecutionContext, core.HandlerMeta) {}
func (i *WebSocketAuth) BeforeResponse(
    core.ExecutionContext,
    core.HandlerMeta,
    error,
) error {
    return nil
}
func (i *WebSocketAuth) AfterCompletion(
    core.ExecutionContext,
    core.HandlerMeta,
    error,
) {}
```

Spine reserves a connection slot before `PreHandshake`, then runs the hook before HTTP upgrade. Pending unauthenticated handshakes therefore count against `MaxConnections`.

## Register and run

```go
package main

import (
    "log"
    "time"

    spine "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"

    "example.com/chat/controller"
    "example.com/chat/interceptor"
)

func main() {
    app := spine.New()
    app.Constructor(
        NewTokenService,
        interceptor.NewWebSocketAuth,
        controller.NewChatController,
    )

    app.InterceptorFor(
        boot.InterceptorWebSocket,
        (*interceptor.WebSocketAuth)(nil),
    )

    if err := app.WebSocket().Register(
        "/ws/chat",
        (*controller.ChatController).OnMessage,
    ); err != nil {
        log.Fatal(err)
    }

    opts := boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        HTTP: &boot.HTTPOptions{
            WebSocket: boot.WebSocketOptions{
                AllowedOrigins:   []string{"https://app.example.com"},
                MaxConnections:   1_000,
                MaxMessageBytes:  1 << 20,
                HandshakeTimeout: 10 * time.Second,
                ReadTimeout:      60 * time.Second,
                WriteTimeout:     10 * time.Second,
                PingInterval:     30 * time.Second,
            },
        },
    }

    if err := app.Run(opts); err != nil {
        log.Fatal(err)
    }
}
```

With no `AllowedOrigins`, browser requests must match both the request scheme and host. Prefer exact public origins in production. Behind a reverse proxy, set `TrustedProxyCIDRs` only to the proxy networks and configure the proxy to remove or overwrite client-supplied forwarding headers.

When capacity is exhausted, Spine rejects the request before upgrade with HTTP 503, `Retry-After`, and a `WEBSOCKET_CAPACITY_EXCEEDED` JSON error. The zero `MaxConnections` value selects the default of 1024; use `boot.UnlimitedWebSocketConnections` only when an external layer enforces a suitable limit.

## Accessing handshake data in messages

The message execution context retains an immutable snapshot of the upgrade request:

```go
func inspectRequest(ctx core.WebSocketContext) error {
    request, ok := ctx.(core.WebSocketMessageContext)
    if !ok {
        return errors.New("request snapshot unavailable")
    }
    room := request.Query("room")
    origin := request.Header("Origin")
    _ = room
    _ = origin
    return nil
}
```

Headers, queries, cookies, remote address, host, path, and request URI are available. Returned collections are defensive copies.

## See also

- [ExecutionContext API](/en/reference/api/execution-context)
- [Interceptor API](/en/reference/api/interceptor)
- [Security configuration](/en/reference/security-configuration)
