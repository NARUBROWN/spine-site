# 런타임 OpenAPI

Spine `v0.7.0-preview.1`부터 실제 등록한 HTTP 라우트, 핸들러 타입과 validator 설명 계약으로 OpenAPI 3.1.2 JSON을 생성할 수 있습니다.

`boot.OpenAPIOptions.UI`와 임베드 Swagger UI, ReDoc은 `v0.7.0-preview.2`부터 사용할 수 있습니다. JSON 명세 생성의 최초 버전인 `v0.7.0-preview.1`과 구분하세요.

::: warning v0.7.0 미리보기 API
이 API는 안정 버전 `v0.6.5`에 포함되지 않습니다. HTTP에는 Echo `v0.2.0-preview.1`을 사용하고, playground로 검증과 상세 입력 명세를 설명한다면 `v0.2.0-preview.1`을 선택하세요. 입력 인자는 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview)을 먼저 확인하세요.
:::

## 활성화와 부팅 옵션 {#options}

자동 생성과 HTTP 제공은 기본 비활성화입니다. 기존 앱의 `boot.Options`에 다음처럼 명시적으로 활성화합니다. `boot`의 import 경로는 `github.com/NARUBROWN/spine/pkg/boot`입니다.

```go
options := boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{
        GlobalPrefix: "/api",
        OpenAPI: boot.OpenAPIOptions{
            Enabled: true,
            Path: "/openapi.json",
            Title: "User API",
            Version: "1.0.0",
        },
    },
}
```

| 필드 | 기본값 | 동작 |
| --- | --- | --- |
| `Enabled` | `false` | `true`일 때 준비 단계에서 자동 생성하고 HTTP로 제공 |
| `Path` | `/openapi.json` | GET과 HEAD로 제공할 정적 절대 경로 |
| `Title` | `Spine API` | OpenAPI `info.title` |
| `Version` | `unversioned` | 앱의 `info.version`, 프레임워크 버전과 별개 |
| `UI` | `nil` | `v0.7.0-preview.2`부터 제공하는 `[]boot.OpenAPIUI`. 생략하면 JSON 명세만 제공 |

`HTTP: nil`이면 HTTP와 명세 리소스가 모두 꺼집니다. `Path`, `Title`이나 `Version`만 지정해도 활성화되지 않습니다. 끄려면 `Enabled: false`로 설정하거나 OpenAPI 옵션을 생략하세요. 미발행 작업 소스에서 사용했던 `Disabled` 대신 공개 미리보기의 `Enabled`를 사용합니다.

명세 경로는 `GlobalPrefix`와 독립적입니다. 위 옵션은 업무 API에 `/api`를 적용하지만 명세는 `/openapi.json`에서 제공합니다. 준비한 앱은 명세 스냅샷을 재사용하며 파일을 자동으로 저장하지 않습니다.

## 명세 조회와 충돌 {#http}

활성화된 리소스는 공개 조회할 수 있고 HTTP 서버 미들웨어를 통과합니다. 문서 조회는 업무 컨트롤러, DTO 바인딩, validator 검증과 Spine 업무 인터셉터를 실행하지 않습니다.

