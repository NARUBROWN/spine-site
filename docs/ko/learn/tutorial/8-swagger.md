# Swagger와 OpenAPI

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

런타임 OpenAPI JSON과 내장 Swagger UI, ReDoc을 제공합니다. 명세와 실제 입력 검증을 함께 확인합니다.

## 독립 앱

```sh
go mod init example.com/spine-openapi
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
```

BuildApplication에서 playground.New()를 WithValidator로 등록합니다. 필수 태그는 요청에서 자동 검사하고 명세에서도 required로 설명합니다. OpenAPI 문서가 요청을 검증하는 것은 아니며 DTO의 임의 Validate 메서드는 자동 실행되거나 문서화되지 않습니다.

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	"github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
	"github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}
type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/hello", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: "hello"}
	})
	r.POST("/users", func(ctx spinectx.Ctx, body input.Body[CreateUser]) httpx.Response[CreateUser] {
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: 201}}
	}, api.Summary("Create user"), api.Tags("Users"))
}
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{
		OpenAPI: boot.OpenAPIOptions{
			Enabled: true, Title: "Example API", Version: "1.0.0",
			UI: []boot.OpenAPIUI{swaggerui.New(swaggerui.Options{}), redoc.New(redoc.Options{})},
		},
	}}
	return app, options, nil
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

## 요청과 화면 확인

```sh
go run .
# In another terminal
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
curl -i -H 'Content-Type: application/json' -d '{}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"alice@example.com"}' http://localhost:8080/users
```

명세와 UI는 200, 빈 본문은 400, 유효한 생성은 201입니다. 명세는 name과 email을 필수로 표시합니다. UI와 명세는 업무 인터셉터를 실행하지 않으므로 공개 범위는 HTTP 미들웨어나 프록시에서 관리합니다.

## CLI 정적 내보내기

이 명령은 spine.toml이 있는 CLI 프로젝트 루트용입니다. 위 독립 예제에서 CLI 설정을 생성했다고 가정하지 않습니다. 정적 분석은 앱이나 검증기를 실행하지 않으며 진단과 런타임 명세를 함께 확인해야 합니다.

```sh
spine contract check
spine contract export --format openapi --output openapi.json
```

## 다음 단계

[OpenAPI 참조](/ko/reference/api/openapi) / [입력 검증](/ko/learn/tutorial/7-error-handling#validation-modes)
