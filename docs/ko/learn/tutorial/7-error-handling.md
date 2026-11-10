# 오류 처리와 입력 검증

Spine v0.7.1에서 자동 DTO 검증과 직접 작성한 검증을 결합하고, 입력 오류와 리소스 없음 오류를 HTTP 응답으로 반환합니다.

## 실행 예제

Go 1.26 이상이 필요합니다. 별도 Go 모듈에서 다음 의존성을 설치하고 코드를 `main.go`로 저장해 실행하세요. 이 예제는 사용자를 저장하지 않습니다.

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0 github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

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
	r.POST("/users", func(body input.Body[CreateUser]) (httpx.Response[CreateUser], error) {
		if err := (*CreateUser)(body).Validate(); err != nil {
			return httpx.Response[CreateUser]{}, httperr.BadRequest(err.Error())
		}
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})
	r.GET("/users/:id", func(id input.Path[int64]) (httpx.Response[map[string]any], error) {
		if *id <= 0 {
			return httpx.Response[map[string]any]{}, httperr.BadRequest("invalid user ID")
		}
		if *id != 1 {
			return httpx.Response[map[string]any]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": "Alice"}}, nil
	})
}
func main() {
	engine, err := playground.New()
	if err != nil {
		log.Fatal(err)
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

## 검증이 실행되는 시점

`spine.WithValidator(engine)`를 등록하면 본문 바인딩이 성공한 뒤 `validate` 태그를 검사하고, 실패 시 핸들러 전에 400을 반환합니다. 검증기를 등록하지 않으면 태그만으로 검증하지 않습니다.

DTO의 `Validate()` 메서드는 자동으로 호출되지 않습니다. 예제는 기본 태그 검증을 통과한 뒤 핸들러에서 직접 호출하여 예약 이름을 검사합니다. 여러 필드를 비교하거나 서비스 규칙을 적용할 때 같은 방식으로 확장할 수 있습니다. 클라이언트에 노출해도 되는 메시지만 `BadRequest`에 전달하세요.

`app.Validate(options)`는 시작 전 앱 구성을 검사합니다. 요청 DTO를 검증하거나 생성자와 외부 서비스의 실제 실행을 대신하지 않습니다.

## 응답 확인

순서대로 200, 400, 404, 400, 400, 201을 확인합니다. 첫 POST 오류는 필드별 검증 오류이고 두 번째는 직접 작성한 규칙입니다.

```bash
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
```

## 오류 매핑

`httperr.BadRequest`, `Unauthorized`, `NotFound`는 각각 400, 401, 404를 반환합니다. 다른 상태는 `httperr.HTTPError`로 지정할 수 있습니다. 일반 오류는 500으로 처리되므로 내부 오류를 `err.Error()` 그대로 공개하지 마세요. 도메인 오류를 `errors.Is`로 판별해 컨트롤러에서 안전한 메시지로 변환할 수 있습니다.

## 더 알아보기

- [httperr](/ko/learn/core-concepts/httperr)
- [인터셉터](/ko/learn/tutorial/4-interceptor)
