# core.ExecutionContext

::: info
입력 DTO와 기존 입력 API의 호환 규칙은 [입력 전환](/ko/learn/migration/v0.7.1-preview), 명세 옵션은 [OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

`ExecutionContext`는 인터셉터와 실행 파이프라인에서 요청 정보를 읽고 처리 단계 사이에 값을 공유하는 인터페이스입니다. HTTP 요청, 이벤트, WebSocket 메시지에 공통으로 사용하며, 전송 방식마다 별도 인터페이스로 추가 정보를 제공합니다.

```go
import "github.com/NARUBROWN/spine/core"
```

## 인터페이스 선택

HTTP 컨트롤러에서 인터셉터가 저장한 값을 읽으려면 `core.ControllerContext`를 매개변수로 선언합니다. 인터셉터에서는 `core.ExecutionContext`를 사용합니다. HTTP와 이벤트의 입력 해석에는 각각 `HttpRequestContext`와 `ConsumerRequestContext`를 사용합니다.

| 인터페이스 | 포함하는 인터페이스 | 제공하는 기능 |
| --- | --- | --- |
| `ContextCarrier` | 없음 | Go 표준 `context.Context` |
| `EventBusCarrier` | 없음 | 요청 범위의 이벤트 버스 |
| `ExecutionContext` | `ContextCarrier`, `EventBusCarrier` | 요청 메서드와 경로, 헤더와 매개변수, 값 저장과 조회 |
| `ControllerContext` | 없음 | 인터셉터가 저장한 값 조회 |
| `HttpRequestContext` | `ContextCarrier`, `EventBusCarrier` | HTTP 입력 조회, 본문 바인딩, 멀티파트 폼 |
| `ConsumerRequestContext` | `ContextCarrier`, `EventBusCarrier` | 이벤트 이름과 원시 본문 |
| `WebSocketContext` | `ExecutionContext` | 연결 ID, 메시지 타입과 원시 본문 |
| `WebSocketRequestContext` | `ContextCarrier` | 연결을 요청한 HTTP 요청 정보 |
| `WebSocketHandshakeContext` | `WebSocketRequestContext` | HTTP 업그레이드 전 인증과 인가에 사용할 요청 정보 |
| `WebSocketMessageContext` | `WebSocketContext`, `WebSocketRequestContext` | 메시지와 원래 연결 요청 정보 |

`ControllerContext`는 `ExecutionContext`를 포함하지 않으며 `Get`만 제공합니다. `HttpRequestContext`와 `ConsumerRequestContext`도 `ExecutionContext`를 포함하지 않습니다. 런타임이 제공하는 구현체가 필요한 인터페이스를 함께 구현합니다.

## 인터페이스 정의

### 기반 인터페이스

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() EventBus
}
```

`EventBus()`는 `core.EventBus`를 반환합니다. 이벤트를 수집하는 `Publish(events ...publish.DomainEvent)`와 수집한 이벤트를 꺼내는 `Drain() []publish.DomainEvent`를 제공합니다.

### ExecutionContext

```go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier

    Method() string
    Path() string
    Params() map[string]string
    Header(name string) string
    PathKeys() []string
    SetRoute(params map[string]string, pathKeys []string)
    Queries() map[string][]string
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

### ControllerContext

HTTP 컨트롤러에서 값을 읽는 전용 인터페이스입니다. 인터셉터가 `Set()`으로 저장한 값을 `Get()`으로 조회할 수 있습니다. 기본 컨슈머와 WebSocket 입력 해석기는 이 타입을 주입하지 않습니다.

