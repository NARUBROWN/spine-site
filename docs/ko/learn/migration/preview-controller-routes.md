# Preview 컨트롤러와 라우트 전환

이 안내는 Spine `v0.7.0-preview.7`과 CLI `v0.4.3-preview.8` 기준입니다. 정식 `v0.6.5`에는 적용되지 않습니다. 코어는 Go 1.25.5 이상, playground 검증기는 Go 1.26 이상이 필요합니다. 전체 플랫폼 조합의 승격 여부는 별도 확인하세요.

## 컨트롤러에 라우트 등록 {#routes}

기존 `app.Route`와 생성자 함수, 별도 route.go 및 메서드 표현식을 사용하는 HTTP 컨트롤러 방식은 Preview에서 Deprecated입니다. 전환 기간에 계속 동작하며 제거 버전은 미정입니다. 일반 DI 생성자 함수 자체는 Deprecated가 아닙니다.

다음 코드는 독립 실행 앱이 아닌 등록 예제입니다. 앱에 HTTP 플랫폼과 실행 설정을 추가하세요.

```go
import (
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type UserPath struct { ID int64 `path:"id"` }
type User struct { ID int64 `json:"id"` }

func (*UserController) Constructor() *UserController { return &UserController{} }

func (c *UserController) RegisterRoutes(r *api.Registry) {
    users := r.Group("/users", api.Tags("Users"))
    users.GET("/:id", api.Options(api.Summary("Get user")),
        func(p input.Path[UserPath]) httpx.Response[User] {
            return httpx.Response[User]{Body: User{ID: p.ID}}
        })
}

func register(app interface{ Constructor(...any) }) {
    app.Constructor(constructor.Controller(&UserController{}))
}
```

기존 메서드의 로직을 유지하고 콜백에서 호출해도 됩니다. 기존 라우트와 새 라우트를 한 앱에서 함께 사용할 수 있지만 같은 메서드와 경로를 중복 등록하면 준비 단계에서 거부합니다. 옮긴 경로의 기존 등록을 제거하세요. `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`를 지원합니다.

## 생성자와 역할 {#constructors}

`app.Constructor`는 `constructor.Custom`, `Repository`, `Service`, `Controller`, `Interceptor` 역할 표식과 기존 생성자 함수를 받습니다. 객체 표식은 구조체 포인터이며 비가변 `Constructor(의존성...) *자기타입` 메서드를 정의합니다. 표식의 필드는 복사되지 않고 실제 생성 결과는 앱별로 캐시됩니다. `Custom`은 기존 단일 반환 생성자 함수도 받습니다.

Controller는 `api.Controller`의 `RegisterRoutes(*api.Registry)`를, Interceptor는 `core.Interceptor`를 추가로 구현합니다. 인터셉터 등록은 DI 등록이며 전역 또는 경로별 적용을 별도로 지정해야 합니다. 생성 계약과 의존성 그래프 오류는 시작 전에 검사합니다. 생성자의 nil 반환과 패닉은 실제 생성 시 확인합니다.

## 입력과 그룹 {#groups}

`input.Path[T]`, `input.Query[T]`, `input.Body[T]`의 `T`는 구조체입니다. 경로와 쿼리는 해당 태그가 우선이며 태그가 없으면 lowerCamel 이름을 사용합니다. 헤더는 별도 `header` 태그 구조체 포인터로 받습니다. 본문, 경로, 쿼리, 헤더를 출처별로 분리하세요.

그룹 메서드는 경로, `api.Options(...)`, 핸들러 순서입니다. 옵션이 없어도 `api.Options()`를 전달합니다. 그룹 밖 `r.GET(path, handler, options...)`와 순서가 다릅니다. 그룹은 접두사와 태그를 상속하고 `api.Interceptors(...)`로 인터셉터를 더할 수 있습니다. `example`과 `description` 태그는 문서용이며 런타임 기본값이나 검증 규칙이 아닙니다.

## 폐기 예정 입력과 호환성 {#deprecated}

`path.Int`, `path.String`, `path.Boolean`, `query.Values`, `header.Values`, 각 Values의 생성과 조회 API, `query.Pagination`은 Deprecated입니다. 한 핸들러에서 이 입력과 새 Path, Query, Header DTO를 섞으면 준비 단계에서 거부합니다. 기존 본문 DTO와 context는 계속 사용할 수 있습니다. `adapter`, `adapter/http`, `adapter/event`, `adapter/websocket` 호환 경로도 Deprecated이며 구현별 `contract/http`, `contract/event`, `contract/validator`, `contract/websocket`을 사용합니다. 기존 HTTP v2 구현이 자동으로 v3으로 바뀌지는 않습니다.

## 명세와 검증 {#verification}

새 컨트롤러가 있는 앱은 준비 전 `spine.DescribeHTTP`가 `spine.ErrRoutesNotCollected`를 반환합니다. 호출자가 `app.Prepare`를 수행한 후 `spine.DescribePreparedHTTP`로 조회하고 준비 결과를 닫습니다. 준비 과정은 설정에 따라 DB나 브로커를 초기화할 수 있습니다. CLI의 정적 분석은 사용자 코드를 실행하지 않으며 동적 경로와 인터셉터 목록을 완전히 해석하지 못할 수 있습니다. `--source runtime`도 새 컨트롤러를 위해 자동으로 Prepare하지 않습니다.

정적 OpenAPI는 검증기를 실행하지 않아 제약을 확정하지 않습니다. 실제 검증기를 반영한 명세는 준비된 앱에서 확인하세요. 지원하지 않는 예시나 검증 규칙은 진단될 수 있으며 이메일, URI, UUID, 정규식의 동등성을 단정할 수 없습니다. 정수 범위는 명세에 정확히 유지됩니다.

전환 후 `spine contract check`과 `spine verify`을 실행하고 실제 HTTP 요청 및 명세를 확인하세요. 입력 전환과 HTTP v3의 추가 제한은 다음 문서를 참고하세요.

- [v0.7.0](/ko/learn/migration/v0.7.0-preview)
- [HTTP v3](/ko/learn/migration/preview-features#body)
