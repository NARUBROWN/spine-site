# 使用CLI创建WebSocket聊天应用

先生成WebSocket组件，再实现广播逻辑。这是单进程运行的本地学习示例。

## 生成项目与处理器

先按照[安装与第一个应用](/zh-Hans/learn/getting-started/first-app)安装 CLI，再使用以下命令生成项目和 WebSocket 处理器。

```sh
spine new chat-app --module example.com/chat-app
cd chat-app
go mod tidy
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

生成文件为 `src/websocket/chat/chat_message.go`、`chat_handler.go` 和 `module.go`。CLI会在 `BuildApplication` 中自动加入检查错误的 `chatwebsocket.Register(app)`。不要重复注册路径或构造函数。

## 实现广播

生成的处理器会返回未实现错误。将整个 `chat_handler.go` 替换为以下代码，移除 `errors` 导入及未实现错误。保留生成的 `chat_message.go` 中的 `ChatMessage`。

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

## 保留生成的组装结构

保留 `internal/application/application.go` 中 `BuildApplication` 的health注册和 `chatwebsocket.Register(app)`，将返回的选项改为以下内容并添加 `time` 导入。保留生成的 `main.go` 中 `BuildApplication` → `Validate` → `Run` 的顺序。

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

## 验证并运行

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check` 检查静态契约，`verify` 运行本地Go检查。实际连接与消息交换需要单独验证。启动服务器后，在浏览器打开 `http://localhost:8080/health`，并在该标签页的开发者控制台执行以下代码。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

每个连接必须先发送消息才能加入sender列表。列表只存在于当前进程内存中，失效sender在后续发送失败时才会清理。示例不提供持久在线状态或跨服务器广播。

## 认证、Origin与容量

基本示例没有认证。要添加认证，请实现全部4个 `core.Interceptor` 方法及 `core.WebSocketHandshakeInterceptor.PreHandshake`，并通过 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 注册。在 `PreHandshake` 验证凭据并返回错误，才能在upgrade前拒绝请求。消息级 `PreHandle` 无法单独保护handshake。

省略 `AllowedOrigins` 时，带Origin的请求必须同时匹配scheme和host；无Origin客户端允许连接。生产环境应指定准确的公开Origin，仅信任必要的proxy CIDR。容量耗尽返回HTTP 503、`Retry-After` 与 `WEBSOCKET_CAPACITY_EXCEEDED`。

[拦截器API](/zh-Hans/reference/api/interceptor) · [安全配置](/zh-Hans/reference/security-configuration)
