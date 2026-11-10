# 컨트롤러

::: info
기존 `app.Route`는 호환을 위해 유지되지만 Deprecated입니다. 새 앱은 [컨트롤러와 라우트 전환](/ko/learn/migration/preview-controller-routes)을 참고하세요. 이전 입력 API에서의 변경은 [입력 전환](/ko/learn/migration/v0.7.1-preview), 명세 옵션은 [OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

CLI로 만든 `my-app` 프로젝트에 `GET /user/:id` 컨트롤러를 추가하고, 요청 경로의 정수를 JSON 응답으로 반환합니다. 이어서 쿼리, 헤더, 요청 본문을 받는 방법과 응답 타입을 살펴봅니다.

이 페이지의 `src/user` 예제는 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 `--layout legacy`로 생성한 `my-app` 기준입니다. 기본 `layered-v1` 구조는 역할별 디렉터리를 사용합니다.

[첫 번째 앱](/ko/learn/tutorial/1-project-structure)의 설치와 프로젝트 생성을 마친 뒤 프로젝트 루트에서 진행하세요. 이미 `spine generate resource user`를 실행했다면 생성 단계를 건너뛰고 파일을 확인합니다.

## CLI로 컨트롤러 생성

```bash
spine generate resource user --dry-run
```

미리보기에서 생성 파일과 등록 코드 변경을 확인한 뒤 아래 명령으로 생성합니다.

```bash
spine generate resource user
```

### 생성되는 파일

```text
src/user/
├── user_controller.go
├── user_service.go
├── user_repository.go
└── user_route.go
```

생성된 `src/user/user_controller.go`는 경로의 `id`를 받아 `{"id":1}` 형태의 응답을 반환합니다. `UserService`와 같은 `user` 패키지에 있으므로 별도 서비스 패키지를 가져올 필요가 없습니다.

```go
package user

import "github.com/NARUBROWN/spine/pkg/httpx"

type UserPath struct { ID int64 `path:"id"` }

type UserController struct { service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) Get(params *UserPath) httpx.Response[map[string]any] {
    return httpx.Response[map[string]any]{Body: map[string]any{"id": params.ID}}
}
```

::: info
`resource`는 조회 라우트와 의존성 등록을 갖춘 기본 구조를 생성합니다. 데이터베이스, 도메인 모델, 데이터 전달 객체(DTO), 생성이나 수정 기능은 직접 구현해야 합니다.
:::


## v0.7.1 입력과 라우트 실행 예제

다음은 독립 실행 앱입니다. Spine `v0.7.1`과 호환 HTTP 플랫폼이 설치된 별도 Go 모듈의 `main.go`에 저장하고 `go run .`으로 실행하세요. 그룹에 경로, 핸들러, 선택 옵션 순서로 등록합니다. 요청 본문과 경로, 쿼리, 헤더는 별도 입력으로 받습니다.

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

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
	"github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type SearchQuery struct {
	Name string `query:"name"`
}
type RequestHeaders struct {
	RequestID string `header:"X-Request-ID"`
}
type CreateUser struct {
	Name string `json:"name"`
}
type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func (*UserController) Constructor() *UserController { return &UserController{} }
func (c *UserController) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Tags("Users"))
	users.GET("/search", func(q input.Query[SearchQuery], h *RequestHeaders) httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"name": q.Name, "request_id": h.RequestID}}
	})
	users.GET("/id/:id", func(id input.Path[int64]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{ID: *id}}
	}, api.Summary("Get user"))
	users.POST("/create", func(body input.Body[CreateUser]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{Name: body.Name}, Options: httpx.ResponseOptions{Status: 201}}
	})
}

func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&UserController{}))
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

다른 터미널에서 요청합니다. 첫 요청은 이름과 요청 ID를 반환하고, 둘째 요청은 ID를 반환합니다. POST는 201을 반환하며 숫자가 아닌 경로 값은 400입니다.

```bash
curl -H 'X-Request-ID: r1' 'http://localhost:8080/users/search?name=alice'
curl http://localhost:8080/users/id/12
curl -i -H 'Content-Type: application/json' -d '{"name":"bob"}' http://localhost:8080/users/create
curl -i http://localhost:8080/users/id/not-a-number
```


## 생성된 라우트 등록 확인

