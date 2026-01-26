# core.ExecutionContext

ExecutionContext에 대한 API 참조.


## 개요

`ExecutionContext`는 Spine 파이프라인에서 요청 정보에 접근하고, 컴포넌트 간 데이터를 공유하는 인터페이스입니다. HTTP 요청과 이벤트 메시지 모두를 처리하는 통합 실행 컨텍스트입니다.

```go
import "github.com/NARUBROWN/spine/core"
```


## 인터페이스 계층

Spine은 Context를 계층적으로 분리합니다.

```
ContextCarrier ──────┬──► RequestContext ──┬──► HttpRequestContext
                     │                     │
EventBusCarrier ─────┤                     └──► ConsumerRequestContext
                     │
                     └──► ExecutionContext
```

| 인터페이스 | 역할 | 사용 위치 |
|-----------|------|----------|
| `ContextCarrier` | Go context 전달 | 모든 곳 |
| `EventBusCarrier` | 이벤트 발행 | Controller, Consumer |
| `RequestContext` | Resolver 최소 계약 | ArgumentResolver 기반 |
| `ExecutionContext` | 실행 흐름 제어 | Router, Pipeline, Interceptor |
| `HttpRequestContext` | HTTP 입력 해석 | HTTP ArgumentResolver |
| `ConsumerRequestContext` | 이벤트 입력 해석 | Consumer ArgumentResolver |


## 인터페이스 정의

### 기반 인터페이스

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() publish.EventBus
}

type RequestContext interface {
    ContextCarrier
    EventBusCarrier
}
```

### ExecutionContext

```go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier

    Method() string
    Path() string
    Header(name string) string
    Params() map[string]string
    PathKeys() []string
    Queries() map[string][]string
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

### HttpRequestContext

HTTP 전용 확장 인터페이스입니다.

```go
type HttpRequestContext interface {
    RequestContext

    Param(name string) string
    Query(name string) string
    Params() map[string]string
    Queries() map[string][]string
    Bind(out any) error
    MultipartForm() (*multipart.Form, error)
}
```

### ConsumerRequestContext

이벤트 컨슈머 전용 확장 인터페이스입니다.

```go
type ConsumerRequestContext interface {
    RequestContext

    EventName() string
    Payload() []byte
}
```


## ExecutionContext 메서드

### Context

```go
Context() context.Context
```

Go 표준 라이브러리의 `context.Context`를 반환합니다.

**반환값**
- `context.Context` - 요청 스코프 컨텍스트

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
EventBus() publish.EventBus
```

요청 스코프의 EventBus를 반환합니다. 도메인 이벤트 발행에 사용됩니다.

**반환값**
- `publish.EventBus` - 이벤트 버스 인스턴스

**예시**
```go
// PostExecutionHook에서 이벤트 drain
func (h *EventDispatchHook) AfterExecution(ctx core.ExecutionContext, results []any, err error) {
    if err != nil {
        return
    }
    
    events := ctx.EventBus().Drain()
    if len(events) == 0 {
        return
    }
    
    h.Dispatcher.Dispatch(ctx.Context(), events)
}
```

### Method

```go
Method() string
```

요청 메서드를 반환합니다.

**반환값**
- HTTP: `"GET"`, `"POST"`, `"PUT"`, `"DELETE"` 등
- Consumer: `"EVENT"`

**예시**
```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // Preflight 요청 처리
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
- Consumer: 이벤트 이름 (예: `"order.created"`)

**예시**
```go
log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
// HTTP: [REQ] GET /users/123
// Consumer: [REQ] EVENT order.created
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
- Consumer에서는 항상 빈 문자열

**예시**
```go
origin := ctx.Header("Origin")
auth := ctx.Header("Authorization")
```


### Params

```go
Params() map[string]string
```

모든 경로 파라미터를 맵으로 반환합니다.

**반환값**
- `map[string]string` - 경로 파라미터 맵
- Consumer에서는 빈 맵

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

경로 파라미터 키를 선언 순서대로 반환합니다.

**반환값**
- `[]string` - 키 슬라이스
- Consumer에서는 빈 슬라이스

**예시**
```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```


### Queries

```go
Queries() map[string][]string
```

모든 쿼리 파라미터를 맵으로 반환합니다.

**반환값**
- `map[string][]string` - 쿼리 파라미터 맵
- Consumer에서는 빈 맵

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
if rw, ok := ctx.Get("spine.response_writer"); ok {
    responseWriter := rw.(core.ResponseWriter)
}
```


