# 프로젝트 구조

Spine CLI로 프로젝트를 만들고 사용자 리소스를 추가합니다. 생성된 파일을 살펴보면서 앱 구성 코드를 둘 위치와 컨트롤러, 서비스, 리포지토리의 역할을 익힙니다.

먼저 [CLI 설치](/ko/learn/getting-started/installation)를 완료하세요. 이 튜토리얼은 기능별 패키지를 사용하므로 새 디렉터리에서 `--layout legacy`로 `my-app`을 생성합니다. [첫 번째 앱](/ko/learn/getting-started/first-app)의 기본 `layered-v1` 앱과 구조가 다르며, 기존 앱을 자동 변환하지 않습니다.

## CLI로 프로젝트 생성

프로젝트를 둘 상위 디렉터리에서 실행합니다. 같은 이름의 `my-app` 디렉터리가 이미 있다면 다른 이름을 사용하세요.

```sh
spine version
spine new my-app --layout legacy --module example.com/my-app
cd my-app
spine doctor
spine inspect
```

`my-app` 디렉터리가 생성되고 의존성이 준비됩니다. `doctor`가 도구와 프로젝트 설정을 진단하며, `inspect`에서 기본 경로인 `GET /health` 등록을 확인할 수 있습니다.

## 생성되는 기본 구조

위에서 실행한 `new`는 `go.sum`을 포함한 프로젝트 파일을 만들고 의존성 설치와 빌드를 완료합니다.

```text
my-app/
├── .gitignore
├── README.md
├── go.mod
├── go.sum
├── main.go
├── spine.toml
└── internal/
    └── application/
        ├── application.go
        └── application_test.go
```

## CLI 설정

`spine.toml`은 모듈, 진입점, 앱 구성 위치, 포트, 레이아웃과 플랫폼을 설정합니다. DB와 인증 등 앱 설정은 별도로 관리합니다.

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "legacy"
platform = "echo"
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
```

| 키 | 역할 |
| --- | --- |
| `module` | Go 모듈 경로. `go.mod`의 모듈 경로와 일치해야 합니다. |
| `entrypoint` | 실행하거나 빌드할 대상 |
| `composition` | 앱 구성을 검사하고 생성한 코드를 자동으로 등록할 위치 |
| `port` | 개발 서버에서 사용할 포트 |
| `layout` | 생성기의 파일 배치 (`legacy` 또는 `layered-v1`) |
| `platform` | HTTP 플랫폼 (`echo` 또는 `none`) |
| `recipe` | 호환 의존성 조합을 선택하는 레시피 |
| `websocket_platform` | WebSocket 구현 (`none` 또는 `gorilla`) |
| `validator` | DTO 검증 구현 (`none` 또는 `playground`) |
| `event_platforms` | 이름과 종류로 선택한 이벤트 플랫폼 목록 |

## 실행과 앱 구성 분리

`main.go`는 앱 구성 함수를 호출하고, 구성을 검증한 뒤 서버를 실행합니다. 생성자, 라우트, 인터셉터는 `internal/application/application.go`의 `BuildApplication`에 등록합니다.

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

`BuildApplication`은 서버를 시작하지 않고 앱과 실행 옵션을 반환합니다. 생성된 코드는 기본 HTTP 경로인 `GET /health`를 등록합니다.

```go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
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
    app := spine.New(echoplatform.Option())
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

명령이 끝나면 `src/user`에 네 파일이 생성됩니다. CLI는 기본적으로 `BuildApplication`에 다음 등록 코드를 추가합니다. 생성 결과를 확인하고, 같은 코드를 직접 다시 등록하지 마세요.

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go`는 생성자와 `GET /user/:id`를 등록합니다. 나머지 파일의 역할은 다음과 같습니다.

| 파일 | 역할 |
| --- | --- |
| `user_controller.go` | HTTP 요청을 받아 서비스에 전달하고 응답을 반환합니다. |
| `user_service.go` | 비즈니스 로직을 처리합니다. |
| `user_repository.go` | 데이터 접근을 담당합니다. |

리소스 생성기는 ID를 반환하는 GET 핸들러의 기본 코드만 생성합니다. 데이터베이스 모델이나 데이터를 영구 저장하는 기능은 직접 구현해야 합니다.

타입이 있는 생성, 조회 예제가 필요하면 별도 이름으로 `spine generate slice order --storage memory --field name:string`을 사용하세요. 이 명령의 메모리 저장소는 개발용이며 앱을 종료하면 데이터가 사라집니다.

## 등록 규칙과 검증

CLI가 등록 코드를 검사할 수 있도록 `BuildApplication() (spine.App, boot.Options, error)` 함수 본문의 최상위에 `app := spine.New(echoplatform.Option())`를 유지하세요. 등록 코드를 조건문, 반복문, 임의의 보조 함수 안으로 옮기지 않습니다. `Register(app)`가 반환한 오류도 확인해 반환해야 합니다.

앱 구성을 검사한 뒤 서버를 실행합니다.

```sh
spine contract check
spine verify
spine dev
```

`contract check`는 등록 코드에서 추출한 실행 계약을 검사합니다. `verify`는 계약 검사와 `gofmt`, `go vet`, Go 테스트를 실행합니다. 두 명령이 오류 없이 끝나면 `dev`가 개발 서버를 시작합니다. 실제 HTTP 동작과 외부 데이터베이스, 메시지 브로커 연결은 실행 환경에서 별도로 확인해야 합니다.

## 다음 단계

- [컨트롤러](/ko/learn/tutorial/2-controller)
- [의존성 주입](/ko/learn/tutorial/3-dependency-injection)
- [인터셉터](/ko/learn/tutorial/4-interceptor)
