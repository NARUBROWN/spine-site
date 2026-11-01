# Swagger와 OpenAPI 문서

[첫 번째 앱](/ko/learn/getting-started/first-app)에서 CLI로 생성한 프로젝트를 사용합니다. `src/user`는 [컨트롤러](/ko/learn/tutorial/2-controller)의 `spine generate resource user`로 생성합니다. CLI의 정적 OpenAPI 내보내기와 Swaggo·Swagger UI 통합은 별도 기능입니다.

## CLI로 OpenAPI 내보내기

CLI는 등록된 경로와 핸들러 시그니처에서 OpenAPI 3.1 문서를 생성합니다. Swaggo 주석은 필요하지 않습니다.

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

생성 파일에는 `/health`, `/user/{id}`와 `x-spine-*` 분석 근거가 포함됩니다. Spine의 `/user/:id`는 OpenAPI에서 `/user/{id}`로 표현됩니다. 실행 중 선택하는 status 등은 정적 분석의 한계로 표시됩니다. 내보내기는 Swagger UI를 설치하거나 HTTP 경로에 마운트하지 않습니다. 기존 파일을 교체할 때만 내용을 확인한 뒤 `--force`를 사용하세요.

## 선택: Swaggo와 Swagger UI

아래는 Swaggo로 별도의 Swagger 2.0 문서를 만들고 Echo transport에 UI를 직접 연결하는 예제입니다. CLI가 자동 구성하지 않습니다. CLI의 `openapi.json`과 Swaggo의 `docs/swagger.json`은 서로 다른 생성물입니다.

### 1. 도구 설치

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. 일반 주석 추가

`internal/application/application.go`의 `BuildApplication()` 바로 위에 추가합니다. 생성된 main과 `spine.toml`의 `composition = "./internal/application"` 설정은 유지합니다.

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

### 3. 실제 조회 핸들러 문서화

생성된 `src/user/user_controller.go`를 다음과 같이 직접 확장합니다. `UserIDResponse`는 문서화를 위해 추가한 타입이며 응답 JSON은 기존 `{"id":1}`과 같습니다. DB 조회나 전체 CRUD는 구현하지 않습니다.

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

프로젝트 루트에서 실행합니다. 이 단계 전에는 아직 존재하지 않는 `example.com/hello-spine/docs`를 import하지 마세요. `--parseInternal`은 일반 주석이 있는 internal 패키지를 읽도록 지정합니다.

```bash
swag init -g internal/application/application.go --parseInternal
```

`docs/docs.go`, `docs/swagger.json`, `docs/swagger.yaml`이 생성됩니다. `docs.go`의 init 함수가 스펙을 등록하므로 생성 후 blank import가 필요합니다. 생성 파일은 직접 수정하지 않습니다.

### 5. UI 연결

`internal/application/application.go`의 import 블록에 추가합니다.

```go
import (
    _ "example.com/hello-spine/docs"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

같은 파일의 `BuildApplication()`에서 `app := spine.New()` 이후, return 이전에 추가합니다. 기존 health·user 등록을 유지하세요.

```go
app.Transport(func(transport any) {
    e := transport.(*echo.Echo)
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})
```

### 6. 검증하고 실행

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
spine contract check
spine verify
spine dev
```

다른 터미널에서 `http://localhost:8080/swagger/index.html`과 `/swagger/doc.json`을 확인합니다. UI의 Try it out도 실제 `/user/1`에 요청해야 합니다. `app.Transport`로 직접 추가한 Echo 경로는 CLI의 정적 Spine 라우트 계약에 포함되지 않으므로 UI 경로는 따로 확인합니다.

## 수동 CRUD 확장의 주석·DTO 레퍼런스

아래 태그와 DTO는 추가 기능을 구현할 때 사용하는 참고 예시입니다. `resource` 생성기가 이 요청/응답 타입이나 POST·PUT·DELETE 핸들러를 생성하지는 않습니다. `src/user`의 같은 `package user`에 추가하고 실제 라우트·반환 status와 주석을 맞추세요. 요청 DTO는 핸들러에서 포인터로 받습니다. `example`·`enums`·`minimum` 등은 문서 메타데이터이며 입력 검증을 자동 실행하지 않습니다.

## 주석 태그 레퍼런스

### 기본 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@Summary` | 요약 (한 줄) | `유저 조회` |
| `@Description` | 상세 설명 | `ID로 유저 정보를 조회합니다` |
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


## @Param 형식

```
@Param [이름] [위치] [타입] [필수여부] "[설명]"
```

### 위치 (in)

| 위치 | 설명 | 예시 |
|------|------|------|
| `query` | 쿼리 스트링 | `/user?id=1` |
| `path` | URL 경로 | `/user/{id}` |
| `body` | 요청 본문 | JSON body |
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

주석이나 DTO를 변경하면 Swaggo 문서를 다시 생성합니다. `spine dev`는 Swaggo를 자동 실행하지 않습니다. CLI 스펙은 `contract export`로 따로 갱신합니다.

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
