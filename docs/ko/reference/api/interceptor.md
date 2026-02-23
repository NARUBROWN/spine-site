# core.Interceptor

Interceptor 인터페이스에 대한 API 참조.

## 개요

`Interceptor`는 Controller 호출 전후에 횡단 관심사(cross-cutting concerns)를 처리하는 인터페이스입니다. 로깅, 인증, CORS, 트랜잭션 관리 등에 활용됩니다.

Spine은 **글로벌 인터셉터**와 **라우트 인터셉터** 두 가지 레벨을 지원합니다.

```go
import "github.com/NARUBROWN/spine/core"
```

## 인터페이스 정의

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

## 메서드

### PreHandle

```go
PreHandle(ctx ExecutionContext, meta HandlerMeta) error
```

Controller 호출 **전**에 실행됩니다.

**매개변수**
- `ctx` - 요청 컨텍스트
- `meta` - 실행할 Controller 메서드 정보. 글로벌 인터셉터는 라우팅 전에 실행되므로 빈 `HandlerMeta{}`가 전달됩니다.

**반환값**
- `nil` - 다음 단계로 진행
- `error` - 에러 반환 시 파이프라인 중단
- `core.ErrAbortPipeline` - 파이프라인 중단 (에러 아님, 응답 완료 상태)

**예시**
```go
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("인증이 필요합니다")
    }
    
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("유효하지 않은 토큰입니다")
    }
    
    ctx.Set("auth.user", user)
    return nil
}
```

### PostHandle

```go
PostHandle(ctx ExecutionContext, meta HandlerMeta)
```

Controller 호출 및 ReturnValueHandler 처리 **후**에 실행됩니다. 역순으로 호출됩니다. 실패해도 전체 파이프라인 실패로 만들지 않습니다.

**매개변수**
- `ctx` - 요청 컨텍스트
- `meta` - 실행된 Controller 메서드 정보

**예시**
```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}
```

### AfterCompletion

```go
AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
```

성공/실패와 관계없이 **항상** 마지막에 실행됩니다. `defer`로 보장됩니다. 역순으로 호출됩니다. 리소스 정리, 메트릭 수집 등에 활용합니다.

**매개변수**
- `ctx` - 요청 컨텍스트
- `meta` - 실행된 Controller 메서드 정보
- `err` - 파이프라인 실행 중 발생한 최종 에러 (없으면 `nil`)

**예시**
```go
func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```


## 글로벌 vs 라우트 인터셉터

### 글로벌 인터셉터

모든 요청에 적용됩니다. **라우팅 전**에 `PreHandle`이 실행됩니다.

```go
app := spine.New()

app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
    }),
    &LoggingInterceptor{},
)
```

글로벌 인터셉터의 `PreHandle`에는 아직 라우팅이 완료되지 않았으므로 빈 `HandlerMeta{}`가 전달됩니다.

### 라우트 인터셉터

특정 라우트에만 적용됩니다. **라우팅 후, Controller 호출 전**에 `PreHandle`이 실행됩니다. 실제 `HandlerMeta`가 전달됩니다.

```go
import "github.com/NARUBROWN/spine/pkg/route"

app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

### nil 포인터를 통한 Container Resolve

라우트 인터셉터를 nil 포인터로 등록하면 부트스트랩 시점에 IoC Container에서 자동으로 Resolve됩니다. 이를 통해 의존성이 있는 인터셉터를 쉽게 사용할 수 있습니다.

```go
// nil 포인터 → Container에서 Resolve
app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// 인스턴스 직접 전달
app.Route("GET", "/public/users/:id", (*UserController).GetUser,
    route.WithInterceptors(&RateLimitInterceptor{Limit: 100}),
)
```

| 등록 방식 | 동작 |
|----------|------|
| `(*AuthInterceptor)(nil)` | Container에서 Resolve (의존성 주입 가능) |
| `&RateLimitInterceptor{Limit: 100}` | 인스턴스 직접 사용 |


## 실행 순서

테스트 코드로 검증된 실제 실행 순서입니다.

### 정상 흐름

```
Global.PreHandle()
    ↓
  [Router]
    ↓
  [ArgumentResolver]
    ↓
Route.PreHandle()
    ↓
  [Controller 호출]
    ↓
  [ReturnValueHandler]
    ↓
  [PostExecutionHook]
    ↓