CLI는 `src/user/user_route.go`에 생성자와 라우트를 등록합니다. `BuildApplication()`에는 `user.Register(app)` 호출과 오류 처리를 추가합니다. 아래 코드는 이미 생성된 등록을 보여 주므로 다시 추가하지 마세요.

```go
// src/user/user_route.go
package user

import "github.com/NARUBROWN/spine"

func Register(app spine.App) error {
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    app.Route("GET", "/user/:id", (*UserController).Get)
    return nil
}
```

```go
// internal/application/application.go: BuildApplication
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`main.go`의 `BuildApplication → Validate → Run` 흐름을 유지합니다. 이후 새 핸들러를 구현하면 해당 패키지의 `Register` 안에 라우트를 추가하세요.

## 생성 결과 검증과 실행

프로젝트 루트에서 계약과 로컬 코드를 검사한 뒤 서버를 실행합니다.

```bash
spine doctor
spine contract check
spine verify
spine dev
```

다른 터미널에서 생성된 라우트를 호출합니다.

```bash
curl http://localhost:8080/user/1
```

`GET /user/1`은 HTTP 200과 `{"id":1}`을 반환해야 합니다. 이 응답은 경로 바인딩과 라우트 실행을 확인하는 결과이며, 데이터베이스에서 사용자를 조회한 결과는 아닙니다. `spine contract check`와 `spine verify`의 성공 여부는 실제 HTTP 응답과 별도로 확인하세요.

## 확장 예제의 전제

이하 코드는 입력과 응답을 확장하는 서로 독립적인 예제입니다. 생성된 앱 전체를 대체하는 코드가 아니며, 같은 이름의 메서드 여러 개를 한꺼번에 붙여 넣으면 중복 선언 오류가 발생합니다. 필요한 핸들러 하나를 선택해 구현하고 라우트에 등록하세요.

`UserResponse`, 요청 DTO, `HeaderInfo`와 서비스의 `Get`, `List`, `Create`, `Login` 등은 각 예제에 맞게 직접 구현해야 합니다. 타입은 해당 컨트롤러와 같은 패키지에 두고 필요한 Go 표준 패키지와 Spine 패키지를 가져오세요. 아래 서비스 호출에서 생략한 오류 처리는 [오류 응답](#error-response)의 예제를 참고해 구현합니다.

## 핸들러 시그니처

Spine은 핸들러의 파라미터 타입에 맞춰 요청 값을 전달합니다. 이를 입력 바인딩이라고 합니다. 반환 타입은 응답을 만드는 방법을 결정합니다.

### 지원하는 파라미터 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `context.Context` | 요청 컨텍스트 | `ctx context.Context` |
| `input.Query[T]` | 쿼리 파라미터 | `q input.Query[SearchQuery]` |
| `*struct` (`header`) | HTTP 헤더 | `headers *RequestHeaders` |
| `*struct` (DTO) | JSON 요청 본문 | `req *CreateUserRequest` |
| `*struct` (폼 DTO) | 폼의 텍스트 필드 | `form *CreatePostForm` |
| `multipart.UploadedFiles` | 멀티파트 업로드 파일 | `files multipart.UploadedFiles` |
| `input.Path[T]` | 경로 파라미터 | `userId input.Path[int64]` |
| `spine.Ctx` | 컨트롤러 컨텍스트 | `spineCtx spine.Ctx` |

### 지원하는 반환 타입

| 타입 | 설명 |
|------|------|
| `httpx.Response[T]` | JSON 또는 문자열 응답 (상태 코드, 헤더, 쿠키 포함) |
| `httpx.Redirect` | 리다이렉트 응답 |
| `error` | 오류 응답 |
| `httpx.Binary` | 바이트 응답 |

응답 타입의 포인터와 `(지원하는 응답 타입, error)` 조합도 사용할 수 있습니다. `httpx.Binary`는 `Content-Type`과 바이트 본문을 지정할 때 사용합니다.


## 입력 받기

### 쿼리 파라미터

위 실행 예제의 `input.Query[SearchQuery]`는 `query` 태그가 지정한 값을 구조체 필드에 바인딩합니다. 태그가 없는 필드는 lowerCamel 이름을 사용합니다.

### 페이지네이션

쿼리 DTO에 `page`, `size` 필드를 선언하고 기본값과 허용 범위를 앱에서 명시적으로 처리하세요.

### HTTP 헤더

`header` 태그가 있는 별도 구조체 포인터로 받습니다. 위 예제의 `RequestHeaders`는 `X-Request-ID`를 읽습니다.

### 경로 파라미터

v0.7.1에서는 경로 변수가 여러 개일 때 스칼라 `input.Path[T]` 인자를 경로에 선언한 순서대로 하나씩 받습니다. 인자 수와 경로 변수 수는 같아야 하며, 스칼라와 경로 DTO 또는 기존 경로 래퍼는 같은 핸들러에서 혼용할 수 없습니다.

```go
r.GET("/:id/:name/:address", func(id input.Path[int64], name input.Path[string], address input.Path[string]) httpx.Response[map[string]any] {
    return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": *name, "address": *address}}
})
```


### JSON 요청 본문

JSON 요청 본문을 받을 DTO는 구조체 포인터로 선언하고 필드에 `json` 태그를 붙입니다. 아래 예제는 `Content-Type: application/json` 요청의 `name`과 `email`을 `CreateUserRequest`에 바인딩한 뒤 HTTP 201로 응답합니다.

DTO에 `form` 태그가 하나라도 있으면 폼 DTO로 분류됩니다. 실제 본문 해석은 요청의 `Content-Type`에도 영향을 받으므로 JSON과 폼의 태그와 요청 형식을 맞추세요.

```go
// POST /user
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← 포인터로 선언
) httpx.Response[UserResponse] {
    user, _ := c.service.Create(ctx, req.Name, req.Email)
    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201,
        },
    }
}
```

```go
// src/user/user_request.go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}
```


### 컨트롤러 컨텍스트 `spine.Ctx`

인터셉터가 `ctx.Set`으로 저장한 값은 컨트롤러에서 `spine.Ctx.Get`으로 조회합니다. 컨트롤러에는 조회 기능만 제공됩니다. 아래 예제는 `userRole` 키에 문자열을 저장했다는 전제이므로, 실제 앱에서는 저장하는 쪽과 읽는 쪽의 타입을 맞추세요.

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId input.Path[int64],
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // 인터셉터에서 Set한 값 조회
    if v, ok := spineCtx.Get("userRole"); ok {
        if role, ok := v.(string); ok {
            _ = role // Use the role in the application.
        }
    }

    user, _ := c.service.Get(ctx, int(*userId))
    return httpx.Response[UserResponse]{Body: user}
}
```