## HttpRequestContext 메서드

HTTP ArgumentResolver에서 사용되는 추가 메서드입니다.

### Param

```go
Param(name string) string
```

특정 경로 파라미터 값을 반환합니다.

**예시**
```go
userId := ctx.Param("id")  // "123"
```

### Query

```go
Query(name string) string
```

특정 쿼리 파라미터의 첫 번째 값을 반환합니다.

**예시**
```go
page := ctx.Query("page")  // "1"
```

### Bind

```go
Bind(out any) error
```

HTTP body를 구조체로 바인딩합니다.

**예시**
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

Multipart form 데이터에 접근합니다.

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

이벤트 컨슈머 ArgumentResolver에서 사용되는 메서드입니다.

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


## 예약된 키

| 키 | 타입 | 설명 |
|----|------|------|
| `spine.response_writer` | `core.ResponseWriter` | 응답 출력 인터페이스 |
| `spine.params` | `map[string]string` | 경로 파라미터 |
| `spine.pathKeys` | `[]string` | 경로 파라미터 키 순서 |


## Interceptor에서 사용

`ExecutionContext`는 Interceptor의 모든 메서드에서 첫 번째 인자로 전달됩니다.

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### 로깅 예시

```go
type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s -> %s.%s",
        ctx.Method(),
        ctx.Path(),
        meta.ControllerType.Name(),
        meta.Method.Name,
    )
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

### CORS 예시

```go
type CORSInterceptor struct {
    config Config
}

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return nil
    }
    rw := rwAny.(core.ResponseWriter)
    
    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
    }
    
    if ctx.Method() == "OPTIONS" {
        rw.WriteStatus(204)
        return core.ErrAbortPipeline
    }
    
    return nil
}
```


## ArgumentResolver에서 사용

ArgumentResolver는 `ExecutionContext`를 받고, 필요에 따라 프로토콜별 Context로 타입 단언합니다.

### HTTP Resolver 예시

```go
func (r *PathIntResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    // HttpRequestContext로 타입 단언
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("HTTP 요청 컨텍스트가 아닙니다")
    }

    raw, ok := httpCtx.Params()[parameterMeta.PathKey]
    if !ok {
        return nil, fmt.Errorf("path param을 찾을 수 없습니다: %s", parameterMeta.PathKey)
    }

    value, err := strconv.ParseInt(raw, 10, 64)
    if err != nil {
        return nil, err
    }

    return path.Int{Value: value}, nil
}
```

### Consumer Resolver 예시

```go
func (r *EventNameResolver) Resolve(ctx core.ExecutionContext, meta ParameterMeta) (any, error) {
    // ConsumerRequestContext로 타입 단언
    consumerCtx, ok := ctx.(core.ConsumerRequestContext)
    if !ok {
        return nil, fmt.Errorf("ConsumerRequestContext가 아닙니다")
    }

    return consumerCtx.EventName(), nil
}
```

### 공통 Resolver 예시

HTTP와 Consumer 모두에서 동작하는 Resolver입니다.

```go
func (r *StdContextResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    baseCtx := ctx.Context()
    bus := ctx.EventBus()
    if bus != nil {
        // EventBus를 context.Context에 주입
        return context.WithValue(baseCtx, publish.PublisherKey, bus), nil
    }
    return baseCtx, nil
}
```


## HTTP vs Consumer 동작 차이

| 메서드 | HTTP | Consumer |
|--------|------|----------|
| `Method()` | `"GET"`, `"POST"` 등 | `"EVENT"` |
| `Path()` | `/users/123` | `order.created` |
| `Header()` | 헤더 값 | 빈 문자열 |
| `Params()` | path params | 빈 맵 |
| `PathKeys()` | key 순서 | 빈 슬라이스 |
| `Queries()` | query params | 빈 맵 |
| `EventBus()` | EventBus | EventBus |
| `Context()` | 요청 context | 요청 context |


## 참고

- [Interceptor](/ko/reference/api/interceptor) - 횡단 관심사 처리
- [실행 컨텍스트 개념](/ko/learn/core-concepts/execution-context) - 상세 설명