```go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

### HttpRequestContext

HTTP 입력을 읽는 인터페이스입니다. `ContextCarrier`와 `EventBusCarrier`를 포함합니다.

```go
type HttpRequestContext interface {
    ContextCarrier
    EventBusCarrier

    // 개별 접근
    Param(name string) string
    Query(name string) string
    Header(name string) string

    // 전체 뷰 접근
    Params() map[string]string
    Queries() map[string][]string
    Headers() map[string][]string

    // 요청 본문
    Bind(out any) error

    // 멀티파트
    MultipartForm() (*multipart.Form, error)
}
```

### HTTPResponseContext

```go
type HTTPResponseContext interface {
    ResponseWriter() ResponseWriter
    SetResponseWriter(ResponseWriter)
}
```

`HTTPResponseContext.ResponseWriter()`는 HTTP 응답 writer를 반환합니다. 파이프라인은 응답 준비 중 writer를 staging writer로 바꾸고 전송 전에 복구합니다. 컨트롤러는 writer를 직접 꺼내기보다 `httpx.Response[T]`, `httpx.Redirect`, `httpx.Binary`를 반환합니다.

### ConsumerRequestContext

이벤트 소비자의 입력을 읽는 인터페이스입니다. `ContextCarrier`와 `EventBusCarrier`를 포함합니다.

```go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string
    Payload() []byte
}
```

### WebSocketContext

WebSocket 메시지를 읽는 인터페이스입니다. `ExecutionContext`를 포함합니다.

```go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string
    MessageType() int
    Payload() []byte
}
```

### WebSocket 연결 요청 정보 {#websocket-request-context}

v0.7.1는 HTTP 업그레이드 요청 정보를 복사해 보존합니다. 다음 인터페이스로 헤더, 쿼리, 쿠키, 원격 주소, 호스트와 요청 URI를 조회할 수 있습니다.

```go
type WebSocketRequestContext interface {
    ContextCarrier
    Path() string
    Header(name string) string
    Headers() map[string][]string
    Query(name string) string
    Queries() map[string][]string
    Cookie(name string) (string, bool)
    Cookies() map[string]string
    RemoteAddr() string
    Host() string
    RequestURI() string
}

type WebSocketHandshakeContext interface { WebSocketRequestContext }

type WebSocketMessageContext interface {
    WebSocketContext
    WebSocketRequestContext
}
```

`WebSocketHandshakeContext`는 `PreHandshake`에서 사용합니다. 메시지 처리 중에는 `ExecutionContext`를 `WebSocketMessageContext`로 타입 단언해 원래 연결 요청 정보를 읽습니다. `Headers()`, `Queries()`, `Cookies()`는 복사본을 반환하므로 반환된 맵을 바꿔도 보존된 요청 정보는 바뀌지 않습니다.

## ExecutionContext 메서드

### Context

```go
Context() context.Context
```

Go 표준 라이브러리의 `context.Context`를 반환합니다.

**반환값**

- `context.Context` - 요청 범위의 컨텍스트

**예시**

```go
func (i *TimeoutInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    select {
    case <-ctx.Context().Done():
        return ctx.Context().Err()
    default:
        return nil
    }
}
```

### EventBus

```go
EventBus() core.EventBus
```

요청 범위의 이벤트 버스를 반환합니다. 도메인 이벤트 발행에 사용됩니다.

**반환값**

- `core.EventBus` - 이벤트 버스 인스턴스

이벤트를 발행하는 컨트롤러에서는 `context.Context`를 매개변수로 받고 `publish.Event(ctx, event)`를 호출합니다. 런타임이 이벤트 버스를 표준 컨텍스트에 연결합니다. [이벤트 발행 예제](/ko/reference/api/spine-app#event-publishing)를 참고하십시오.

### Method

```go
Method() string
```

요청 메서드를 반환합니다.

**반환값**

- HTTP: `"GET"`, `"POST"`, `"PUT"`, `"DELETE"` 등
- 이벤트 소비자: `"EVENT"`
- WebSocket: `"WS"`

**예시**

```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // CORS 사전 요청 처리
    }
    return nil
}
```

### Path

```go
Path() string
```

요청 경로를 반환합니다.

**반환값**

- HTTP: 요청 경로 (예: `"/users/123"`)
- 이벤트 소비자: 이벤트 이름 (예: `"order.created"`)
- WebSocket: WebSocket 경로 (예: `"/ws/chat"`)

**예시**

```go
log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
// HTTP:      [REQ] GET /users/123
// Consumer:  [REQ] EVENT order.created
// WebSocket: [REQ] WS /ws/chat
```

### Header

```go
Header(name string) string
```

지정한 이름의 HTTP 헤더 값을 반환합니다.

**매개변수**

- `name` - 헤더 이름 (대소문자 구분 없음)

**반환값**

- `string` - 헤더 값. 없으면 빈 문자열
- 이벤트 소비자: 빈 문자열
- WebSocket: HTTP 업그레이드 요청에서 보존한 헤더 값

**예시**

```go
origin := ctx.Header("Origin")
auth := ctx.Header("Authorization")
```

### Params

```go
Params() map[string]string
```

모든 경로 매개변수를 맵으로 반환합니다.

**반환값**

- `map[string]string` - 경로 매개변수 맵
- 이벤트 소비자: `nil`
- WebSocket: 라우터가 해석한 경로 매개변수. 라우팅 전에는 빈 맵

**예시**

```go
// Route: /users/:userId/posts/:postId
// Request: /users/123/posts/456