## 응답 반환


### 1. httpx.Response[T]로 JSON과 문자열 응답 반환

`httpx.Response[T]`의 `Body`에 응답 본문을 넣고 `Options`에서 상태 코드, 헤더, 쿠키를 설정합니다. 상태 코드를 생략하면 HTTP 200을 사용합니다.

```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### 기본 JSON 응답

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId input.Path[int64],
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(*userId))

    return httpx.Response[UserResponse]{
        Body: user,  // 200 OK (기본값)
    }
}
```

#### 문자열 응답

```go
func (c *UserController) Health() httpx.Response[string] {
    return httpx.Response[string]{
        Body: "OK",
    }
}
```

#### 상태 코드 지정

```go
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,
) httpx.Response[UserResponse] {
    user, _ := c.service.Create(ctx, req.Name, req.Email)

    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201, // Created
        },
    }
}
```

#### 응답 헤더 추가

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId input.Path[int64],
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(*userId))

    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Headers: map[string]string{
                "X-Custom-Header": "custom-value",
                "Cache-Control":   "max-age=3600",
            },
        },
    }
}
```

#### 쿠키 설정

```go
func (c *AuthController) Login(
    ctx context.Context,
    req *LoginRequest,
) httpx.Response[LoginResponse] {
    token, refreshToken, _ := c.service.Login(ctx, req.Email, req.Password)

    return httpx.Response[LoginResponse]{
        Body: LoginResponse{Success: true},
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
                httpx.RefreshTokenCookie(refreshToken, 7*24*time.Hour),
            },
        },
    }
}
```

#### httpx.Cookie 구조체

```go
type Cookie struct {
    Name     string
    Value    string
    Path     string
    Domain   string
    MaxAge   int
    Expires  *time.Time
    HttpOnly bool
    Secure   bool
    SameSite SameSite  // SameSiteLax, SameSiteStrict, SameSiteNone
    Priority string    // "Low" | "Medium" | "High"
}
```

#### 쿠키 헬퍼 함수

| 함수 | 설명 |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | 액세스 토큰 쿠키 생성 |
| `httpx.RefreshTokenCookie(token, ttl)` | 갱신 토큰 쿠키 생성 |
| `httpx.DefaultRefreshTokenCookie(token)` | 유효 기간이 7일인 갱신 토큰 쿠키 생성 |
| `httpx.ClearAccessTokenCookie()` | 액세스 토큰 쿠키 삭제 |
| `httpx.ClearRefreshTokenCookie()` | 갱신 토큰 쿠키 삭제 |


### 2. httpx.Redirect로 리다이렉트 응답 반환

`httpx.Redirect`를 사용하면 클라이언트를 다른 URL로 리다이렉트합니다.

#### 기본 리다이렉트 (302 Found)

```go
type OAuthQuery struct { Code string `query:"code"` }

