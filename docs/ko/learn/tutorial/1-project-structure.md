# 프로젝트 구조

기본 layered-v1 레이아웃에서 조립, HTTP 컨트롤러와 실행을 분리합니다. Deprecated 라우트 등록 코드를 새로 작성하지 않습니다.

## 프로젝트 생성

Spine CLI `v0.4.4`로 앱을 만듭니다. 생성된 `go.mod`에서 코어와 플랫폼 버전을 확인하세요.

```sh
spine new my-app --module example.com/my-app --channel main --validator playground --no-interactive
cd my-app
spine doctor
spine inspect
```

```text
my-app/
├── main.go
├── go.mod
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/controller/health_controller.go
```

## 실행과 조립

아래 세 파일은 역할 분리의 최소 예제입니다. 기존 생성 파일을 바꿀 때 해당 파일을 교체하며 같은 타입과 등록을 중복 추가하지 않습니다. main은 조립, Validate, Run을 호출하고 BuildApplication은 서버를 시작하지 않습니다.

```go
// main.go
package main

import (
	"example.com/my-app/internal/application"
	"log"
)

func main() {
	app, options, err := application.BuildApplication()
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

```go
// src/controller/health_controller.go
package controller

import (
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type HealthController struct{}

func (*HealthController) Constructor() *HealthController { return &HealthController{} }
func (*HealthController) RegisterRoutes(r *api.Registry) {
	r.GET("/health", func(ctx spinectx.Ctx) httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
	})
}
```

```go
// internal/application/application.go
package application

import (
	"example.com/my-app/src/controller"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&controller.HealthController{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
```

## 생성기로 기능 추가

```sh
spine generate resource user --dry-run
spine generate resource user
spine --help
```

기본 layered-v1의 resource는 조회 골격을 만듭니다. 전체 CRUD와 DB 및 업무 규칙은 직접 구현합니다. 생성기가 추가한 역할 등록을 중복 작성하지 마세요. 컨트롤러의 RegisterRoutes와 Constructor 역할 등록을 확인합니다. 레이아웃별 지원 생성기는 spine --help으로 확인할 수 있습니다.

## 검증과 실행

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

기대 응답은 {"status":"ok"}입니다. contract check는 정적 계약, verify는 계약과 포맷, vet, Go 테스트를 확인합니다. app.Validate도 실제 생성자 실행이나 외부 연결 성공을 보장하지 않습니다. HTTP와 외부 자원은 실제 요청으로 확인합니다.

## 다음 단계

[컨트롤러](/ko/learn/tutorial/2-controller) / [DI](/ko/learn/tutorial/3-dependency-injection) / [인터셉터](/ko/learn/tutorial/4-interceptor)
