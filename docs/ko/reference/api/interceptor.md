# core.Interceptor

컨트롤러 실행 전후에 인증, 로깅, CORS와 트랜잭션 처리를 추가하는 인터페이스입니다. Spine v0.7.1에서는 사전 처리, 성공 후 처리, 응답 전 처리와 최종 정리를 각각 구현합니다.

## 인터페이스

```go
import "github.com/NARUBROWN/spine/core"

type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| 메서드 | 호출 시점 | 반환값 |
| --- | --- | --- |
| `PreHandle` | 컨트롤러 실행 전. 등록 순서 | `nil`이면 계속, 오류면 중단 |
| `PostHandle` | 컨트롤러, 응답 준비와 실행 후 훅이 성공한 뒤. 등록 역순 | 없음 |
| `BeforeResponse` | 실제 응답 기록 전. `PreHandle`에 성공한 인터셉터를 역순으로 실행 | 오류가 있으면 최종 실행 오류에 포함 |
| `AfterCompletion` | 응답 처리 후. 성공과 실패에 관계없이 등록 역순 | 없음 |

## 수명주기와 구현 예

다음 예의 `auth`, `transactionFrom`과 트랜잭션 구현은 앱에서 제공합니다. 네 메서드의 시그니처를 모두 구현해야 `core.Interceptor`로 등록할 수 있습니다.

### PreHandle

컨트롤러 호출 전에 등록 순서대로 실행합니다. `nil`을 반환하면 다음 단계로 진행하고, 일반 오류를 반환하면 실패합니다. `core.ErrAbortPipeline`을 반환하면 컨트롤러를 호출하지 않고 정상 중단합니다.

전역 인터셉터는 라우팅 전에 실행하므로 빈 `HandlerMeta{}`를 받습니다. 라우트 인터셉터는 라우팅과 입력값 해석 후에 실행하며 해당 핸들러의 정보를 받습니다.

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

컨트롤러의 반환값을 응답으로 준비하고 실행 후 훅까지 성공한 뒤 역순으로 실행합니다. 오류를 반환할 수 없으므로 성공 로그나 관찰용 처리에 사용합니다.

```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s prepared", ctx.Method(), ctx.Path())
}
```

### BeforeResponse

응답을 실제 전송 계층에 기록하기 전에 역순으로 실행합니다. `executionErr`에는 사전 처리, 라우팅, 입력값 해석, 컨트롤러, 응답 준비와 실행 후 훅에서 이 시점까지 발생한 오류가 전달됩니다. 앞서 실행한 `BeforeResponse`가 반환한 오류도 합쳐 다음 인터셉터에 전달합니다.

요청 범위의 트랜잭션은 이 단계에서 커밋하거나 롤백하십시오. v0.7.1는 응답 직렬화, 쿠키와 상태 코드 검증을 먼저 수행하므로 응답 준비에 실패하면 롤백할 수 있습니다.

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

성공과 실패에 관계없이 응답 처리 뒤에 역순으로 호출합니다. 최종 `err`를 받아 로그 기록, 지표 수집과 자원 정리에 사용합니다. 응답 전송 결과도 이 단계에서 확인할 수 있습니다. 트랜잭션의 커밋 여부는 이미 앞 단계에서 결정했어야 합니다.

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

`app.Interceptor`는 `app.InterceptorFor(boot.InterceptorAll, ...)`과 같습니다. HTTP 요청과 WebSocket 메시지에 모두 적용하며 이벤트 소비자에는 적용하지 않습니다. HTTP 응답을 다루는 CORS처럼 특정 전송 방식에 의존한다면 범위를 지정하십시오.

| 범위 | 적용 대상 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP 요청 |
| `boot.InterceptorWebSocket` | WebSocket 메시지와 선택적 연결 전 처리 |
| `boot.InterceptorAll` | 두 범위 모두 |

새 컨트롤러의 라우트 인터셉터는 `RegisterRoutes`에서 `api.Interceptors`로 지정합니다. 예제의 `r`은 `*api.Registry`, `handler`는 앱이 정의한 핸들러입니다. DI를 사용할 때는 인터셉터 생성자도 등록해야 합니다. [전체 실행 예제](/ko/learn/tutorial/4-interceptor)를 참고하세요.

```go
app.InterceptorFor(boot.InterceptorAll, auth)
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsRateLimiter)

