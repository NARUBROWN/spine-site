# 创建 WebSocket 聊天

创建聊天服务器，将通过 `/ws/chat` 收到的消息广播给已注册的客户端。使用 CLI 生成 WebSocket 组件，实现处理器，然后在浏览器中确认消息收发。

## 开始前的准备

请先完成[安装和首个应用](/zh-Hans/learn/getting-started/first-app)。本示例是在单个服务器进程中运行的本地学习代码，不包含认证或多台服务器之间的广播。

## 1. 创建项目和消息处理器

创建项目和 WebSocket 处理器。后续命令均在 `chat-app/` 中运行。

```sh
spine-cli new chat-app --layout legacy --module example.com/chat-app
cd chat-app
spine-cli doctor
spine-cli generate websocket chat --path /ws/chat --field message:string
```

`src/websocket/chat/` 下会生成 `chat_message.go`、`chat_handler.go` 和 `module.go`。`BuildApplication` 中会自动添加 `chatwebsocket.Register(app)` 调用和错误检查代码。请勿重复注册相同路径或构造函数。

## 2. 实现广播处理器

生成的处理器会返回未实现错误。将 `src/websocket/chat/chat_handler.go` 的全部内容替换为下方代码。完整替换后，原有的 `errors` 导入和未实现错误声明也会移除。继续使用 `chat_message.go` 中的 `ChatMessage` 和 `module.go`。

处理器先注册发送消息的连接所使用的发送器，再将非空消息传递给所有已注册的连接。发送失败的连接会从列表中移除。

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

## 3. 设置 WebSocket 运行选项

仅将 `internal/application/application.go` 中 `BuildApplication` 返回的选项替换为下方代码，并添加 `time` 导入。保留现有的 health 注册和 `chatwebsocket.Register(app)` 调用。生成的根目录 `main.go` 会依次执行 `BuildApplication`、`Validate` 和 `Run`。

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

## 4. 验证并启动服务器

在项目根目录中检查代码，导出 AsyncAPI 文档，然后启动服务器。

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine-cli contract check
spine-cli verify
spine-cli contract export --format asyncapi --output asyncapi.json
spine-cli dev
```

`contract check` 检查静态契约。`verify` 检查静态契约，并运行 gofmt、go vet 和 Go 测试。`contract export` 将已注册的 WebSocket 契约写入 `asyncapi.json`。下一步会确认实际连接和消息交换。

## 5. 在浏览器中确认消息收发

启动服务器后，在浏览器中打开 `http://localhost:8080/health`。在同一标签页的开发者工具控制台中运行以下代码。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

确认控制台输出包含 `type`、`from`、`message` 和 `at` 字段的对象。`message` 的值为 `hello`。在另一个标签页中运行相同代码后，已注册的连接和新连接都能收到消息。

要接收广播，每个连接都必须先发送一条消息来注册发送器。发送器列表仅保存在进程内存中，已关闭的连接会在后续发送失败时清理。如果需要持久化保存连接状态，或在多台服务器之间共享状态，需要另外实现。

## 应用于生产环境前需要检查的事项

### 握手认证

要添加认证，请实现 `core.Interceptor` 的四个方法以及 `core.WebSocketHandshakeInterceptor.PreHandshake`，并通过 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 注册。在 `PreHandshake` 中验证凭据并返回错误，即可在升级为 WebSocket 连接前拒绝请求。仅靠消息处理阶段的 `PreHandle` 无法保护握手。

### Origin 和连接数限制

如果省略 `AllowedOrigins`，带有 Origin 的请求必须使用相同的协议和主机。不带 Origin 的客户端则会被允许。在生产环境中，请设置准确的公开 Origin，并在需要时仅指定可信代理的 CIDR。超过连接数上限时，会返回 HTTP 503、`Retry-After` 和 `WEBSOCKET_CAPACITY_EXCEEDED`。

## 后续步骤

请在[拦截器 API](/zh-Hans/reference/api/interceptor)中查看实现认证所需的方法，并在[安全配置](/zh-Hans/reference/security-configuration)中检查 Origin 和连接限制。