func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q input.Query[OAuthQuery],
) httpx.Redirect {
    code := q.Code
    c.service.ProcessOAuthCode(ctx, code)

    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (기본값)
    }
}
```

#### 상태 코드 지정

```go
import "net/http"

func (c *UserController) MovedPermanently() httpx.Redirect {
    return httpx.Redirect{
        Location: "/new-location",
        Options: httpx.ResponseOptions{
            Status: http.StatusMovedPermanently, // 301
        },
    }
}
```

#### 리다이렉트와 함께 쿠키 설정

```go
func (c *AuthController) Login(
    ctx context.Context,
    req *LoginRequest,
) httpx.Redirect {
    token, _ := c.service.Login(ctx, req.Email, req.Password)

    return httpx.Redirect{
        Location: "/dashboard",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
            },
        },
    }
}
```

#### 로그아웃 (쿠키 삭제 후 리다이렉트)

```go
func (c *AuthController) Logout() httpx.Redirect {
    return httpx.Redirect{
        Location: "/login",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.ClearAccessTokenCookie(),
                httpx.ClearRefreshTokenCookie(),
            },
        },
    }
}
```


### 3. error로 오류 응답 반환 {#error-response}

`httperr`로 오류를 반환하면 지정한 HTTP 상태 코드와 `message` 필드를 가진 JSON 응답을 만듭니다. 아래 예제는 서비스 오류를 사용자 조회 실패로 처리해 HTTP 404를 반환합니다. 실제 앱에서는 오류의 원인을 구분해 알맞은 상태 코드로 변환하세요.

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId input.Path[int64],
) error {
    _, err := c.service.Get(ctx, int(*userId))
    if err != nil {
        return httperr.NotFound("유저를 찾을 수 없습니다.")
    }
    return nil
}
```

#### httperr 함수

| 함수 | 상태 코드 |
|------|----------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.NotFound(msg)` | 404 |

위 예제의 오류 응답 본문은 다음과 같습니다.

```json
{
  "message": "유저를 찾을 수 없습니다."
}
```

#### httpx.Response[T]와 error 함께 사용

성공 응답과 오류를 함께 반환하려면 `(httpx.Response[T], error)`를 사용합니다. 실패하면 빈 응답 값과 오류를 반환하고, 성공하면 본문이 있는 응답과 `nil`을 반환합니다. 오류가 있으면 성공 응답 본문은 사용하지 않습니다.

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userID input.Path[int64],
) (httpx.Response[UserResponse], error) {
    user, err := c.service.Get(ctx, int(*userID))
    if err != nil {
        return httpx.Response[UserResponse]{}, httperr.NotFound("user not found")
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}
```


### 응답 타입 선택

| 상황 | 권장 반환 타입 |
|------|---------------|
| JSON 응답 (상태 코드/헤더/쿠키 포함) | `httpx.Response[T]` |
| 문자열 응답 | `httpx.Response[string]` |
| 리다이렉트 | `httpx.Redirect` |
| 바이트 본문과 Content-Type 지정 | `httpx.Binary` |
| 오류만 반환 | `error` |


## 폼 DTO와 멀티파트 파일

폼의 텍스트 필드는 구조체 포인터인 폼 DTO로 받고, 업로드 파일은 `multipart.UploadedFiles`로 받습니다. 두 타입을 같은 핸들러의 파라미터로 선언하면 한 요청에서 텍스트와 파일을 함께 처리할 수 있습니다.

