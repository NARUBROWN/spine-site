# WebSocket メッセージ送受信

現在の接続にメッセージを返す独立例です。配信には接続寿命と送信方針を持つ別のハブを設計します。

## インストールとコード

```sh
go mod init example.com/spine-websocket
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1 github.com/NARUBROWN/spine-gorilla-platform@v0.2.0
```

Go 1.26 以降で main.go に保存します。HTTP と Gorilla は別に選びます。WebSocket DTO に HTTP Body ラッパーは使いません。ws.Send は標準コンテキスト、メッセージ種別、[]byte の三引数で、現在の接続に送ります。リクエストコンテキストや内部 sender キーを保持しません。

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

## ブラウザー確認

`http://localhost:8080/health` で開いたタブの開発者コンソールで実行します。message: "hello" のイベントが表示されます。ほかのタブには送りません。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

## 認証と制限

ハンドシェイク認証は WebSocketHandshakeInterceptor.PreHandshake で行います。メッセージの PreHandle だけでは upgrade を保護できません。AllowedOrigins がない場合、Origin 付きは同一生成元が必要で、Origin なしは許可します。運用では正確な Origin、信頼プロキシ、接続制限を設定します。

## 参照

[インターセプター](/ja/reference/api/interceptor) / [セキュリティ設定](/ja/reference/security-configuration)
