# 소개

Spine은 생성자, 라우트와 인터셉터를 Go 코드로 구성하는 백엔드 프레임워크입니다. `v0.7.1`에서는 컨트롤러가 자신의 HTTP 경로를 등록하고 입력 출처와 응답 타입을 핸들러 시그니처로 표현합니다.

## 앱 구성과 실행

아래 독립 앱은 저장소와 서비스를 주입받는 컨트롤러를 구성합니다. 별도 Go 모듈에 Spine `v0.7.1`과 호환 Echo 플랫폼을 설치하고 `main.go`로 저장한 뒤 `go run .`을 실행하세요.

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
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(
		constructor.Controller(&Controller{}),
		constructor.Service(&Service{}),
		constructor.Repository(&Repository{}),
	)
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

다른 터미널에서 요청하면 `hello`가 반환됩니다. CLI로 만든 프로젝트는 앱 구성을 `BuildApplication()`에 두고 `main.go`에서 검증과 실행을 담당합니다.

```bash
curl http://localhost:8080/greeting
```

## 핵심 개념

### 생성자와 의존성

`Constructor` 메서드에 필요한 타입을 선언하고 `constructor.Repository`, `constructor.Service`, `constructor.Controller`로 등록합니다. 컨테이너는 등록 순서가 아니라 타입에 따라 의존성을 해결합니다. 기존 함수 생성자도 사용할 수 있습니다.

### 라우트와 입력

`RegisterRoutes`에서 `api.Registry`에 경로와 콜백을 등록합니다. `input.Path[T]`, `input.Query[T]`, `input.Body[T]`는 입력 출처를 나타내며, 헤더는 별도의 태그 구조체로 받습니다. 기존 `app.Route`는 호환을 위해 유지되지만 Deprecated입니다.

### 인터셉터와 응답

인터셉터는 인증, 로깅과 트랜잭션 같은 공통 처리를 핸들러 전후에 실행합니다. 성공 응답은 `httpx.Response[T]`로 표현하고 오류는 `error`로 반환할 수 있습니다. 요청 본문을 읽기 전에 검사해야 하는 인증은 전역 인터셉터의 실행 시점을 확인하세요.

### 플랫폼

HTTP는 Echo 또는 net/http 구현을 선택할 수 있습니다. WebSocket, 이벤트 브로커와 validator도 독립 플랫폼으로 연결합니다.

## 시작하기

[설치](/ko/learn/getting-started/installation) 후 [첫 번째 앱](/ko/learn/getting-started/first-app)에서 CLI 프로젝트를 만들고 응답을 확인하세요. [컨트롤러](/ko/learn/tutorial/2-controller), [의존성 주입](/ko/learn/tutorial/3-dependency-injection), [인터셉터](/ko/learn/tutorial/4-interceptor)에서 각 개념을 이어서 살펴볼 수 있습니다.
