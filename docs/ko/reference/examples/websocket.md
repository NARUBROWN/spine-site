# WebSocket 채팅 만들기

`/ws/chat`으로 받은 메시지를 등록된 클라이언트에 브로드캐스트하는 채팅 서버를 만듭니다. CLI로 WebSocket 구성 요소를 생성하고, 핸들러를 구현한 뒤 브라우저에서 메시지 송수신을 확인합니다.

## 시작 전 준비

[설치와 첫 앱](/ko/learn/getting-started/first-app)을 먼저 완료하세요. 이 예제는 한 서버 프로세스에서 동작하는 로컬 학습용 코드입니다. 인증이나 여러 서버 사이의 브로드캐스트는 포함하지 않습니다.

## 1. 프로젝트와 메시지 핸들러 생성

프로젝트와 WebSocket 핸들러를 생성합니다. 이후 명령은 `chat-app/`에서 실행합니다.

```sh
spine new chat-app --module example.com/chat-app
cd chat-app
go mod tidy
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

`src/websocket/chat/`에 `chat_message.go`, `chat_handler.go`, `module.go`가 생성됩니다. `BuildApplication`에는 `chatwebsocket.Register(app)` 호출과 오류 확인 코드가 자동으로 추가됩니다. 같은 경로나 생성자를 다시 등록하지 마세요.

## 2. 브로드캐스트 핸들러 구현

생성된 핸들러는 미구현 오류를 반환합니다. `src/websocket/chat/chat_handler.go` 전체를 아래 코드로 교체합니다. 전체를 교체하면 기존 `errors` 가져오기와 미구현 오류 선언도 제거됩니다. `chat_message.go`의 `ChatMessage`와 `module.go`는 그대로 사용합니다.

핸들러는 메시지를 보낸 연결의 송신기를 등록한 뒤, 비어 있지 않은 메시지를 등록된 모든 연결에 전달합니다. 전송에 실패한 연결은 목록에서 제거합니다.

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

## 3. WebSocket 실행 옵션 설정

`internal/application/application.go`의 `BuildApplication`에서 반환하는 옵션만 아래 코드로 바꾸고 `time`을 가져오도록 추가합니다. 기존 health 등록과 `chatwebsocket.Register(app)` 호출은 유지합니다. 생성된 루트 `main.go`는 `BuildApplication`, `Validate`, `Run`을 순서대로 실행합니다.

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

## 4. 검증하고 서버 실행

프로젝트 루트에서 코드를 검사하고 AsyncAPI 문서를 내보낸 뒤 서버를 실행합니다.

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check`는 정적 계약을 검사합니다. `verify`는 정적 계약과 gofmt, go vet, Go 테스트를 검사합니다. `contract export`는 등록된 WebSocket 계약을 `asyncapi.json`에 기록합니다. 실제 연결과 메시지 교환은 다음 단계에서 확인합니다.

## 5. 브라우저에서 메시지 송수신 확인

서버 실행 후 브라우저에서 `http://localhost:8080/health`를 엽니다. 같은 탭의 개발자 도구 콘솔에서 다음 코드를 실행합니다.

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

콘솔에 `type`, `from`, `message`, `at` 필드가 있는 객체가 출력되는지 확인합니다. `message` 값은 `hello`입니다. 다른 탭에서도 같은 코드를 실행하면 이미 등록된 연결과 새 연결에서 메시지를 받을 수 있습니다.

브로드캐스트를 받으려면 각 연결에서 먼저 메시지를 보내 송신기를 등록해야 합니다. 송신기 목록은 프로세스 메모리에만 저장되며, 종료된 연결은 이후 전송 실패 시점에 정리됩니다. 접속 상태를 영속적으로 저장하거나 여러 서버 사이에 공유하려면 별도 구현이 필요합니다.

## 운영에 적용하기 전 확인할 점

### 핸드셰이크 인증

인증을 추가하려면 `core.Interceptor`의 네 메서드와 `core.WebSocketHandshakeInterceptor.PreHandshake`를 구현하고 `app.InterceptorFor(boot.InterceptorWebSocket, auth)`로 등록합니다. `PreHandshake`에서 자격 증명을 검증하고 오류를 반환하면 WebSocket 연결로 전환하기 전에 요청을 거절할 수 있습니다. 메시지 처리 단계의 `PreHandle`만으로는 핸드셰이크를 보호할 수 없습니다.

### Origin과 연결 수 제한

`AllowedOrigins`를 생략하면 Origin이 있는 요청은 스킴과 호스트가 같아야 합니다. Origin이 없는 클라이언트는 허용됩니다. 운영 환경에서는 정확한 공개 Origin을 설정하고, 필요한 경우 신뢰할 프록시의 CIDR만 지정합니다. 연결 수 상한을 넘으면 HTTP 503과 `Retry-After`, `WEBSOCKET_CAPACITY_EXCEEDED`가 반환됩니다.

## 다음 단계

[인터셉터 API](/ko/reference/api/interceptor)에서 인증 구현에 필요한 메서드를 확인하고, [보안 설정](/ko/reference/security-configuration)에서 Origin과 연결 제한을 검토하세요.
