# WebSocket 消息收发

::: info 0.7.5 API
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

此独立示例向当前连接回送消息。广播需要另行设计连接生命周期和发送策略的 hub。

## 安装与代码

```sh
go mod init example.com/spine-websocket
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-gorilla-platform@v0.2.0-preview.2
```

使用 Go 1.26 以上版本保存为 main.go，分别选择 HTTP 和 Gorilla。WebSocket 消息 DTO 不使用 HTTP Body 包装。ws.Send 接收标准上下文、消息类型、[]byte 三个参数，仅发送给当前连接。不要保存请求上下文或内部 sender 键。

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

## 浏览器验证

在打开 `http://localhost:8080/health` 的标签页开发者控制台运行，收到 message: "hello" 的事件。其他标签页不会收到。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

## 认证与限制

握手认证在 WebSocketHandshakeInterceptor.PreHandshake 中执行，仅消息 PreHandle 无法保护升级。未配置 AllowedOrigins 时，含 Origin 的请求须同源，无 Origin 的客户端允许连接。生产环境配置精确 Origin、可信代理和连接限制。

## 参考

[拦截器](/zh-Hans/reference/api/interceptor) / [安全设置](/zh-Hans/reference/security-configuration)
