# 소개

Spine은 Go 코드로 역할별 생성자, 컨트롤러 라우트와 인터셉터를 조립하는 백엔드 프레임워크입니다.

## 실행 예제

```sh
go mod init example.com/spine-intro
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

Go 1.26 이상에서 main.go로 저장하고 go run .을 실행합니다. 다른 터미널의 curl `http://localhost:8080/greeting`은 hello를 반환합니다.

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Repository struct{}

func (*Repository) Constructor() *Repository { return &Repository{} }
func (*Repository) Greeting() string         { return "hello" }

type Service struct{ repository *Repository }

func (*Service) Constructor(repository *Repository) *Service { return &Service{repository: repository} }

type Controller struct{ service *Service }

func (*Controller) Constructor(service *Service) *Controller { return &Controller{service: service} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/greeting", func() httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Service(&Service{}), constructor.Repository(&Repository{}))
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

## 공통 개발 방식

BuildApplication에서 플랫폼과 검증기를 선택하고 역할을 등록합니다. Constructor는 타입으로 DI를 해결하고 RegisterRoutes는 HTTP 경로를 선언합니다. 입력은 input.Path, Query, Header, Body로 출처를 명시합니다. 등록한 검증기가 태그를 자동 검사하고 성공은 httpx 응답, 오류는 error로 표현합니다.

## 시작하기

[설치](/ko/learn/getting-started/installation) / [첫 번째 앱](/ko/learn/getting-started/first-app) / [컨트롤러](/ko/learn/tutorial/2-controller)