앱의 GET, HEAD 또는 WebSocket 경로가 명세 경로에 매칭되면 부팅 시 `OPENAPI_PATH_CONFLICT`입니다. `/:id` 같은 동적 경로도 충돌할 수 있습니다. `Path`를 겹치지 않는 정적 경로로 바꾸거나 명세를 끄세요. 비활성 상태에서는 이 경로를 예약하지 않습니다. 플랫폼에 직접 등록한 native 경로는 코어의 충돌 검사 대상이 아닙니다.

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/openapi.json
```

## 앱을 실행하지 않고 설명하거나 내보내기 {#export}

다음 함수는 이미 구성한 앱, HTTP 옵션과 출력 대상을 받습니다. 기존 `spine.App` 인터페이스를 교체하지 않습니다.

```go
func ExportOpenAPI(app spine.App, options boot.Options, output io.Writer) error {
    if options.HTTP == nil {
        return errors.New("HTTP options are required")
    }
    description, err := spine.DescribeHTTP(app, options)
    if err != nil {
        return err
    }
    document, err := openapi.Generate(description, options.HTTP.OpenAPI)
    if err != nil {
        return err
    }
    _, err = output.Write(document)
    return err
}
```

이 함수에는 표준 `errors`, `io`, `github.com/NARUBROWN/spine`, `github.com/NARUBROWN/spine/pkg/boot`와 `github.com/NARUBROWN/spine/pkg/openapi` import가 필요합니다. `DescribeHTTP`는 생성자, factory, 핸들러와 검증 규칙을 실행하지 않습니다. 등록한 `SchemaDescriber`의 설명 메서드는 호출할 수 있습니다. 출력 파일이 필요하면 호출자가 `io.Writer`를 제공합니다.

명시적인 `DescribeHTTP`와 `openapi.Generate`는 자동 HTTP 제공을 끈 상태에서도 사용할 수 있습니다. 설명 기능이 없는 사용자 정의 App은 `ErrHTTPDescriptionUnavailable`을 반환합니다.

## validator와 설명 범위 {#validation}

| 등록 상태 | 생성하는 정보 |
| --- | --- |
| validator 미등록 | 경로와 HTTP 메서드 중심 정보, `VALIDATOR_NOT_CONFIGURED` 진단 |
| validator는 있으나 `SchemaDescriber` 미지원 | 요청 검증은 유지. DTO 상세 입력을 생략하며 DTO 설명 시 `INPUT_SCHEMA_DESCRIPTION_UNAVAILABLE` 진단 |
| 설명 계약을 지원하는 validator 등록 | 출처별 DTO와 설명할 수 있는 검증 제약 |

validator가 없으면 입력 파라미터, 요청과 응답 모델, 오류 상태 코드를 추정하지 않습니다. OpenAPI 형식에 필요한 최소 응답 자리와 타입을 지정하지 않은 경로 변수 자리는 유지합니다.

`SchemaDescriber`가 없는 validator도 기존 path 래퍼의 타입과 `query.Pagination`의 page, size, 기본값은 설명할 수 있습니다. DTO 상세 입력 설명에 `SchemaDescriber`가 필요합니다.

입력 필수 여부는 validator 계약을 따릅니다. 포인터나 `json:",omitempty"`만으로 required를 결정하지 않습니다. 경로 구간은 항상 필수이며 경로 포인터도 optional 또는 nullable 입력을 뜻하지 않습니다.

지원하지 않는 사용자 규칙과 동적 값은 `x-spine-diagnostics`로 한계를 남깁니다. 기존 `query.Values`와 `header.Values`가 함수 안에서 조회할 키를 추측하지 않습니다. `query.Pagination`은 선언된 page와 size를 설명하지만 다른 기존 입력과 함께 Deprecated로 유지합니다.

`httpx.Response[T]`의 T는 응답 본문 타입을 설명합니다. 핸들러가 선택하는 상태 코드와 오류 분기는 실행 없이 확정할 수 없으므로 `default`로 남깁니다. validator가 등록된 명세에서 요청 본문이나 입력 파라미터가 있으면 프레임워크 바인딩과 DTO 검증 실패를 나타내는 `400` 응답도 추가합니다. 핸들러 안에서 적용한 기본값도 자동 명세에 보충하지 않습니다.

## Swagger UI와 ReDoc 제공 {#tools}

`v0.7.0-preview.2`부터 기존 `boot.Options.HTTP.OpenAPI`에 `UI`를 추가해 문서 화면을 선택합니다. `Enabled: true`와 UI 등록을 함께 지정하세요. JSON만 제공하려면 `UI`를 생략합니다. 코어 버전을 명시적으로 고정하고 HTTP 플랫폼은 기존 미리보기 태그를 사용합니다.

```bash
go get github.com/NARUBROWN/spine@v0.7.0-preview.2 github.com/NARUBROWN/spine-echo-platform@v0.2.0-preview.1
```

다음은 사용할 UI를 등록하는 독립 앱의 `main.go` 예제입니다. 기존 앱에는 import와 `OpenAPI.UI` 설정을 현재 composition에 반영하세요.

```go
package main

