# 컨트롤러

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

RegisterRoutes에서 경로를 선언하고 입력 출처별 래퍼로 요청을 받습니다. 아래 독립 앱은 값을 반환하며 저장하지 않습니다.

## 준비

Go 1.26 이상과 빈 디렉터리가 필요합니다. 앱 조립은 BuildApplication에 둡니다. CLI 프로젝트에서는 internal/application/application.go입니다.

```sh
go mod init example.com/spine-tutorial
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1
```

## 입력 출처와 이름

| 출처 | 핸들러 인자 | 외부 이름 |
| --- | --- | --- |
| Path | `input.Path[UserPath]` or `input.Path[int64]` | `path:"id"` |
| Query | `input.Query[SearchQuery]` | `query:"name"` |
| Header | `input.Header[RequestHeaders]` | `header:"X-Request-ID"` |
| Body | `input.Body[CreateUser]` | `json` / `xml` / `form` |

Path, Query와 Header는 태그 없이 lowerCamel 이름을 사용합니다. ID는 id, UserID는 userId입니다. 원하는 외부 이름만 태그로 지정합니다. Body는 디코더의 이름 규칙을 따릅니다. input.Param은 없으며 일반 *DTO HTTP 입력은 HTTP_INPUT_WRAPPER_REQUIRED로 거부합니다. 필드는 path.ID와 body.Name, 스칼라는 *id로 읽습니다.

## DTO 정의와 선택적 검증 메서드 {#dto-validation}

WithValidator(engine)를 BuildApplication에서 등록하면 validate 태그는 핸들러 전에 자동 검사합니다. 태그만 필요하면 Validate 메서드나 중복 검사를 추가하지 않습니다. 예약 이름 같은 추가 규칙은 일반 Go 메서드로 직접 구현할 수 있습니다. 아래 조각은 errors import가 필요합니다.

```go
type CreateUserRequest struct {
	Name string `json:"name" validate:"required,max=100"`
}

func (r *CreateUserRequest) Validate() error {
	if r.Name == "admin" {
		return errors.New("사용할 수 없는 이름입니다")
	}
	return nil
}
```

이 메서드는 자동 호출되지 않습니다. 필요한 핸들러에서 (*body).Validate() 또는 (*CreateUserRequest)(body).Validate()로 호출합니다. 래퍼에서 body.Validate()를 바로 호출하지 않습니다. 메서드 규칙은 OpenAPI가 추론하지 않습니다. [전체 검증 예제](/ko/learn/tutorial/7-error-handling#validation-modes)를 참고하세요.

## 실행할 앱

main.go로 저장합니다. 공개 pkg/spine.Ctx는 spinectx라는 별칭으로 가져옵니다. 아래 기본 예제에는 추가 Validate 메서드가 없습니다.

```go
package main

import (
	"log"

	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type UserController struct{}
type UserPath struct {
	ID int64 `path:"id"`
}
type SearchQuery struct {
	Name string `query:"name"`
}
type RequestHeaders struct {
	RequestID string `header:"X-Request-ID"`
}
type CreateUser struct {
	Name string `json:"name"`
}
type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func (*UserController) Constructor() *UserController { return &UserController{} }
func (c *UserController) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Tags("Users"))
	users.GET("/search", func(ctx spinectx.Ctx, q input.Query[SearchQuery], h input.Header[RequestHeaders]) httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"name": q.Name, "request_id": h.RequestID}}
	})
	users.GET("/id/:id", func(ctx spinectx.Ctx, path input.Path[UserPath]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{ID: path.ID}}
	}, api.Summary("Get user"))
	users.POST("/", func(ctx spinectx.Ctx, body input.Body[CreateUser]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{Name: body.Name}, Options: httpx.ResponseOptions{Status: 201}}
	})
}

func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&UserController{}))
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

그룹의 "/"는 기본 경로입니다. users.POST("/", ...)는 POST /users입니다. 새 코드는 Deprecated app.Route 대신 RegisterRoutes를 사용합니다.

## 요청 확인

```sh
go run .
# 다른 터미널
curl -H 'X-Request-ID: r1' 'http://localhost:8080/users/search?name=alice'
curl http://localhost:8080/users/id/12
curl -i -H 'Content-Type: application/json' -d '{"name":"bob"}' http://localhost:8080/users
curl -i http://localhost:8080/users/id/not-a-number
```

이름과 요청 ID, ID 12, 201 생성 응답, 잘못된 정수의 400을 순서대로 확인합니다.

## 입력과 반환 규칙

스칼라 Path는 경로 변수 순서와 개수가 같아야 합니다. 경로 DTO는 이름으로 일부 키만 바인딩할 수 있습니다. 두 방식을 섞지 않습니다. 출처별 DTO를 분리하고 중복 키를 피합니다. Body는 하나만 선언하며 JSON, XML, form과 multipart를 지원합니다. 파일은 form 태그가 있는 *multipart.FileHeader 또는 []*multipart.FileHeader 필드로 받습니다.

성공 응답은 httpx.Response[T], Binary, Redirect 중 하나와 선택적 error입니다. 응답을 여러 개 선언하면 준비 단계에서 거부합니다.

## 오류 응답 {#error-response}

바인딩 실패는 핸들러 전에 400, 일반 오류는 원문을 숨긴 500입니다. [오류 처리](/ko/learn/tutorial/7-error-handling)에서 검증기를 연결합니다.

## 다음 단계

[DI](/ko/learn/tutorial/3-dependency-injection) / [OpenAPI](/ko/reference/api/openapi)
