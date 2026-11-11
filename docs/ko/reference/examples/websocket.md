# WebSocket 메시지 송수신

현재 연결로 메시지를 돌려주는 독립 예제입니다. 다른 연결에 방송하려면 별도의 연결 수명과 송신 정책을 가진 허브를 설계합니다.

## 설치와 코드

```sh
go mod init example.com/spine-websocket
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1 github.com/NARUBROWN/spine-gorilla-platform@v0.2.0
```

Go 1.26 이상에서 main.go로 저장합니다. HTTP와 Gorilla를 따로 선택합니다. WebSocket 메시지 DTO는 HTTP Body 래퍼 없이 받습니다. ws.Send는 표준 컨텍스트, 메시지 종류, []byte 세 인자를 받으며 현재 연결에만 보냅니다. 요청 컨텍스트나 내부 sender 키를 보관하지 않습니다.

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

## 브라우저 확인

`http://localhost:8080/health`에서 열린 탭의 개발자 콘솔에서 실행합니다. 콘솔에 message: "hello"가 있는 이벤트가 출력됩니다. 다른 탭에는 전송하지 않습니다.

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

## 인증과 제한

핸드셰이크 인증은 WebSocketHandshakeInterceptor.PreHandshake에서 수행합니다. 메시지 PreHandle만으로 업그레이드를 보호하지 못합니다. AllowedOrigins가 없으면 Origin이 있는 요청은 동일 출처가 필요하며 Origin 없는 클라이언트는 허용합니다. 운영에서는 정확한 Origin, 신뢰 프록시와 연결 제한을 설정합니다.

## 참조

[인터셉터](/ko/reference/api/interceptor) / [보안 설정](/ko/reference/security-configuration)
