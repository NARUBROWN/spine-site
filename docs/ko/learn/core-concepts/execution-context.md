# 실행 컨텍스트

::: info 0.7.5
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

## 공통 진입점 {#public-context}

핸들러와 인터셉터는 `github.com/NARUBROWN/spine/pkg/spine.Ctx`를 받습니다. 루트 앱 패키지와 함께 가져오면 `spinectx` 별칭을 사용합니다. 서비스와 저장소에는 `ctx.ExecutionContext().Context()`로 얻은 표준 Go context를 전달합니다. 직접 context.Context를 주입하는 기존 핸들러는 호환 지원합니다.

```go
import spinectx "github.com/NARUBROWN/spine/pkg/spine"

func readRequest(ctx spinectx.Ctx) {
	execution := ctx.ExecutionContext()
	execution.Set("userID", "alice")
	value, exists := execution.Get("userID")
	goContext := execution.Context()
	request, supported := ctx.HTTPRequestContext()
	if supported {
		_ = request.Header("Authorization")
	}
	_, _, _ = value, exists, goContext
}
```

## 공개 계약 {#contract}

```go
type Ctx interface {
	ExecutionContext() ExecutionContextView
	HTTPRequestContext() (HTTPRequestView, bool)
	HTTPResponseContext() (HTTPResponseView, bool)
	WebSocket() (WebSocketView, bool)
	Get(key string) (any, bool) // Deprecated
}
type ExecutionContextView interface {
	Context() context.Context
	Get(key string) (any, bool)
	Set(key string, value any)
}
```

## 전송별 조회 {#views}

| 조회 | 제공하는 기능 |
| --- | --- |
| `ExecutionContext()` | Go context, 실행별 Get/Set |
| `HTTPRequestContext()` | Method, Path, Param, Query, Header, MultipartForm |
| `HTTPResponseContext()` | SetHeader, AddHeader, IsCommitted, WriteStatus/JSON/String/Bytes |
| `WebSocket()` | handshake 요청, ConnID, MessageType, Payload |

전송별 getter는 지원하지 않으면 nil, false를 반환합니다. HTTP 실행은 HTTP 요청과 응답 뷰, WS handshake와 메시지는 WS 뷰를 제공합니다. 이벤트 실행에서 HTTP/WS 뷰를 가정하지 않습니다. Payload와 multipart 헤더는 사본입니다.

<span id="event-publishing"></span>

## 수명과 이전 코드 {#lifetime}

저장소는 요청 또는 메시지마다 독립적이며 같은 실행의 훅과 핸들러가 공유합니다. 모든 AfterCompletion 뒤 참조를 해제하며, 이후 Get은 nil, false이고 Set은 무동작입니다. 실행 종료가 Go context 취소를 뜻하지는 않습니다. WS handshake와 이후 메시지는 저장소를 공유하지 않습니다. 내부 writer 교체, Bind, SetRoute, EventBus와 SenderKey 접근은 공개 계약이 아닙니다. 이벤트 발행은 `publish.Event(ctx.ExecutionContext().Context(), event)`, WS 송신은 `ws.Send(ctx.ExecutionContext().Context(), ws.TextMessage, data)`를 사용합니다. DTO의 기본 HTTP 입력은 입력 래퍼로 받습니다.

[입력과 DTO](/ko/learn/tutorial/2-controller) | [인터셉터](/ko/learn/tutorial/4-interceptor)

## WebSocket 요청 뷰 {#websocket-request-context}

handshake의 PreHandshake와 메시지 훅은 모두 spine.Ctx를 받습니다. request, ok := ctx.WebSocket()으로 지원 여부를 확인하고 request.Header나 Cookie를 읽습니다. handshake의 ConnID는 빈 값이고 메시지 종류와 payload는 아직 없습니다. HTTPRequestContext()가 있다고 가정하지 않습니다. handshake와 각 메시지의 Set/Get 저장소는 별개입니다.

```go
type WebSocketRequestView interface {
	Context() context.Context
	Path() string
	Header(string) string
	Headers() map[string][]string
	Query(string) string
	Queries() map[string][]string
	Cookie(string) (string, bool)
	Cookies() map[string]string
	RemoteAddr() string
	Host() string
	RequestURI() string
}
type WebSocketView interface {
	WebSocketRequestView
	ConnID() string
	MessageType() int
	Payload() []byte
}
```
