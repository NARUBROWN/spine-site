# Interceptor API

::: info 0.7.5
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

## 실행 순서 {#order}

```text
Global PreHandle
→ Route selection
→ Route PreHandle
→ Input binding and validator
→ Handler
→ Response preparation and success hooks
→ PostHandle (reverse)
→ BeforeResponse (reverse)
→ Error rendering and response flush
→ AfterCompletion (reverse)
→ Store and multipart cleanup
```

전역과 라우트 PreHandle이 모두 본문 바인딩 전에 실행합니다. 인증 오류는 본문 파싱 전에 반환할 수 있습니다. PostHandle은 성공 후처리이며, BeforeResponse는 PreHandle이 성공한 인터셉터만 역순으로 실행합니다. 응답 준비 중 직렬화, 쿠키와 상태 검증 오류도 BeforeResponse에 전달합니다. 커밋과 롤백은 여기에서 수행하고 오류를 반환합니다. AfterCompletion은 PreHandle에 도달하지 않은 인터셉터에도 호출될 수 있으므로 자원이 있는지 확인합니다.

## 계약 {#contract}

```go
import (
	"github.com/NARUBROWN/spine/core"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type Interceptor interface {
	PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error
	PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta)
	BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error
	AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error)
}
```

## 적용 범위 {#scope}

이 사이트의 예제에서는 모든 인터셉터를 먼저 `app.Constructor`에 등록합니다. `Constructor` 메서드를 구현한 사용자 인터셉터는 `constructor.Interceptor(&Auth{})`로 등록하고, 적용할 때는 `(*Auth)(nil)`처럼 typed nil을 전달해 컨테이너에서 조회합니다. `&Auth{}`를 적용 API에 직접 전달하면 현재 구현에서는 생성자를 거치지 않은 객체가 실행되므로 사용하지 않습니다. 등록과 적용 범위 지정은 별도 단계입니다.

```go
app.Constructor(constructor.Interceptor(&AuthInterceptor{}))
app.InterceptorFor(boot.InterceptorHTTP, (*AuthInterceptor)(nil))
```

```go
app.Constructor(
	constructor.Interceptor(&AuthInterceptor{}),
	constructor.Interceptor(&AuditInterceptor{}),
)
```

```go
func (*UserController) RegisterRoutes(r *api.Registry) {
	auth := (*AuthInterceptor)(nil)
	audit := (*AuditInterceptor)(nil)
	users := r.Group("/users", api.Interceptors(auth))
	users.GET("/", func() httpx.Response[[]int64] {
		return httpx.Response[[]int64]{Body: []int64{1}}
	})
	users.DELETE("/:id", func() httpx.Response[struct{}] {
		return httpx.Response[struct{}]{Options: httpx.ResponseOptions{Status: 204}}
	}, api.Interceptors(audit))
	r.GET("/profile", func() httpx.Response[string] {
		return httpx.Response[string]{Body: "profile"}
	}, api.Interceptors(auth))
}
```

이 예제를 적용하려면 Auth와 Audit 인터셉터를 DI에 등록합니다. 같은 정책을 전역과 라우트에 중복 적용하지 마세요. 역할 등록은 DI 제공이며 적용 범위는 별도입니다. 그룹과 하위 그룹은 설정을 상속하고 라우트 옵션은 추가됩니다. 전역은 InterceptorHTTP, InterceptorWebSocket 또는 InterceptorAll로 지정하며 All과 app.Interceptor는 HTTP와 WS 메시지에 적용합니다.

## 오류와 트랜잭션 {#errors}

핸들러와 인터셉터가 함께 실패하면 HTTP 응답은 인터셉터 오류를 우선합니다. 여러 BeforeResponse가 실패하면 실행 순서상 마지막 오류가 응답을 결정하고 이전 오류도 완료 훅에 보존합니다. HTTPError는 400~599만 허용하며 일반 오류와 잘못된 상태는 내부 원문을 숨긴 500입니다. DB 커밋과 이벤트 발행 및 소켓 전송은 하나의 원자적 트랜잭션이 아닙니다.

[전체 예제](/ko/learn/tutorial/4-interceptor) | [트랜잭션](/ko/learn/tutorial/6-transaction)