r.GET("/admin/users/:id", handler,
    api.Interceptors((*AuthInterceptor)(nil)),
)
```

`(*AuthInterceptor)(nil)`처럼 타입이 있는 nil 포인터를 등록하면 컨테이너에서 해당 타입의 인스턴스를 찾아 사용합니다. 같은 타입의 nil 포인터는 컨테이너의 공유 인스턴스를 사용합니다.

전역 인터셉터에 같은 포인터를 여러 범위로 등록하면 범위를 합쳐 한 번 실행합니다. 같은 타입이어도 서로 다른 포인터는 각각 실행합니다. 값 타입도 등록한 항목마다 각각 실행합니다.

### DI로 라우트 인터셉터 등록

다음 독립 앱은 `constructor.Interceptor`로 생성 계약을 등록하고, `api.Interceptors`에 타입이 있는 nil 포인터를 전달합니다. Spine `v0.7.1`과 호환 Echo 플랫폼이 있는 별도 Go 모듈에서 실행하세요. 토큰은 데모 전용입니다.

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/core"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	"log"
)

type Auth struct{}

func (*Auth) Constructor() *Auth { return &Auth{} }

func (*Auth) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
	if ctx.Header("Authorization") != "Bearer demo-token" {
		return httperr.Unauthorized("unauthorized")
	}
	return nil
}
func (*Auth) PostHandle(core.ExecutionContext, core.HandlerMeta)                  {}
func (*Auth) BeforeResponse(core.ExecutionContext, core.HandlerMeta, error) error { return nil }
func (*Auth) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error)      {}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/users/:id", func(id input.Path[int64]) httpx.Response[map[string]int64] {
		return httpx.Response[map[string]int64]{Body: map[string]int64{"id": *id}}
	}, api.Interceptors((*Auth)(nil)))
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Interceptor(&Auth{}))
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

인증 없이 요청하면 401, 데모 토큰을 보내면 200과 사용자 ID를 반환합니다.

```bash
curl -i http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/users/1
```

## WebSocket 연결 전 처리

연결 인증이 필요한 인터셉터는 `core.Interceptor`에 더해 다음 선택적 인터페이스도 구현합니다.

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

연결 자리를 먼저 예약한 뒤 HTTP 업그레이드 전에 `PreHandshake`를 실행합니다. 따라서 인증을 기다리는 연결 요청도 `MaxConnections`에 포함합니다. `PreHandle`은 연결마다가 아니라 WebSocket 메시지마다 계속 실행합니다. 요청의 헤더, 쿼리와 쿠키 등은 [`WebSocketHandshakeContext`](/ko/reference/api/execution-context#websocket-request-context)로 읽습니다.

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
→ 컨트롤러 → 응답 준비 → 실행 후 훅
→ Route.PostHandle → Global.PostHandle
→ Route.BeforeResponse → Global.BeforeResponse
→ 실제 응답 기록
→ Route.AfterCompletion → Global.AfterCompletion
```

각 역순 단계는 라우트 인터셉터부터 실행하고 전역 인터셉터로 이어집니다. 라우팅이 끝난 이후의 호출은 해석된 `HandlerMeta`를 받습니다.

## 제약과 오류

- `BeforeResponse`는 `PreHandle`이 `nil`을 반환한 인터셉터만 호출합니다. 오류나 `core.ErrAbortPipeline`을 반환한 인터셉터는 이 대상에 포함하지 않습니다.
- `AfterCompletion`은 전역 인터셉터와 라우팅으로 확인한 라우트 인터셉터에 대해 실행합니다. 해당 인터셉터의 `PreHandle`이 실행되지 않았어도 호출될 수 있으므로 자원 존재 여부를 확인한 뒤 정리하십시오.
- 라우트 인터셉터의 인증은 입력값 해석보다 뒤에 실행합니다. 입력값 해석 전에 인증해야 한다면 전역 인터셉터를 사용하십시오.
- `core.ErrAbortPipeline`으로 중단할 때는 인터셉터가 필요한 응답을 준비해야 합니다. 컨트롤러와 이후 성공 처리 단계는 실행하지 않습니다.
- DB 커밋 뒤 실제 응답 전송이 실패할 수 있습니다. `BeforeResponse`는 DB와 네트워크 전송을 원자적으로 묶지 않습니다.

구체적인 조기 종료와 오류 전파는 [v0.7.1 파이프라인 구현](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/pipeline/pipeline.go), 연결 전 처리 순서는 [WebSocket 런타임 구현](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/ws/runtime.go)을 참고하십시오.

## 참고

- [실행 파이프라인](/ko/learn/core-concepts/pipeline)
- [트랜잭션 관리](/ko/learn/tutorial/6-transaction)
- [현재 릴리스](/ko/community/changelog)
