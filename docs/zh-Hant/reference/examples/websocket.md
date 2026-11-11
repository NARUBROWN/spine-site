# WebSocket 訊息收發

此獨立範例向目前連線回送訊息。廣播須另行設計連線生命週期與傳送策略的 hub。

## 安裝與程式碼

```sh
go mod init example.com/spine-websocket
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1 github.com/NARUBROWN/spine-gorilla-platform@v0.2.0
```

使用 Go 1.26 以上版本儲存為 main.go，分別選擇 HTTP 與 Gorilla。WebSocket 訊息 DTO 不使用 HTTP Body 包裝。ws.Send 接收標準上下文、訊息型別、[]byte 三個參數，只傳送給目前連線。不要保留請求上下文或內部 sender 鍵。

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

## 瀏覽器驗證

在開啟 `http://localhost:8080/health` 的分頁開發者主控台執行，收到 message: "hello" 的事件。其他分頁不會收到。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

## 驗證與限制

握手驗證在 WebSocketHandshakeInterceptor.PreHandshake 執行，僅訊息 PreHandle 無法保護升級。未設定 AllowedOrigins 時，含 Origin 的請求須同源，無 Origin 的用戶端允許連線。正式環境設定精確 Origin、可信代理與連線限制。

## 參考

[攔截器](/zh-Hant/reference/api/interceptor) / [安全設定](/zh-Hant/reference/security-configuration)
