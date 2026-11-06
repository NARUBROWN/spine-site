# v0.7.0 미리보기 기능과 부팅 옵션

Swagger UI와 ReDoc을 부팅 옵션으로 켜고, HTTP v3와 net/http 플랫폼으로 전환할 때 필요한 변경을 확인합니다. 이번에 미리보기 브랜치에 병합된 경로 처리, 종료 처리와 이벤트 정리 이력 변경도 함께 정리합니다.

::: warning 미리보기 전용
이 페이지는 `preview` 브랜치 기준이며 정식 `v0.6.5`에 그대로 적용할 수 없습니다. 기능이 처음 공개된 버전과 현재 브랜치 변경을 구분합니다. `@preview`는 이동하므로 실행한 앱의 `go.mod`, `go.sum`과 소스를 함께 보관하세요.
:::

## 적용 버전과 설치 {#versions}

| 기능 | 최초 공개 버전 |
| --- | --- |
| 출처별 입력 DTO와 OpenAPI JSON | Spine `v0.7.0-preview.1` |
| 임베드 Swagger UI와 ReDoc | Spine `v0.7.0-preview.2` |
| HTTP v3, TLS와 net/http 플랫폼 | Spine `v0.7.0-preview.3`, Echo `v0.2.0-preview.2`, net/http `v0.1.0-preview.1` |
| HTTP v3 분석과 net/http 앱 생성 및 업데이트 | CLI `v0.4.3-preview.4` |

