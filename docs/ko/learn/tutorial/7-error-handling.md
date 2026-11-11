# 오류 처리와 입력 검증

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

자동 태그 검증과 직접 작성한 규칙을 구분합니다. 이 독립 앱은 데이터를 저장하지 않습니다.

## 검증기 조립

[컨트롤러 의존성](/ko/learn/tutorial/2-controller)

```sh
go get github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
```

engine은 playground.New()의 반환값을 담는 변수입니다. BuildApplication에서 한 번 생성해 spine.WithValidator(engine)에 전달합니다. playground는 런타임 검증과 OpenAPI SchemaDescriber를 구현합니다. 공개 검증기 계약을 구현한 다른 엔진도 사용할 수 있습니다.

## 실행 예제

main.go를 교체합니다. 검증기 등록과 OpenAPI 활성화는 BuildApplication에 있습니다.

```go
package main

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}

func (u *CreateUser) Validate() error {
	if strings.EqualFold(strings.TrimSpace(u.Name), "admin") {
		return errors.New("name is reserved")
	}
	return nil
}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.POST("/users", func(ctx spinectx.Ctx, body input.Body[CreateUser]) (httpx.Response[CreateUser], error) {
		if err := (*CreateUser)(body).Validate(); err != nil {
			return httpx.Response[CreateUser]{}, httperr.BadRequest(err.Error())
		}
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})
	r.GET("/users/:id", func(ctx spinectx.Ctx, id input.Path[int64]) (httpx.Response[map[string]any], error) {
		if *id <= 0 {
			return httpx.Response[map[string]any]{}, httperr.BadRequest("invalid user ID")
		}
		if *id != 1 {
			return httpx.Response[map[string]any]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": "Alice"}}, nil
	})
}
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}

	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{OpenAPI: boot.OpenAPIOptions{Enabled: true}}, EnableGracefulShutdown: true}, nil
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

## 세 가지 Validate 구분 {#validation-modes}

validate 태그는 등록한 엔진이 바인딩 뒤 핸들러 전에 검사합니다. request.Validate()는 직접 만든 일반 메서드를 명시적으로 호출한 것입니다. app.Validate(options)는 실행 전 가능한 구성과 DI 검사입니다. 검증기를 등록하지 않으면 태그만으로 검사하지 않습니다.

태그만 필요하면 DTO Validate와 수동 호출을 모두 생략합니다. 여기서는 예약 이름 규칙을 보여 주기 위해 추가했습니다. 이 규칙은 자동 호출되거나 OpenAPI로 추론되지 않습니다. 래퍼의 DTO 메서드는 (*body).Validate() 또는 (*CreateUser)(body).Validate()로 호출합니다. [DTO 정의](/ko/learn/tutorial/2-controller#dto-validation)를 참고하세요.

## 요청과 명세

```sh
go run .
# 다른 터미널
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
curl http://localhost:8080/openapi.json
```

순서대로 200, 400, 404, 400, 400, 201입니다. POST 오류는 태그 위반과 수동 규칙입니다. OpenAPI는 name과 email을 필수로 표시하지만 명세 자체가 검증을 실행하지 않습니다. 검증기가 필수 여부를 설명했다면 json:",string" 같은 표현 제한에서도 Required를 유지합니다. CLI 정적 export는 검증기를 실행하지 않으므로 실제 엔진의 명세는 준비된 앱에서 확인합니다.

## 오류 응답

바인딩과 태그 검증 실패는 핸들러 전에 400입니다. HTTPError는 400~599만 허용하며 200/302 같은 잘못된 상태는 일반 500으로 처리합니다. 일반 오류는 내부 원문을 숨긴 500입니다. 공개 가능한 메시지만 httperr에 넣습니다. BeforeResponse 오류는 핸들러 오류보다 응답에 우선합니다.

## 다음 단계

[인터셉터](/ko/learn/tutorial/4-interceptor) / [OpenAPI](/ko/reference/api/openapi)