이하 예제의 `PostController`와 `FileController`는 직접 구현하고 생성자와 라우트를 등록해야 합니다. `/posts`와 `/upload`가 등록되어 있어야 아래 `curl` 요청을 실행할 수 있으며, 파일 업로드 요청에는 지정한 경로에 실제 파일이 있어야 합니다.

### 1. 폼 텍스트 필드 받기

폼 DTO는 `multipart/form-data` 또는 `application/x-www-form-urlencoded` 요청의 텍스트 필드를 받습니다. DTO 필드에 `form` 태그로 요청 필드명을 지정합니다.

#### 폼 DTO 정의

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### 핸들러 구현

```go
func (c *PostController) Create(
    form *CreatePostForm, // Form DTO
) httpx.Response[string] {
    fmt.Println("Title  :", form.Title)
    fmt.Println("Content:", form.Content)

    return httpx.Response[string]{Body: "OK"}
}
```

#### 요청 예시 (curl)

```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. 업로드 파일 받기

업로드 파일은 DTO 필드에 넣지 않고 별도의 `multipart.UploadedFiles` 파라미터로 받습니다. 아래 예제는 파일의 필드명, 파일명, 크기를 로그로 출력합니다.

#### 업로드 파일 타입

`github.com/NARUBROWN/spine/pkg/multipart` 패키지의 타입을 사용합니다.

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### 핸들러 구현

```go
func (c *FileController) Upload(
    files multipart.UploadedFiles, // Multipart files
) httpx.Response[string] {
    fmt.Println("Files count:", len(files.Files))

    for _, f := range files.Files {
        fmt.Println(
            "field:", f.FieldName,
            "name:", f.Filename,
            "size:", f.Size,
        )
    }

    return httpx.Response[string]{Body: "OK"}
}
```

#### UploadedFile 구조체

```go
type UploadedFile struct {
    FieldName   string
    Filename    string
    ContentType string
    Size        int64
    Open        func() (io.ReadCloser, error)
}
```

#### 요청 예시 (curl)

```bash
curl -X POST http://localhost:8080/upload \
  -F "file=@test1.png" \
  -F "file=@test2.jpg"
```

### 3. 폼, 파일, 쿼리 함께 받기

같은 핸들러에서 폼 DTO, 업로드 파일, 페이지네이션을 함께 받을 수 있습니다. 아래 예제는 각 값을 읽어 출력하며 파일을 저장하지는 않습니다.

#### 핸들러 구현

```go
type PageQuery struct {
    Page int `query:"page"`
    Size int `query:"size"`
}

func (c *PostController) Upload(
    ctx context.Context,
    form  *CreatePostForm,           // form fields
    files multipart.UploadedFiles,   // multipart files
    page  input.Query[PageQuery],          // query
) httpx.Response[string] {
    fmt.Println("[FORM] Title  :", form.Title)
    fmt.Println("[FORM] Content:", form.Content)

    fmt.Println("[QUERY] Page:", page.Page)
    fmt.Println("[QUERY] Size:", page.Size)

    fmt.Println("[FILES] Count:", len(files.Files))

    return httpx.Response[string]{Body: "OK"}
}
```

### 입력 타입을 구분하는 기준

JSON과 폼 DTO는 구조체 포인터로 받습니다. 쿼리와 경로에는 `input.Query[T]`와 `input.Path[T]`, 파일에는 `multipart.UploadedFiles`를 사용할 수 있습니다. 헤더는 `header` 태그가 있는 별도 구조체 포인터로 받습니다.

## 입력 오류 처리 시 주의사항

잘못된 JSON과 경로 값 변환 실패는 HTTP 400, 지원하지 않는 본문 Content-Type은 415, 본문 크기 제한 초과는 413으로 처리됩니다. 바인딩 실패는 컨트롤러 호출 전에 발생합니다. 실제 요청으로 업무 검증 오류와 구분해 확인하세요.

## 다음 단계

- [튜토리얼: 의존성 주입](/ko/learn/tutorial/3-dependency-injection) — 생성자 등록과 의존성 해결
- [튜토리얼: 인터셉터](/ko/learn/tutorial/4-interceptor) — 요청 전후 처리