Route.PostHandle()        ← 역순
    ↓
Global.PostHandle()       ← 역순
    ↓
Route.AfterCompletion()   ← 역순, 항상 실행
    ↓
Global.AfterCompletion()  ← 역순, 항상 실행
```

### 라우트 인터셉터에서 중단

```
Global.PreHandle()
    ↓
  [Router]
    ↓
  [ArgumentResolver]
    ↓
Route.PreHandle() → ErrAbortPipeline
    ↓
Route.AfterCompletion()   ← 항상 실행
    ↓
Global.AfterCompletion()  ← 항상 실행
```

Controller, PostHandle은 호출되지 않지만, `AfterCompletion`은 항상 보장됩니다.

### 글로벌 인터셉터에서 중단

```
Global.PreHandle() → ErrAbortPipeline
    ↓
Global.AfterCompletion()  ← 항상 실행
```

Router도 호출되지 않으므로 라우트 인터셉터도 실행되지 않습니다.


## 파이프라인 중단

`PreHandle`에서 `core.ErrAbortPipeline`을 반환하면 Controller 호출 없이 파이프라인을 종료합니다. 이는 에러가 아닌 정상 종료로 처리됩니다.

```go
import "github.com/NARUBROWN/spine/core"

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return nil
    }
    rw := rwAny.(core.ResponseWriter)
    
    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
        rw.SetHeader("Vary", "Origin")
    }
    
    // Preflight 요청은 Controller 호출 없이 응답
    if ctx.Method() == "OPTIONS" {
        rw.WriteStatus(204)
        return core.ErrAbortPipeline  // 정상 종료
    }
    return nil
}
```


## 부트스트랩에서의 인터셉터 처리

### 글로벌 인터셉터 중복 제거

같은 타입의 글로벌 인터셉터가 여러 번 등록되면, 최초 등록만 유지됩니다.

```go
// internal/bootstrap/bootstrap.go
seen := make(map[reflect.Type]struct{})
ordered := make([]core.Interceptor, 0, len(config.Interceptors))
for _, interceptor := range config.Interceptors {
    t := reflect.TypeOf(interceptor)
    if _, ok := seen[t]; ok {
        continue  // 중복 타입 무시
    }
    seen[t] = struct{}{}
    ordered = append(ordered, interceptor)
}
```

### 글로벌 인터셉터 nil 포인터 Resolve

글로벌 인터셉터도 nil 포인터로 등록하면 Container에서 Resolve됩니다.

```go
app.Interceptor((*LoggingInterceptor)(nil))  // Container에서 Resolve
```


## 구현 예시

### 로깅 Interceptor

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

### 요청 시간 측정

```go
type TimingInterceptor struct{}

func (i *TimingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    ctx.Set("timing.start", time.Now())
    return nil
}

func (i *TimingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TimingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if start, ok := ctx.Get("timing.start"); ok {
        elapsed := time.Since(start.(time.Time))
        log.Printf("[TIMING] %s %s took %v", ctx.Method(), ctx.Path(), elapsed)
    }
}
```

### 인증 Interceptor (라우트 레벨)

```go
type AuthInterceptor struct {
    auth *AuthService  // Container에서 주입
}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("인증이 필요합니다")
    }
    
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("유효하지 않은 토큰입니다")
    }
    
    ctx.Set("auth.user", user)
    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```

라우트에 적용:

```go
// nil 포인터로 등록 → Container에서 AuthService 의존성과 함께 Resolve
app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```


## 요약

| 구분 | 글로벌 인터셉터 | 라우트 인터셉터 |
|------|---------------|---------------|
| 등록 | `app.Interceptor()` | `route.WithInterceptors()` |
| 적용 범위 | 모든 요청 | 특정 라우트만 |
| PreHandle 시점 | 라우팅 **전** | 라우팅 **후** |
| meta 내용 | 빈 `HandlerMeta{}` | 실제 `HandlerMeta` |
| nil 포인터 | Container Resolve 지원 | Container Resolve 지원 |
| 중복 제거 | 같은 타입 최초 등록만 유지 | 해당 없음 |


## 참고

- [ExecutionContext](/ko/reference/api/execution-context) - 요청 컨텍스트 인터페이스
- [HandlerMeta](/ko/learn/core-concepts/handler-meta) - 핸들러 메타데이터
- ResponseWriter - 응답 출력 인터페이스