import (
    "log"

    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Hello() httpx.Response[string] {
    return httpx.Response[string]{Body: "hello"}
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(func() *Controller { return &Controller{} })
    app.Route("GET", "/hello", (*Controller).Hello)

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

앱을 실행하면 `/openapi.json`, `/docs`, `/redoc`을 제공합니다. Swagger UI만 사용하려면 ReDoc의 import와 등록을 생략하세요. `go:embed`로 선택한 UI의 JS, CSS와 라이선스 고지를 바이너리에 포함하므로 기본 UI 자산을 제공할 때 CDN, npm이나 별도 정적 파일 디렉터리가 필요하지 않습니다.

### UI별 옵션 {#ui-options}

| 옵션 | Swagger UI 기본값 | ReDoc 기본값 | 의미 |
| --- | --- | --- | --- |
| `Path` | `/docs` | `/redoc` | 문서 화면의 정적 절대 경로 |
| `Title` | `API documentation` | `API reference` | 브라우저 탭 제목. 명세의 `info.title`은 `OpenAPIOptions.Title`로 지정 |

명세 주소는 공통 `OpenAPIOptions.Path`로 지정합니다. 문서와 자산 경로는 `HTTP.GlobalPrefix`와 독립적이며 자산과 재배포 고지는 각 UI 경로 아래의 `/_assets/`에서 제공합니다. 상대 URL을 사용하므로 프록시가 외부 접두사를 제거해 전달하는 배치도 지원합니다.

문서와 자산은 GET과 HEAD로 제공하며 Spine 업무 인터셉터를 실행하지 않습니다. HTTP 서버 미들웨어는 적용됩니다. 접근을 제한하려면 JSON 명세, UI와 자산 경로를 같은 프록시 접근 정책으로 보호하세요. Swagger에서 실행한 API 요청에는 원래 API의 인터셉터가 적용됩니다.

### UI 제공자 계약과 준비 {#ui-provider}

두 패키지의 `New`는 다음 `boot.OpenAPIUI` 타입을 반환합니다. 리소스 본문은 문자열입니다.

```go
type OpenAPIResource struct {
    Path        string
    ContentType string
    Body        string
}

type OpenAPIUI func(documentPath string) ([]OpenAPIResource, error)
```

`Prepare`와 `Run`은 사전 검사에서 각 UI 제공자를 한 번 호출하고, 검증한 리소스를 그대로 HTTP 어댑터에 연결합니다. 별도로 `Validate`를 호출하면 그 호출에서도 제공자를 실행하며 이후 준비에서 다시 검사합니다. 사용자 정의 제공자는 외부 연결이나 사용자 핸들러 실행 없이 정적 리소스를 반환해야 합니다.

기존 GET, HEAD 또는 WebSocket 라우트와 문서 및 자산 경로가 겹치면 `OPENAPI_PATH_CONFLICT`로 준비를 거부합니다. nil 제공자나 잘못된 UI 옵션은 `OPENAPI_UI_INVALID`, 잘못된 리소스 경로나 Content-Type은 `OPENAPI_UI_RESOURCE_INVALID`입니다.

안정 버전 `v0.6.5`의 별도 UI 구성은 [Swagger와 OpenAPI 튜토리얼](/ko/learn/tutorial/8-swagger)을 참고하세요. 입력 모델은 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview), 안정 버전 API는 [spine.App](/ko/reference/api/spine-app)에서 확인하세요.
