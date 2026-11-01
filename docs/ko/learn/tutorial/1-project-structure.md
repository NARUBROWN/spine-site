# 프로젝트 구조

Spine CLI로 생성한 프로젝트를 기준으로 앱 구성과 기능 코드를 나눕니다. 먼저 [CLI 설치](/ko/learn/getting-started/installation)를 완료하세요.

## CLI로 프로젝트 생성

프로젝트를 둘 상위 디렉터리에서 실행합니다.

```sh
spine version
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
spine doctor
spine inspect
```

## 생성되는 기본 구조

`spine new`는 다음 파일을 생성합니다. `go.sum`은 이후 `go mod tidy`에서 만들어집니다.

```text
my-app/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/
    └── application/
        ├── application.go
        └── application_test.go
```

## CLI 설정

`module`은 `go.mod`와 일치해야 합니다. `entrypoint`는 실행·빌드 대상이고 `composition`은 계약 검사와 생성기의 자동 등록 대상입니다. 설정 키는 아래 네 개만 지원합니다. DB 연결 같은 앱 설정은 별도로 관리합니다.

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

## 실행과 앱 구성 분리

`main.go`는 앱 구성, 검증, 실행만 담당합니다. 생성자·라우트·인터셉터는 `internal/application/application.go`의 `BuildApplication`에 등록합니다.

```go
package main

import (
    "log"

    "example.com/my-app/internal/application"
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

생성된 구성 함수는 리스너를 시작하지 않고 앱과 실행 옵션을 반환합니다. 기본 HTTP 경로는 `GET /health`입니다.

```go
package application

import (
    "os"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## CLI로 기능 추가

프로젝트 루트에서 사용자 리소스를 생성합니다. 기존 프로젝트에 이미 생성했다면 이 명령은 건너뜁니다.

```sh
spine generate resource user
```

```text
src/user/
├── user_route.go
├── user_repository.go
├── user_service.go
└── user_controller.go
```

기본 자동 등록은 `BuildApplication`에 아래 코드를 추가합니다. 직접 다시 등록하면 중복되므로 생성 결과를 확인하세요.

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go`는 생성자와 `GET /user/:id`를 등록합니다. 컨트롤러는 HTTP 입출력, 서비스는 비즈니스 로직, 리포지토리는 데이터 접근을 담당합니다. 이 리소스 생성기는 ID를 반환하는 GET 골격만 생성하며 DB 모델이나 영속 저장소를 구현하지 않습니다. 타입이 있는 생성·조회 예제가 필요하면 별도 이름으로 `spine generate slice order --storage memory --field name:string`을 사용하세요. 메모리 저장소는 개발용이며 종료하면 데이터가 사라집니다.

## 등록 규칙과 검증

`BuildApplication() (spine.App, boot.Options, error)`의 최상위에 `app := spine.New()`를 유지합니다. 등록을 조건문·반복문·임의 헬퍼에 숨기지 말고, `Register(app)`의 오류를 확인해 반환합니다.

```sh
spine contract check
spine verify
spine dev
```

`contract check`는 정적 계약을 검사하고 `verify`는 계약·gofmt·vet·Go 테스트를 확인합니다. DB·브로커 연결과 실제 HTTP 동작은 별도 실행으로 확인합니다.

## 다음 단계

- [컨트롤러](/ko/learn/tutorial/2-controller)
- [의존성 주입](/ko/learn/tutorial/3-dependency-injection)
- [인터셉터](/ko/learn/tutorial/4-interceptor)
