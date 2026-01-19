# core.Interceptor

Interceptor 인터페이스에 대한 API 참조.

## 개요

`Interceptor`는 Controller 호출 전후에 횡단 관심사(cross-cutting concerns)를 처리하는 인터페이스입니다. 로깅, 인증, CORS, 트랜잭션 관리 등에 활용됩니다.

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
- `meta` - 실행할 Controller 메서드 정보

**반환값**
- `error` - 에러 반환 시 파이프라인 중단
- `nil` - 다음 단계로 진행
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

Controller 호출 및 ReturnValueHandler 처리 **후**에 실행됩니다. 역순으로 호출됩니다.

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

성공/실패와 관계없이 **항상** 마지막에 실행됩니다. 역순으로 호출됩니다. 리소스 정리, 메트릭 수집 등에 활용합니다.

**매개변수**
- `ctx` - 요청 컨텍스트
- `meta` - 실행된 Controller 메서드 정보
- `err` - 파이프라인 실행 중 발생한 에러 (없으면 `nil`)

**예시**
```go
func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

## 실행 순서

```
Interceptor A.PreHandle()
    ↓
Interceptor B.PreHandle()
    ↓
Controller 호출
    ↓
ReturnValueHandler
    ↓
Interceptor B.PostHandle()    ← 역순
    ↓
Interceptor A.PostHandle()    ← 역순
    ↓
Interceptor B.AfterCompletion()  ← 역순, 항상 실행
    ↓
Interceptor A.AfterCompletion()  ← 역순, 항상 실행
```

## 파이프라인 중단

`PreHandle`에서 `core.ErrAbortPipeline`을 반환하면 Controller 호출 없이 파이프라인을 종료합니다. 이는 에러가 아닌 정상 종료로 처리됩니다.

```go
import "github.com/NARUBROWN/spine/core"

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Preflight 요청은 Controller 호출 없이 응답
    if ctx.Method() == "OPTIONS" {
        rw, _ := ctx.Get("spine.response_writer")
        rw.(core.ResponseWriter).WriteStatus(204)
        return core.ErrAbortPipeline  // 정상 종료
    }
    return nil
}
```

## 등록

```go
app := spine.New()

app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
    }),
    &LoggingInterceptor{},
    &AuthInterceptor{},
)
```

등록 순서대로 `PreHandle`이 실행되고, 역순으로 `PostHandle`과 `AfterCompletion`이 실행됩니다.

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

## 참고

- [ExecutionContext](/docs/api/execution-context) - 요청 컨텍스트 인터페이스
- [HandlerMeta](/docs/api/handler-meta) - 핸들러 메타데이터
- [ResponseWriter](/docs/api/response-writer) - 응답 출력 인터페이스