# Swagger와 OpenAPI 문서

::: warning v0.7.0 미리보기 입력 API 전환
이 페이지의 기존 API 설명과 예제는 안정 버전 `v0.6.5` 기준입니다. `v0.7.0-preview.1`부터 출처별 Path, Query, Header DTO를 지원하며 `query.Values`, `header.Values`와 해당 생성/조회 API, `query.Pagination`, `path.Int`, `path.String`, `path.Boolean`은 Deprecated입니다.

새 DTO 방식은 `v0.6.5`에 그대로 적용할 수 없습니다. 미리보기에서도 한 핸들러 안에서 새 DTO와 Deprecated 입력을 혼용하면 부팅 시 거부합니다. 기존 본문 DTO와 context는 계속 함께 사용할 수 있습니다.

적용 버전과 전환 예제는 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview), 명세 옵션은 [런타임 OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

CLI로 OpenAPI 파일을 내보내고, 필요하면 Swaggo 문서와 Swagger UI를 추가해 브라우저에서 요청을 보냅니다. CLI의 정적 OpenAPI 내보내기와 Swaggo를 사용하는 UI 구성은 각각 진행합니다.

이 페이지의 기능별 `src/user` 예제는 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 `--layout legacy`로 생성한 `my-app`을 기준으로 합니다. CLI `v0.4.2`의 기본 `new`는 역할별 `layered-v1` 구조를 생성합니다. 두 레이아웃 모두 Spine `v0.6.5`와 Echo 플랫폼 `v0.1.0`을 사용합니다.

[첫 번째 앱](/ko/learn/tutorial/1-project-structure)에서 만든 `example.com/my-app` 프로젝트를 사용합니다. [컨트롤러](/ko/learn/tutorial/2-controller)의 `spine generate resource user`로 `src/user`를 먼저 생성하세요. 다른 모듈 경로를 사용했다면 아래 import 경로의 `example.com/my-app` 부분만 해당 모듈 경로로 바꾸고 `/docs` 접미사는 유지합니다. 명령은 프로젝트 루트에서 실행합니다.

## CLI로 OpenAPI 내보내기

CLI는 등록된 경로와 핸들러 시그니처에서 OpenAPI 3.1 문서를 생성합니다.

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

생성된 `openapi.json`에서 `/health`와 `/user/{id}`를 확인합니다. Spine의 `/user/:id`는 OpenAPI에서 `/user/{id}`로 표현되며, `x-spine-*` 필드에는 분석 근거와 한계가 기록됩니다. 예를 들어 실행 중에 선택하는 응답 상태 코드는 정적 분석만으로 확정할 수 없습니다.

이 명령은 문서 파일만 생성합니다. Swagger UI가 필요하면 다음 단계를 진행하세요. 기존 파일을 교체할 때는 내용을 확인한 뒤 `--force`를 사용합니다.

## 선택: Swaggo와 Swagger UI

Swaggo로 Swagger 2.0 문서를 만들고 Echo 전송 계층에 UI 경로를 추가합니다. 파일과 등록 코드는 직접 작성합니다. CLI의 `openapi.json`과 Swaggo의 `docs/swagger.json`은 서로 다른 문서이므로 각각 갱신해야 합니다.

### 1. 도구 설치

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. API 기본 정보 추가

`internal/application/application.go`의 `BuildApplication()` 바로 위에 다음 주석을 추가합니다. 생성된 `main.go`와 `spine.toml`의 `composition = "./internal/application"` 설정은 유지합니다.

```go
// @title Hello Spine API
// @version 1.0.0
// @description Spine HTTP API
// @host localhost:8080
// @BasePath /
func BuildApplication() (spine.App, boot.Options, error) {
    // ...
}
```

### 3. GET 핸들러 문서화

생성된 `src/user/user_controller.go`를 다음 코드로 교체합니다. `UserIDResponse`는 응답 스키마를 문서화하기 위해 추가한 타입입니다. 이 핸들러는 경로의 ID를 반환하며, `/user/1`의 응답 JSON은 기존과 같은 `{"id":1}`입니다. DB에서 사용자를 조회하지는 않습니다.

```go
package user

import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct{ service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

type UserIDResponse struct {
    ID int64 `json:"id" example:"1"`
}

// Get godoc
// @Summary Get user ID
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} UserIDResponse
// @Router /user/{id} [get]
func (c *UserController) Get(id path.Int) httpx.Response[UserIDResponse] {
    return httpx.Response[UserIDResponse]{Body: UserIDResponse{ID: id.Value}}
}
```

### 4. docs 패키지를 먼저 생성

다음 명령으로 문서 패키지를 생성합니다. 생성 전에는 아직 존재하지 않는 `example.com/my-app/docs`를 import하지 마세요. `--parseInternal`은 API 기본 정보가 있는 internal 패키지도 읽도록 지정합니다.

```bash
swag init -g internal/application/application.go --parseInternal
```

`docs/docs.go`, `docs/swagger.json`, `docs/swagger.yaml`이 생성됩니다. `docs.go`의 `init` 함수가 문서를 등록하므로 다음 단계에서 이 패키지를 부수 효과용 import로 추가합니다. 생성 파일은 직접 수정하지 않습니다.

### 5. UI 연결

`internal/application/application.go`의 import 블록에 추가합니다.

```go
import (
    _ "example.com/my-app/docs"
    "github.com/labstack/echo/v5"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

Echo 확장은 플랫폼 생성 시 `*echo.Echo` 타입을 받는 `WithEcho` 옵션으로 등록합니다. 아래 코드로 기존 `app := spine.New(echoplatform.Option())`를 교체하고 기존 생성자와 라우트 등록은 이어서 유지합니다. `App.Transport`는 Spine v0.6.0에서 제거되었습니다.

```go
app := spine.New(echoplatform.Option(echoplatform.WithEcho(func(e *echo.Echo) {
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})))
```

### 6. 검증하고 실행

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

브라우저에서 `http://localhost:8080/swagger/index.html`을 열어 GET 경로가 표시되는지 확인합니다. `/swagger/doc.json`에서는 생성한 Swagger 2.0 문서가 반환되어야 합니다. UI의 Try it out으로 `/user/1`에 요청하면 HTTP 200과 `{"id":1}`이 반환됩니다.

플랫폼 옵션으로 추가한 native Echo 경로는 Spine의 HTTP 인터셉터와 응답 staging을 거치지 않으며 CLI의 정적 Spine 라우트 계약에도 포함되지 않습니다. 실제 경로는 별도로 확인하세요.

## 기능 확장에 사용할 주석과 DTO

아래 태그와 DTO는 기능을 추가할 때 참고할 예시입니다. `resource` 생성기는 이 요청과 응답 타입이나 POST, PUT, DELETE 핸들러를 생성하지 않습니다. `src/user`의 `package user`에 필요한 타입을 추가하고, 실제 라우트와 응답 상태 코드에 맞게 주석을 작성하세요.

요청 DTO는 핸들러에서 포인터로 받습니다. `example`, `enums`, `minimum` 등의 태그는 문서에 사용할 정보이며 입력 검증을 자동 실행하지 않습니다.

### 기본 주석 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@Summary` | 한 줄 요약 | `사용자 조회` |
| `@Description` | 상세 설명 | `ID로 사용자 정보를 조회합니다` |
| `@Tags` | 그룹 태그 | `users` |
| `@Router` | 경로와 메서드 | `/user [get]` |

### 요청 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@Accept` | 요청 Content-Type | `json` |
| `@Produce` | 응답 Content-Type | `json` |
| `@Param` | 파라미터 정의 | `id query int true "User ID"` |

### 응답 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@Success` | 성공 응답 | `200 {object} UserResponse` |
| `@Failure` | 실패 응답 | `404 {object} ErrorResponse` |


## 요청 파라미터 지정

```
@Param [이름] [위치] [타입] [필수여부] "[설명]"
```

### 파라미터 위치

| 위치 | 설명 | 예시 |
|------|------|------|
| `query` | 쿼리 문자열 | `/user?id=1` |
| `path` | URL 경로 | `/user/{id}` |
| `body` | 요청 본문 | JSON 객체 |
| `header` | 헤더 | `Authorization` |
| `formData` | 폼 데이터 | 파일 업로드 |

### 타입

| 타입 | 설명 |
|------|------|
| `int`, `integer` | 정수 |
| `string` | 문자열 |
| `bool`, `boolean` | 불리언 |
| `number` | 실수 |
| `object` | 객체 (DTO) |
| `array` | 배열 |

### 예시

```go
// 쿼리 파라미터
// @Param id query int true "User ID"
// @Param name query string false "User name"
// @Param active query bool false "Active status"

// 요청 본문
// @Param body body CreateUserRequest true "유저 생성 요청"

// 헤더
// @Param Authorization header string true "Bearer 토큰"
```


## DTO 문서화

### 요청 DTO

```go
// src/user/user_request.go
package user

// CreateUserRequest 유저 생성 요청
type CreateUserRequest struct {
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// UpdateUserRequest 유저 수정 요청
type UpdateUserRequest struct {
    Name  string `json:"name" example:"Alice Updated"`
    Email string `json:"email" example:"alice.new@example.com"`
}
```

### 응답 DTO

```go
// src/user/user_response.go
package user

// UserResponse 유저 응답
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
    Message string `json:"message" example:"유저를 찾을 수 없습니다."`
}
```

### DTO 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `example` | 예시 값 | `example:"Alice"` |
| `enums` | 허용 값 목록 | `enums:"active,inactive"` |
| `minimum` | 최소값 | `minimum:"1"` |
| `maximum` | 최대값 | `maximum:"100"` |
| `default` | 기본값 | `default:"10"` |



## 문서 다시 생성하기

주석이나 DTO를 변경하면 Swaggo 문서를 다시 생성해야 합니다. `spine dev`는 Swaggo를 자동 실행하지 않습니다. 다음 Makefile을 추가하면 `make run`으로 문서를 갱신한 뒤 앱을 실행할 수 있습니다. CLI의 OpenAPI 파일은 `spine contract export`로 따로 갱신합니다.

```makefile
.PHONY: swagger run

swagger:
	swag init -g internal/application/application.go --parseInternal

run: swagger
	spine dev
```

## 다음 단계

- [Spine API](/ko/reference/api/spine-app)
- [Swaggo v1.16.6](https://github.com/swaggo/swag/tree/v1.16.6)
- [http-swagger v1.3.4](https://pkg.go.dev/github.com/swaggo/http-swagger@v1.3.4)
