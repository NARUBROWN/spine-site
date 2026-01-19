# core.ExecutionContext

ExecutionContext에 대한 API 참조.


## 개요

`ExecutionContext`는 Spine 파이프라인에서 HTTP 요청 정보에 접근하고, 컴포넌트 간 데이터를 공유하는 인터페이스입니다. 사용자는 Interceptor를 구현할 때 이 인터페이스를 사용합니다.

```go
import "github.com/NARUBROWN/spine/core"
```


## 인터페이스 정의

```go
type ExecutionContext interface {
    Context() context.Context
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

## 메서드

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

### Method

```go
Method() string
```

HTTP 요청 메서드를 반환합니다.

**반환값**
- `string` - `"GET"`, `"POST"`, `"PUT"`, `"DELETE"` 등

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

HTTP 요청 경로를 반환합니다. 쿼리 스트링은 포함되지 않습니다.

**반환값**
- `string` - 요청 경로 (예: `"/users/123"`)

**예시**
```go
log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
// [REQ] GET /users/123
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


## 참고

- [Interceptor](/docs/concepts/interceptor) - 횡단 관심사 처리
- [core.ResponseWriter](/docs/api/response-writer) - 응답 출력 인터페이스