Go 1.25.5 이상이 필요합니다. playground 검증기를 선택하면 Go 1.26 이상이 필요합니다. `--platform nethttp`로 net/http를 선택할 수도 있습니다. 기본 Go 프록시 설정에서는 미리보기 브랜치 메타데이터를 원본에서 조회하므로 Git이 필요합니다. CLI 설치와 앱 의존성 갱신은 별개입니다.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
spine new preview-api --module example.com/preview-api --platform echo
cd preview-api
spine contract check
spine verify
```

기존 앱은 [입력 전환 안내](/ko/learn/migration/v0.7.0-preview#versions)에 따라 `recipe = "platform-contracts-preview"`를 선택합니다. `spine update --dry-run`의 변경 내용을 검토한 뒤 출력에 안내된 적용 명령을 실행하세요. `update`는 앱 소스를 고치지 않으므로 아래 부팅 옵션과 Prepared API는 직접 반영합니다.

## Swagger UI와 ReDoc 부팅 옵션 {#boot}

::: warning net/http 문서 UI의 현재 제한
2026-11-06 확인: 코어 `83b1e03`과 net/http `v0.1.0-preview.2` 조합은 문서와 자산의 Content-Type을 `text/plain`으로 덮어써 Swagger UI와 ReDoc이 정상 렌더링되지 않습니다. 아래 UI 실행 예제는 Echo `v0.2.0-preview.3` 조합을 기준으로 합니다.
:::

다음은 독립 참고 앱의 `main.go`입니다. 먼저 위 CLI로 의존성을 준비한 별도 디렉터리에서 실행하세요. 기존 앱에서는 현재 composition과 `BuildApplication`에 import와 `HTTP.OpenAPI` 설정을 반영합니다.

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
        EnableGracefulShutdown: true,
        HTTP: &boot.HTTPOptions{
            MaxBodyBytes:         32 << 20,
            MultipartMemoryBytes: 8 << 20,
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Path:    "/openapi.json",
                Title:   "Preview API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{Path: "/docs"}),
                    redoc.New(redoc.Options{Path: "/redoc"}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

`Enabled`의 기본값은 `false`입니다. `Enabled: true`만 지정하면 `/openapi.json`을 제공하고, `UI`에 등록한 화면만 추가합니다. Swagger UI는 `/docs`, ReDoc은 `/redoc`이 기본 경로이며 각 UI의 `Path`와 `Title`을 바꿀 수 있습니다. 두 화면과 자산은 바이너리에 포함되어 CDN이나 npm 없이 제공합니다.

명세, UI와 자산 경로는 `GlobalPrefix`와 독립적이며 GET과 HEAD를 지원합니다. 업무 인터셉터를 실행하지 않으므로 접근 제한이 필요하면 HTTP 서버 미들웨어나 프록시에 설정합니다. 위 예제는 검증기를 등록하지 않아 명세가 경로와 메서드 중심입니다. DTO 상세 명세는 `SchemaDescriber`를 지원하는 검증기를 등록하세요. 동적 응답 상태는 `default`로 남습니다. [전체 OpenAPI 옵션](/ko/reference/api/openapi#options)을 참고하세요.

## 관리 서버의 TLS {#tls}

`boot.HTTPOptions.TLS`에 `*tls.Config`를 전달하면 관리 서버를 HTTPS로 실행합니다. 아래 함수는 `spine`, `boot`와 표준 `crypto/tls` import가 필요합니다.

```go
func runTLS(app spine.App) error {
    certificate, err := tls.LoadX509KeyPair("server.crt", "server.key")
    if err != nil {
        return err
    }
    return app.Run(boot.Options{
        Address: ":8443",
        HTTP: &boot.HTTPOptions{
            TLS: &tls.Config{Certificates: []tls.Certificate{certificate}},
        },
    })
}
```

`TLS: nil`은 평문 HTTP입니다. 준비 단계는 인증서와 지원 기능을 검사하고 설정을 복사합니다. `Serve(listener)`는 준비한 TLS 설정을 사용하며 `Serve(listener, httpcontract.WithTLS(config))`로 바꿀 수 있습니다. `httpcontract`는 `github.com/NARUBROWN/spine/contract/http`입니다. 마지막 옵션이 우선하고 `WithTLS(nil)`은 오류입니다. 외부 `http.Server`에 핸들러만 연결하면 TLS 실행과 서버 종료는 외부 소유자가 담당합니다. 이 변경에서 HTTP 버전 선택과 ALPN 정책을 추가하지는 않았습니다.

## HTTP v3 입력과 파일 수명 {#body}

HTTP v3에서는 코어가 JSON, XML, urlencoded form과 multipart를 공통으로 해석합니다. 경로와 쿼리는 본문 DTO에 합치지 않습니다. 인증 인터셉터 뒤에 필요한 DTO를 파싱하고, 바인딩한 DTO별로 검증합니다.

`MaxBodyBytes: 0`은 전체 본문 한도 32 MiB, 양수는 지정한 바이트 한도, 음수는 제한 해제입니다. `MultipartMemoryBytes: 0`은 파일 메모리 예산 32 MiB, 양수는 지정한 예산, 음수는 준비 오류입니다. multipart 예산은 전체 요청 메모리의 상한이 아니며 초과 파일은 디스크로 넘깁니다.

폼 DTO와 업로드 파일은 같은 multipart 결과를 공유합니다. 파일은 모든 `AfterCompletion`이 끝날 때까지 유효하며 이후 임시 파일을 제거합니다. 요청 이후에 쓸 파일은 완료 훅이 끝나기 전에 별도로 저장하세요. Spine DTO 입력은 Echo Binder, JSONSerializer와 `UnmarshalParam` 확장을 호출하지 않습니다. 표준 JSON, XML 또는 Text 디코더로 옮기거나 native Echo 라우트에서 사용합니다. Echo 응답 출력 확장은 유지합니다.

## 외부 서버와 사용자 HTTP 어댑터 전환 {#prepared}

`PreparedApplication.Handler()`는 `spine.NetHTTPHandler(prepared)`로 바꿉니다. 이 함수는 `(http.Handler, error)`를 반환합니다. `prepared.HTTPAdapter()`는 준비한 동일 어댑터를 반환하며 HTTP가 꺼져 있으면 nil입니다. 어댑터의 실행과 종료를 중복 호출하지 마세요. 외부 서버 종료와 `prepared.Close(ctx)`는 호출자가 관리합니다. Close는 새 진입을 차단하고 WebSocket과 native 미들웨어 후처리를 포함한 요청을 정리합니다. 대기 context가 만료돼도 정리는 계속됩니다.

사용자 HTTP 플랫폼은 `spine.http-adapter/v3`로 이행해야 합니다. `Serve(net.Listener, ...httpcontract.ServeOption) error`와 TLS capability를 반영하세요. `adapter`, `adapter/http` 별칭은 v2 구현을 자동 변환하지 않습니다. net/http 플랫폼은 독립 모듈이며 `DisableRecover: true`를 지원하지 않습니다. [전체 HTTP v3 이행 안내](https://github.com/NARUBROWN/spine/blob/preview/docs/migration/http-v3.md)를 참고하세요.

## 이번 병합의 추가 변경 {#merged}

위 추가 변경은 [코어 PR #34](https://github.com/NARUBROWN/spine/pull/34)의 병합 소스 기준입니다. 그 소스의 다음 후보는 `v0.7.0-preview.5`이며, 후보 번호만으로 해당 태그의 발행이나 전체 릴리스 완료를 주장하지 않습니다.

- 경로 값: `/users/:id`와 `/users/:userID/posts`가 각 라우트의 키로 바인딩됩니다. `/files/:name`에서 `a%2Fb`는 `a/b`, `a%252Fb`는 `a%2Fb`로 한 번만 디코딩합니다. 실제 `/files/a/b`는 같은 라우트에 매칭되지 않습니다.
- 종료: WebSocket 정리 패닉 뒤에도 후속 앱 자원을 정리하며, HTTP의 실제 Serve 오류를 정상 종료로 숨기지 않습니다.
- 이벤트: `spine.WithEventPublisherErrorHistory`와 `spine.WithEventConsumerErrorHistory`에 `boot.CleanupErrorHistoryOptions{MaxEntries, MaxAge}`를 전달해 역할별 정리 실패 이력을 설정합니다. 기본값은 최근 32건과 최대 1시간이며 먼저 도달한 한도를 적용합니다. 0은 기본값, 음수는 사전 검사 오류입니다. 로그 보관 정책과 이미 반환한 종료 결과는 바꾸지 않습니다. 새 helper를 인식하는 CLI 정적 분석 보완은 후속입니다.
- nil 이벤트 본문: raw byte 핸들러는 nil tombstone과 길이 0인 nonnil slice를 구분합니다. 본문이 필요한 DTO의 실패 정책은 유지합니다.
- Swagger UI: base64url, 지수 표기의 multipleOf와 items 없는 contains 예제 생성 회귀를 수정했습니다.
- 릴리스 조합: net/http를 포함한 여섯 플랫폼을 검증합니다. 코어 태그 하나나 소스 CI 통과만으로 전체 공개 조합의 검증 완료를 뜻하지 않습니다.

## 요청으로 확인하기 {#verify}

독립 참고 앱은 `go run main.go`로 실행합니다. `/hello`는 HTTP 200, 명세와 두 UI의 HEAD 요청도 200이어야 합니다. 브라우저에서는 `/docs`와 `/redoc`을 열어 렌더링을 확인하세요. CLI의 생성 앱은 현재 엔트리포인트를 실행하므로 `BuildApplication`에 같은 옵션을 반영한 경우 `spine run`을 사용합니다.

```bash
curl -i http://localhost:8080/hello
curl -I http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

## 관련 문서와 병합 근거 {#sources}

- [OpenAPI](/ko/reference/api/openapi)
- [v0.7.0](/ko/learn/migration/v0.7.0-preview)
- [Preview → RC → Production](/ko/community/release-channels)
- [Spine #26: OpenAPI UI](https://github.com/NARUBROWN/spine/pull/26)
- [Spine #32: HTTP v3 / TLS](https://github.com/NARUBROWN/spine/pull/32)
- [Spine #33: Preview](https://github.com/NARUBROWN/spine/pull/33)
- [Spine #34: Preview](https://github.com/NARUBROWN/spine/pull/34)
- [Spine CLI #39: HTTP v3 / net/http](https://github.com/NARUBROWN/spine-cli/pull/39)
