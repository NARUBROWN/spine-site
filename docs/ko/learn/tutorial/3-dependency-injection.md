# 의존성 주입

생성자 인자 타입으로 저장소, 서비스와 컨트롤러를 연결합니다. 이 독립 앱은 DB 없이 GET /greeting에 hello를 반환합니다.

## 생성 계약

각 타입은 Constructor(의존성...) *자기타입 메서드를 구현합니다. Repository, Service, Controller, Interceptor 역할을 constructor 패키지로 등록합니다. Controller는 RegisterRoutes도, Interceptor는 네 훅도 구현합니다. Custom은 외부 생성 함수나 일반 객체용입니다.

&Service{}는 타입 표식입니다. 필드값을 복사하지 않고 새 receiver에서 Constructor를 호출합니다. 생성 결과는 앱에서 공유합니다.

## 실행 예제

[컨트롤러 의존성](/ko/learn/tutorial/2-controller)

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
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
	r.GET("/greeting", func(ctx spinectx.Ctx) httpx.Response[string] {
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

## 의존성 해결

```sh
go run .
# 다른 터미널
curl http://localhost:8080/greeting
```

등록 순서와 무관하게 의존성 순서로 생성하여 hello를 반환합니다. 중복 제공 타입, 누락된 의존성, 모호한 인터페이스와 순환은 그래프 검사에서 거부합니다. nil 반환과 패닉은 생성자를 실행하는 준비 단계에서 확인합니다.

## 외부 생성 함수

```go
app.Constructor(constructor.Custom(database.NewDB))
```

예를 들어 database.NewDB는 func NewDB() *bun.DB입니다. 객체와 함수 생성자는 반환값 하나만 지원합니다. (T, error)와 가변 인자는 거부하며 일반 []T 인자는 허용합니다. 인터페이스는 정확한 반환 타입 제공자를 우선하며, 없으면 할당 가능한 제공자가 하나여야 합니다.

## 검증과 수명

BuildApplication은 조립만 합니다. app.Validate는 생성자 실행 없이 가능한 검사이며, Prepare는 생성자를 실행하고 RegisterRoutes를 수집합니다. Run은 준비 후 실행합니다. DI의 임의 Close는 자동 호출하지 않으므로 DB 자원은 소유자가 관리합니다. 요청 트랜잭션은 공유 객체 필드에 덮어쓰지 말고 ExecutionContext().Set/Get과 명시적인 서비스 인자로 전달합니다.

## 다음 단계

[인터셉터](/ko/learn/tutorial/4-interceptor) / [데이터베이스](/ko/learn/tutorial/5-database) / [트랜잭션](/ko/learn/tutorial/6-transaction)
