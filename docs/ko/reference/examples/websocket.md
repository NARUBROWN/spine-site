# CLI로 웹소켓 채팅 만들기

CLI로 WebSocket 구성 요소를 생성한 뒤 브로드캐스트 로직을 구현합니다. 한 프로세스에서 동작하는 로컬 학습 예제입니다.

## 프로젝트와 메시지 핸들러 생성

[설치와 첫 앱](/ko/learn/getting-started/first-app)에서 CLI를 설치한 뒤 아래 명령으로 프로젝트와 WebSocket 핸들러를 생성합니다.

```sh
spine new chat-app --module example.com/chat-app
cd chat-app
go mod tidy
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

생성 결과는 `src/websocket/chat/chat_message.go`, `chat_handler.go`, `module.go`입니다. `BuildApplication`에는 오류를 확인하는 `chatwebsocket.Register(app)`가 자동으로 추가됩니다. 같은 경로나 생성자를 다시 등록하지 마세요.

## 브로드캐스트 구현

생성 핸들러는 아직 구현되지 않았다는 오류를 반환합니다. `chat_handler.go` 전체를 아래 코드로 바꾸고 `errors` import와 sentinel 오류를 제거합니다. `ChatMessage`는 생성된 `chat_message.go`에 그대로 둡니다.

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

## 생성된 앱 설정 유지

`internal/application/application.go`의 `BuildApplication`에서 기존 health 등록과 `chatwebsocket.Register(app)`를 유지하고 반환 옵션을 아래처럼 설정합니다. `time` import를 추가합니다. 생성된 `main.go`의 `BuildApplication` → `Validate` → `Run`은 유지합니다.

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

## 검증하고 실행하기

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check`는 정적 계약, `verify`는 로컬 Go 검증입니다. 실제 연결과 메시지 교환은 별도로 확인합니다. 서버 실행 후 브라우저에서 `http://localhost:8080/health`를 열고, 같은 탭의 개발자 도구 콘솔에서 다음 코드를 실행합니다.

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

브로드캐스트를 받으려면 각 연결에서 먼저 메시지를 보내 sender를 등록해야 합니다. sender 목록은 프로세스 메모리에만 있고, 연결 종료는 이후 전송 실패 때 정리됩니다. 영속적인 접속 상태나 여러 서버 간 브로드캐스트를 제공하지 않습니다.

## 인증·Origin·용량

기본 예제에는 인증이 없습니다. 인증을 추가하려면 4개 `core.Interceptor` 메서드와 `core.WebSocketHandshakeInterceptor.PreHandshake`를 구현하고 `app.InterceptorFor(boot.InterceptorWebSocket, auth)`로 등록합니다. `PreHandshake`에서 자격 증명을 검증하고 오류를 반환해야 upgrade 전에 거절됩니다. 메시지의 `PreHandle`만으로 handshake를 보호할 수 없습니다.

`AllowedOrigins`를 생략하면 Origin이 있는 요청은 scheme과 host가 같아야 합니다. Origin이 없는 클라이언트는 허용됩니다. 운영 환경에서는 정확한 공개 Origin을 설정하고, 필요한 경우 신뢰할 proxy CIDR만 지정합니다. 연결 상한 초과는 HTTP 503과 `Retry-After`, `WEBSOCKET_CAPACITY_EXCEEDED`를 반환합니다.

[인터셉터 API](/ko/reference/api/interceptor) · [보안 설정](/ko/reference/security-configuration)
