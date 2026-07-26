# core.Interceptor

Controller 실행 전후의 로깅, 인증, CORS, transaction 같은 횡단 관심사를 처리하는 인터페이스입니다. Spine v0.5.1은 네 단계 수명주기를 사용합니다.

```go
import "github.com/NARUBROWN/spine/core"

type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

## 수명주기

### PreHandle

Controller 호출 전에 등록 순서대로 실행됩니다. `nil`이면 계속하고, 일반 오류면 실패하며, `core.ErrAbortPipeline`이면 Controller를 호출하지 않고 정상 중단합니다. 전역 인터셉터는 routing 전에 실행되므로 빈 `HandlerMeta{}`를 받습니다.

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

반환값 준비와 post-execution hook 뒤에 역순으로 실행됩니다. 이 메서드는 오류를 반환하지 않으므로 logging이나 성공 후 관찰 작업에 적합합니다.

```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s prepared", ctx.Method(), ctx.Path())
}
```

### BeforeResponse

응답을 실제 HTTP writer로 flush하기 전에 역순으로 실행됩니다. `executionErr`에는 Controller, 반환값 준비, post-execution hook에서 발생한 최종 오류가 들어옵니다. 이 메서드가 반환한 오류도 최종 오류에 합쳐집니다.

요청 transaction의 commit/rollback은 `AfterCompletion`이 아니라 이 단계에서 처리하십시오. v0.5.1은 직렬화·쿠키·status 검증이 끝난 뒤 `BeforeResponse`를 실행하므로, 준비 실패를 보고 rollback할 수 있습니다.

```go
func (i *TxInterceptor) BeforeResponse(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    executionErr error,
) error {
    tx, ok := transactionFrom(ctx)
    if !ok {
        return nil
    }
    if executionErr != nil {
        return tx.Rollback()
    }
    return tx.Commit()
}
```

### AfterCompletion

성공과 실패에 관계없이 응답 처리 뒤에 역순으로 호출됩니다. 최종 `err`를 받아 logging, metric, 리소스 정리에 사용합니다. 이미 응답이 기록된 뒤이므로 commit 여부를 결정하는 용도로 사용하지 마십시오.

```go
func (i *LoggingInterceptor) AfterCompletion(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    err error,
) {
    if err != nil {
        log.Printf("[ERR] %s %s: %v", ctx.Method(), ctx.Path(), err)
    }
}
```

## 등록과 범위

`app.Interceptor`는 `boot.InterceptorAll`의 축약형으로 HTTP와 WebSocket message에 모두 적용됩니다. 전송 방식 가정이 있는 구현은 `InterceptorFor`로 범위를 명시하십시오.

```go
app.InterceptorFor(boot.InterceptorAll, auth)
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsRateLimiter)

app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

typed-nil 포인터를 등록하면 container에서 resolve합니다. 같은 포인터 인스턴스를 여러 scope에 등록하면 scope를 합쳐 한 번 실행합니다. 같은 타입의 서로 다른 포인터는 각각 독립 실행하고, 같은 타입의 typed-nil placeholder는 container singleton을 공유합니다. 값 타입도 등록별로 독립 실행합니다.

## WebSocket handshake

연결 인증이 필요한 인터셉터는 선택적 인터페이스도 구현하십시오.

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

연결 slot은 `PreHandshake`보다 먼저 예약되고, `PreHandshake`는 HTTP upgrade 전에 실행됩니다. 따라서 인증되지 않은 대기 handshake도 `MaxConnections`에 포함됩니다. 기존 `PreHandle`은 연결마다가 아니라 WebSocket message마다 계속 실행됩니다.

```go
func (i *AuthInterceptor) PreHandshake(
    ctx core.WebSocketHandshakeContext,
    meta core.HandlerMeta,
) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("missing credentials")
    }
    return i.verify(token)
}
```

## 실행 순서

정상 HTTP 흐름은 다음과 같습니다.

```text
Global.PreHandle → Router → ArgumentResolver → Route.PreHandle
→ Controller → 응답 준비 → PostExecutionHook
→ Route.PostHandle → Global.PostHandle
→ Route.BeforeResponse → Global.BeforeResponse
→ 실제 응답 flush
→ Route.AfterCompletion → Global.AfterCompletion
```

각 역순 단계는 등록의 역순으로 호출합니다. `PreHandle`에 성공한 인터셉터만 `BeforeResponse` 대상이며, `AfterCompletion`은 해당 요청에 등록된 인터셉터의 정리를 항상 수행합니다.

## 참고

- [실행 파이프라인](/ko/learn/core-concepts/pipeline)
- [transaction 관리](/ko/learn/tutorial/6-transaction)
- [현재 릴리스](/ko/community/changelog)
