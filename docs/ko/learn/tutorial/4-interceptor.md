# 인터셉터

전역과 라우트 PreHandle은 모두 입력 바인딩 전에 실행합니다. 인증에 실패하면 본문 파싱보다 401이 먼저입니다.

## 실행 예제

[컨트롤러 의존성](/ko/learn/tutorial/2-controller)

main.go를 교체합니다. 고정 토큰은 학습용입니다. constructor.Interceptor는 DI 등록, api.Interceptors는 적용 범위입니다. (*Auth)(nil)은 등록한 타입을 DI에서 해결하는 표식입니다.

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
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type Auth struct{}

func (*Auth) Constructor() *Auth { return &Auth{} }
func (*Auth) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return httperr.InternalServerError("HTTP request context unavailable")
	}
	if request.Header("Authorization") != "Bearer demo-token" {
		return httperr.Unauthorized("unauthorized")
	}
	ctx.ExecutionContext().Set("userID", "demo-user")
	return nil
}
func (*Auth) PostHandle(spinectx.Ctx, core.HandlerMeta)                  {}
func (*Auth) BeforeResponse(spinectx.Ctx, core.HandlerMeta, error) error { return nil }
func (*Auth) AfterCompletion(spinectx.Ctx, core.HandlerMeta, error)      {}

type Controller struct{}
type CreateUser struct {
	Name string `json:"name"`
}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Interceptors((*Auth)(nil)))
	users.GET("/:id", func(ctx spinectx.Ctx, id input.Path[int64]) httpx.Response[map[string]int64] {
		return httpx.Response[map[string]int64]{Body: map[string]int64{"id": *id}}
	})
	users.POST("/", func(ctx spinectx.Ctx, body input.Body[CreateUser]) httpx.Response[string] {
		return httpx.Response[string]{Body: body.Name}
	})
	r.GET("/profile", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: "profile"}
	}, api.Interceptors((*Auth)(nil)))
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Interceptor(&Auth{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
func main() {
	app, options, err := BuildApplication()
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

## 그룹과 라우트

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

이 예제를 적용하려면 Auth와 Audit 인터셉터를 DI에 등록합니다. GET /users는 Auth, DELETE /users/:id는 Auth 다음 Audit을 실행합니다. 하위 그룹은 상위 인터셉터를 상속하고 라우트 옵션은 추가됩니다. HTTP 전역은 InterceptorFor(boot.InterceptorHTTP, ...), HTTP와 WebSocket 전체는 app.Interceptor 또는 InterceptorAll입니다. 같은 인증을 중복 적용하지 않습니다.

## 요청 확인

```sh
go run .
# 다른 터미널
curl -i http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/profile
curl -i -H 'Content-Type: application/json' -d '{' http://localhost:8080/users
curl -i -H 'Authorization: Bearer demo-token' -H 'Content-Type: application/json' -d '{' http://localhost:8080/users
```

순서대로 401, 200, 200, 401, 400입니다. 손상된 본문도 인증 실패 시 401입니다.

## 수명주기

PreHandle은 등록 순서, 성공 후 PostHandle과 응답 전 BeforeResponse 및 응답 시도 후 AfterCompletion은 역순입니다. BeforeResponse는 PreHandle이 성공한 대상만 실행하며 바인딩, 핸들러, 직렬화와 응답 검증 오류를 받습니다. AfterCompletion은 PreHandle에 도달하지 않은 대상도 실행될 수 있어 자원 존재를 확인해야 합니다.

BeforeResponse 오류는 핸들러 오류보다 응답에 우선합니다. 여러 훅이 실패하면 실행 순서상 마지막 오류를 사용하며 이전 오류도 완료 훅에 전달합니다.

## 공개 컨텍스트

네 훅 모두 spine.Ctx를 받습니다. 값은 ExecutionContext().Set/Get, 표준 컨텍스트는 ExecutionContext().Context(), HTTP는 HTTPRequestContext()의 bool 확인 뒤 접근합니다. 핸들러의 직접 context.Context 주입도 호환 지원합니다.

## 다음 단계

[트랜잭션](/ko/learn/tutorial/6-transaction) / [오류 처리](/ko/learn/tutorial/7-error-handling)