params := ctx.Params()  // {"userId": "123", "postId": "456"}
```

### PathKeys

```go
PathKeys() []string
```

경로 매개변수 키를 선언 순서대로 반환합니다.

**반환값**

- `[]string` - 키 슬라이스
- 이벤트 소비자: `nil`
- WebSocket: 라우터가 해석한 키 순서. 라우팅 전에는 빈 슬라이스

**예시**

```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```

### SetRoute

```go
SetRoute(params map[string]string, pathKeys []string)
```

라우터가 찾은 매개변수와 키 순서를 저장합니다. 구현체는 입력을 복사하며 사용자 `Set/Get` 저장소를 사용하지 않습니다. 직접 `ExecutionContext`를 구현한 경우 이 메서드도 제공해야 합니다.

### Queries

```go
Queries() map[string][]string
```

모든 쿼리 매개변수를 맵으로 반환합니다.

**반환값**

- `map[string][]string` - 쿼리 매개변수 맵
- 이벤트 소비자: `nil`
- WebSocket: HTTP 업그레이드 요청에서 보존한 쿼리 매개변수

**예시**

```go
// Request: /users?status=active&tag=go&tag=web

queries := ctx.Queries()
// {"status": ["active"], "tag": ["go", "web"]}
```

### Set

```go
Set(key string, value any)
```

내부 저장소에 값을 저장합니다.

**매개변수**

- `key` - 저장할 키
- `value` - 저장할 값

**예시**

```go
ctx.Set("auth.user", authenticatedUser)
ctx.Set("request.startTime", time.Now())
```

### Get

```go
Get(key string) (any, bool)
```

내부 저장소에서 값을 조회합니다.

**매개변수**

- `key` - 조회할 키

**반환값**

- `any` - 저장된 값
- `bool` - 키 존재 여부

**예시**

```go
value, exists := ctx.Get("auth.user")
```

## ControllerContext

컨트롤러에서 인터셉터가 저장한 값을 읽는 인터페이스입니다.

### Get

```go
Get(key string) (any, bool)
```

`ExecutionContext.Get()`에 위임합니다. `Set()` 메서드는 제공하지 않습니다.

아래 코드는 [CLI 프로젝트](/ko/learn/tutorial/1-project-structure)의 `src/user/user_controller.go`를 확장하는 예입니다. `User`, `AuthUser`와 저장소 필드는 앱에서 정의합니다. 생성된 `user.Register(app)`와 루트 `main.go`는 유지합니다.

이 발췌에는 `core`, `input`, `httpx`, `httperr` 패키지가 필요합니다. 인증이 필수인 경우 값이 없는 경우도 거부하도록 앱의 정책을 적용하세요.

```go
func (c *UserController) GetUser(ctx core.ControllerContext, userId input.Path[int64]) (httpx.Response[User], error) {
    // 인터셉터가 Set("auth.user", ...)으로 저장한 값 조회
    if authUser, ok := ctx.Get("auth.user"); ok {
        auth, valid := authUser.(*AuthUser)
        if !valid || auth == nil {
            return httpx.Response[User]{}, httperr.Unauthorized("invalid authentication context")
        }
        _ = auth
        // ...
    }
    user, err := c.repo.FindByID(*userId)
    if err != nil {
        return httpx.Response[User]{}, err
    }
    return httpx.Response[User]{Body: user}, nil
}
```

## HttpRequestContext 메서드

HTTP 입력을 해석할 때 사용하는 추가 메서드입니다.

### Param

```go
Param(name string) string
```

특정 경로 매개변수 값을 반환합니다.

**예시**

```go
userId := ctx.Param("id")  // "123"
```

### Query

```go
Query(name string) string
```

특정 쿼리 매개변수의 첫 번째 값을 반환합니다.

**예시**

```go
page := ctx.Query("page")  // "1"
```

### Headers

```go
Headers() map[string][]string
```

모든 HTTP 헤더를 맵으로 반환합니다.

**예시**

```go
headers := ctx.Headers()
// {"Content-Type": ["application/json"], "Accept": ["text/html", "application/json"]}
```

### Bind

```go
Bind(out any) error
```

HTTP 요청 본문을 구조체에 바인딩합니다.

**예시**

HTTP v3의 코어 요청 뷰가 본문을 해석합니다. 경로와 쿼리는 본문 DTO에 합쳐지지 않으며 Echo Binder나 JSONSerializer 확장을 호출하지 않습니다.

```go
var req CreateUserRequest
if err := ctx.Bind(&req); err != nil {
    return err
}
```

### MultipartForm

```go
MultipartForm() (*multipart.Form, error)
```

멀티파트 폼 데이터에 접근합니다.

**예시**

```go
form, err := ctx.MultipartForm()
if err != nil {
    return err
}
for _, file := range form.File["upload"] {
    // 파일 처리
}
```

## ConsumerRequestContext 메서드

이벤트 입력을 해석할 때 사용하는 메서드입니다.

### EventName

```go
EventName() string
```

수신한 이벤트의 이름을 반환합니다.

**예시**

```go
name := ctx.EventName()  // "order.created"
```

### Payload

```go
Payload() []byte
```

이벤트의 원시 페이로드를 반환합니다.

**예시**

```go
payload := ctx.Payload()  // []byte (JSON)
var event OrderCreated
json.Unmarshal(payload, &event)
```

## WebSocketContext 메서드

WebSocket 입력을 해석할 때 사용하는 메서드입니다.

### ConnID

```go
ConnID() string
```

WebSocket 연결의 고유 식별자를 반환합니다.

**예시**

```go
connID := ctx.ConnID()  // "a1b2c3d4-..."
```

### MessageType

```go
MessageType() int
```

WebSocket 메시지 타입을 반환합니다.

**반환값**

- `1` - TextMessage
- `2` - BinaryMessage

**예시**

```go
if ctx.MessageType() == ws.TextMessage {
    // 텍스트 메시지 처리
}
```

### Payload

```go
Payload() []byte
```

WebSocket 메시지의 원시 페이로드를 반환합니다.

**예시**

```go
payload := ctx.Payload()  // []byte
var msg ChatMessage
json.Unmarshal(payload, &msg)
```

## 라우팅과 응답 계약

라우팅 정보와 HTTP 응답 writer는 타입이 명시된 계약으로 관리하며 사용자 `Set/Get` 저장소와 분리됩니다. 라우터는 `SetRoute`로 경로 값을 저장하고 HTTP 파이프라인은 `HTTPResponseContext`로 writer를 선택합니다.

| API | 타입 | 설명 |
|----|------|------|
| `HTTPResponseContext.ResponseWriter()` | `core.ResponseWriter` | 응답 출력 인터페이스 |
| `Params()` | `map[string]string` | 경로 매개변수 |
| `PathKeys()` | `[]string` | 경로 매개변수 키 순서 |

## 인터셉터에서 사용

`ExecutionContext`는 인터셉터의 모든 메서드에서 첫 번째 인자로 전달됩니다.

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### 로깅 예시

```go
type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

