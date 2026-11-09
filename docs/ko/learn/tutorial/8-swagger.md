# Swagger와 OpenAPI 문서

Spine `v0.7.1`은 등록된 HTTP 라우트에서 OpenAPI JSON을 만들고 내장 Swagger UI와 ReDoc을 제공할 수 있습니다. 이 튜토리얼에서는 독립 앱으로 문서와 화면을 실행한 뒤 CLI의 정적 내보내기를 확인합니다.

## 1. 실행할 앱 준비

별도 Go 모듈에서 다음 의존성을 설치합니다. Echo RC는 아래 예제를 검증한 조합이며, 배포할 때는 공개된 호환 플랫폼 태그와 `go.mod`, `go.sum`을 함께 고정하세요.

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0-rc.1
```

아래 코드를 `main.go`에 저장하고 `go run .`으로 실행합니다. `Enabled`를 생략하면 자동 제공이 꺼집니다. `UI`를 생략하면 JSON만 제공합니다.

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
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }

func (c *Controller) RegisterRoutes(r *api.Registry) {
    r.GET("/hello", func() httpx.Response[string] {
        return httpx.Response[string]{Body: "hello"}
    })
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(constructor.Controller(&Controller{}))

    options := boot.Options{
        Address: ":8080",
        HTTP: &boot.HTTPOptions{
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Title:   "Example API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{}),
                    redoc.New(redoc.Options{}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

## 2. HTTP로 확인

다른 터미널에서 명세와 화면에 요청합니다. 세 리소스가 200을 반환하며 브라우저에서 `/docs` 또는 `/redoc`을 열 수 있습니다.

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

명세와 UI는 업무 인터셉터를 실행하지 않습니다. 외부에 공개할 때 접근 제한이 필요하면 HTTP 미들웨어나 프록시에 정책을 적용하세요.

## 3. CLI로 정적 명세 내보내기

[프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 만든 앱 루트에서 실행합니다. 이 명령은 앱을 실행하지 않고 소스를 분석해 파일을 생성합니다. 기존 파일을 덮어쓰려면 먼저 내용을 검토하고 `--force`를 사용하세요.

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

생성된 명세에서 `/health`와 `/user/{id}`를 확인합니다. 정적 분석은 동적 코드와 런타임 validator의 모든 제약이나 핸들러가 고르는 응답 상태를 확정하지 못합니다. 진단을 확인하고 실제 요청과 런타임 명세를 함께 검증하세요.

## 다음 단계

[런타임 OpenAPI 참조](/ko/reference/api/openapi)에서 경로 충돌, validator, 명세 조회와 UI 설정을 확인하세요. [입력 전환 안내](/ko/learn/migration/v0.7.1-preview)는 기존 입력 API의 호환 규칙을 설명합니다.