### CORS 예시

다음은 응답 출력 인터페이스에 접근하는 예입니다. `Config`와 `isAllowedOrigin`은 앱에서 정의합니다. CORS 전체 설정에는 [검증 가능한 기본 인터셉터](/ko/reference/security-configuration#cors-cookies)를 사용하십시오.

```go
type CORSInterceptor struct {
    config Config
}

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    httpCtx, ok := ctx.(core.HTTPResponseContext)
    if !ok || httpCtx.ResponseWriter() == nil {
        return nil
    }
    rw := httpCtx.ResponseWriter()

    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
        rw.SetHeader("Vary", "Origin")
    }

    if ctx.Method() == "OPTIONS" {
        if err := rw.WriteStatus(204); err != nil {
            return err
        }
        return core.ErrAbortPipeline
    }

    return nil
}
```

## 입력 해석에서 사용

입력을 해석하는 컴포넌트는 `core.ExecutionContext`를 받고 전송 방식에 맞는 인터페이스로 타입 단언합니다. 예를 들어 HTTP 경로 매개변수를 읽으려면 `core.HttpRequestContext`, 이벤트 이름을 읽으려면 `core.ConsumerRequestContext`, WebSocket 연결 ID를 읽으려면 `core.WebSocketContext`가 필요합니다. 맞는 인터페이스를 구현하지 않은 컨텍스트에서는 타입 단언이 실패합니다.

HTTP 컨트롤러의 `context.Context` 매개변수에는 표준 컨텍스트와 요청 범위의 이벤트 버스를 전달하고, `core.ControllerContext` 매개변수에는 `Get()`만 제공하는 뷰를 전달합니다. 컨슈머와 WebSocket의 기본 입력 해석기에는 `ControllerContext` 주입 기능이 없습니다. 런타임의 입력 해석 코드는 다음 소스에서 확인할 수 있습니다.

- [HTTP 경로 매개변수 해석](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/resolver/scalar_path_resolver.go)
- [표준 컨텍스트 전달](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/resolver/std_context_resolver.go)
- [컨트롤러 조회 컨텍스트 전달](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/resolver/controller_context_resolver.go)
- [이벤트 입력 해석](https://github.com/NARUBROWN/spine/tree/v0.7.1/internal/event/consumer/resolver)
- [WebSocket 입력 해석](https://github.com/NARUBROWN/spine/tree/v0.7.1/internal/ws/resolver)

## 프로토콜별 동작 차이

| 메서드 | HTTP | 이벤트 소비자 | WebSocket |
|--------|------|----------|-----------|
| `Method()` | `"GET"`, `"POST"` 등 | `"EVENT"` | `"WS"` |
| `Path()` | `/users/123` | `order.created` | `/ws/chat` |
| `Header()` | 헤더 값 | 빈 문자열 | 연결 요청의 헤더 값 |
| `Params()` | 경로 매개변수 | `nil` | 라우터가 해석한 경로 매개변수 |
| `PathKeys()` | 경로 매개변수 키 순서 | `nil` | 경로 매개변수 키 순서 |
| `Queries()` | 쿼리 매개변수 | `nil` | 연결 요청의 쿼리 매개변수 |
| `EventBus()` | EventBus | EventBus | EventBus |
| `Context()` | 요청 컨텍스트 | 이벤트 처리 컨텍스트 | 메시지 처리 컨텍스트 |

## 구현체

| 구현체 | 인터페이스 | 위치 |
|--------|-----------|------|
| `echoContext` | `ExecutionContext` + `HttpRequestContext` | `internal/adapter/echo/context_impl.go` |
| `ConsumerRequestContextImpl` | `ExecutionContext` + `ConsumerRequestContext` | `internal/event/consumer/request_context_impl.go` |
| `WSExecutionContext` | `WebSocketMessageContext` | `internal/ws/context_impl.go` |
| `controllerCtxView` | `ControllerContext` | `internal/runtime/controller_ctx.go` |

## 제약과 오류

- 전역 인터셉터의 `PreHandle`은 라우팅 전에 실행됩니다. 이 시점에는 `HandlerMeta{}`가 비어 있으므로 컨트롤러 타입이나 메서드에 바로 접근하지 마십시오. 경로 매개변수도 라우팅 이후에 읽어야 합니다.
- `Get`은 키가 없으면 `(nil, false)`를 반환합니다. 저장된 값의 타입을 확인한 뒤 사용하십시오. `ControllerContext`는 저장된 객체 자체의 변경을 막지는 않습니다.
- `Header`, `Query`는 값이 없으면 빈 문자열을 반환합니다. WebSocket의 `Cookie`는 값과 존재 여부를 함께 반환합니다.
- `Bind`와 `MultipartForm`은 본문 해석에 실패하면 오류를 반환합니다. 오류를 호출자에게 전달하고 처리를 중단하십시오.
- `spine.`으로 시작하는 예약 키는 런타임이 사용합니다. 앱이 공유하는 값에는 `auth.user`처럼 별도 이름을 사용하십시오.

## 참고

- [인터셉터](/ko/reference/api/interceptor): 인증과 로깅 등 공통 처리
- [실행 컨텍스트 개념](/ko/learn/core-concepts/execution-context) - 상세 설명
