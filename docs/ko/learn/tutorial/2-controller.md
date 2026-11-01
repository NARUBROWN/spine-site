# 컨트롤러

CLI로 만든 `hello-spine` 프로젝트에 사용자 조회 컨트롤러를 추가합니다. 설치와 프로젝트 생성은 [첫 번째 앱](/ko/learn/getting-started/first-app)을 먼저 따라 하세요. 이미 `resource user`를 생성했다면 다시 생성하지 말고 파일을 확인합니다.

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

생성된 `src/user/user_controller.go`는 다음과 같습니다. `UserService`와 같은 `user` 패키지에 있으므로 별도 `service` 패키지 import가 없습니다.

```go
package user

import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct { service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) Get(id path.Int) httpx.Response[map[string]any] {
    return httpx.Response[map[string]any]{Body: map[string]any{"id": id.Value}}
}
```

::: info
`resource`는 조회용 골격입니다. 데이터베이스·도메인 모델·DTO·CRUD를 자동 구현하지 않습니다. 아래 입력·응답 코드는 이 골격에 직접 추가하는 서로 독립적인 핸들러 예시입니다. `UserResponse`, 요청 DTO, `UserService.Get/List/Create/Login` 등의 메서드는 필요한 예제에 맞게 직접 구현해야 합니다. 예시 타입은 `src/user`의 `package user`에 두고 필요한 표준/Spine 패키지를 import하세요. 같은 이름의 메서드 예시를 한 번에 붙여 넣지 마세요.
:::

## 핸들러 시그니처

Spine은 핸들러의 함수 시그니처를 분석해 자동으로 입력을 바인딩합니다.

### 지원하는 파라미터 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `context.Context` | 요청 컨텍스트 | `ctx context.Context` |
| `query.Values` | 쿼리 파라미터 | `q query.Values` |
| `query.Pagination` | 페이지네이션 | `page query.Pagination` |
| `header.Values` | HTTP 헤더 | `headers header.Values` |
| `*struct` (DTO) | JSON 요청 본문 | `req *CreateUserRequest` |
| `*struct` (Form) | Form Data | `form *CreatePostForm` |
| `multipart.UploadedFiles` | Multipart 파일 | `files multipart.UploadedFiles` |
| `path.*` | Path 파라미터 | `userId path.Int` |
| `spine.Ctx` | 컨트롤러 컨텍스트 | `spineCtx spine.Ctx` |

### 지원하는 반환 타입

| 타입 | 설명 |
|------|------|
| `httpx.Response[T]` | JSON 또는 문자열 응답 (상태 코드, 헤더, 쿠키 포함) |
| `httpx.Redirect` | 리다이렉트 응답 |
| `error` | 에러 응답 |
| `httpx.Binary` | 바이트 응답 |

포인터 응답과 `(지원하는 응답 타입, error)`도 사용할 수 있습니다. `httpx.Binary`는 명시적인 Content-Type과 바이트를 반환합니다.


## 입력 받기

### 쿼리 파라미터

`query.Values`를 사용해 쿼리 스트링을 파싱합니다.

```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64, 기본값 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, 기본값 false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### query.Values 메서드

| 메서드 | 반환 타입 | 설명 |
|--------|----------|------|
| `Get(key)` | `string` | 첫 번째 값 (없으면 빈 문자열) |
| `String(key)` | `string` | 문자열 값 |
| `Int(key, default)` | `int64` | 정수 값 |
| `GetBoolByKey(key, default)` | `bool` | 불리언 값 |
| `Has(key)` | `bool` | 키 존재 여부 |


### 페이지네이션

`query.Pagination`을 사용하면 `page`와 `size` 쿼리 파라미터를 자동으로 파싱합니다.

```go
// GET /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // page.Page = 2 (기본값: 1)
    // page.Size = 10 (기본값: 20)
    users, _ := c.service.List(ctx, page.Page, page.Size)
    return httpx.Response[[]UserResponse]{Body: users}
}
```


### HTTP 헤더

`header.Values`를 사용해 HTTP 헤더에 접근합니다.

```go
import "github.com/NARUBROWN/spine/pkg/header"

func (c *CommonController) CheckHeader(
    headers header.Values,
) httpx.Response[HeaderInfo] {
    return httpx.Response[HeaderInfo]{
        Body: HeaderInfo{
            UserAgent:   headers.Get("User-Agent"),
            ContentType: headers.Get("Content-Type"),
        },
    }
}
```

#### header.Values 메서드

| 메서드 | 반환 타입 | 설명 |
|--------|----------|------|
| `Get(key)` | `string` | 헤더 값 |
| `Has(key)` | `bool` | 헤더 존재 여부 |


### Path 파라미터

경로 파라미터는 선언 순서대로 `path.Int`, `path.String`, `path.Boolean`에 바인딩됩니다.

`path` 패키지의 타입을 사용하여 라우트 경로의 파라미터를 바인딩합니다.

```go
// GET /user/:id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### path 패키지 구조체

```go
package path

type Int struct {
    Value int64
}

type String struct {
    Value string
}

type Boolean struct {
    Value bool
}
```


### JSON 요청 본문

DTO는 포인터여야 합니다. JSON/Form 바인딩은 DTO의 `form` 태그와 요청 Content-Type에 따라 결정됩니다.

DTO 구조체를 포인터로 선언하면 자동으로 JSON이 바인딩됩니다.

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


### 컨트롤러 컨텍스트 (spine.Ctx)

인터셉터에서 주입한 값을 컨트롤러에서 참조할 때 `spine.Ctx`를 사용합니다.

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // 인터셉터에서 Set한 값 조회
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```


## 응답 반환


### 1. httpx.Response[T] — JSON/문자열 응답

`httpx.Response[T]`를 사용하면 상태 코드, 헤더, 쿠키를 세밀하게 제어할 수 있습니다.

```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### 기본 JSON 응답

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

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

#### 커스텀 헤더 추가

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

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
| `httpx.AccessTokenCookie(token, ttl)` | Access Token 쿠키 생성 |
| `httpx.RefreshTokenCookie(token, ttl)` | Refresh Token 쿠키 생성 |
| `httpx.DefaultRefreshTokenCookie(token)` | 7일 TTL Refresh Token 쿠키 |
| `httpx.ClearAccessTokenCookie()` | Access Token 쿠키 삭제 |
| `httpx.ClearRefreshTokenCookie()` | Refresh Token 쿠키 삭제 |


### 2. httpx.Redirect — 리다이렉트 응답

`httpx.Redirect`를 사용하면 클라이언트를 다른 URL로 리다이렉트합니다.

#### 기본 리다이렉트 (302 Found)

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
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


### 3. error — 에러 응답

`httperr` 패키지를 사용해 HTTP 상태 코드와 메시지를 반환합니다.

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) error {
    _, err := c.service.Get(ctx, int(userId.Value))
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

에러 응답 형식:
```json
{
  "message": "유저를 찾을 수 없습니다."
}
```

#### httpx.Response[T]와 error 함께 사용

성공 응답과 오류를 함께 반환하려면 `(httpx.Response[T], error)`를 사용합니다. 서비스 오류는 `httperr`로 매핑하고 성공 응답은 `nil` 오류와 반환합니다.

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userID path.Int,
) (httpx.Response[UserResponse], error) {
    user, err := c.service.Get(ctx, int(userID.Value))
    if err != nil {
        return httpx.Response[UserResponse]{}, httperr.NotFound("user not found")
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}
```


### 응답 방식 선택 가이드

| 상황 | 권장 반환 타입 |
|------|---------------|
| JSON 응답 (상태 코드/헤더/쿠키 포함) | `httpx.Response[T]` |
| 문자열 응답 | `httpx.Response[string]` |
| 리다이렉트 | `httpx.Redirect` |
| 에러만 반환 | `error` |


## Form DTO 및 Multipart 사용

Spine에서는 **Form DTO**, **Multipart**, 그리고 이 둘을 함께 사용하는 **정석 패턴**을 지원합니다.

Spine의 핵심 원칙은 다음과 같습니다.

- DTO는 반드시 `*Struct` (포인터)로 받는다
- 값 타입 `Struct`는 의미 타입(Semantic Type)이다
- 파일 업로드는 DTO가 아니라 별도의 의미 타입으로 처리한다
- Resolver는 하나의 의미만 담당한다

### 1. Form DTO 예제 (multipart/form-data)

Form DTO는 `multipart/form-data` 또는 `application/x-www-form-urlencoded` 요청에서 **텍스트 필드만 바인딩**하기 위한 DTO입니다.

#### Form DTO 정의

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### Controller

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

### 2. Multipart 파일 업로드 예제

파일 업로드는 **DTO가 아닌 의미 타입**으로 처리합니다.

#### Multipart 의미 타입

`github.com/NARUBROWN/spine/pkg/multipart` 패키지의 타입을 사용합니다.

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### Controller

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

### 3. Form DTO + Multipart + Query 함께 사용하기

#### Controller

```go
func (c *PostController) Upload(
    ctx context.Context,
    form  *CreatePostForm,           // form fields
    files multipart.UploadedFiles,   // multipart files
    page  query.Pagination,          // query
) httpx.Response[string] {
    fmt.Println("[FORM] Title  :", form.Title)
    fmt.Println("[FORM] Content:", form.Content)

    fmt.Println("[QUERY] Page:", page.Page)
    fmt.Println("[QUERY] Size:", page.Size)

    fmt.Println("[FILES] Count:", len(files.Files))

    return httpx.Response[string]{Body: "OK"}
}
```

### 4. Spine DTO 규칙 요약

```
*Struct  → DTO (JSON / Form)
 Struct  → 의미 타입 (Query / Path / Multipart)
```

이 규칙을 따르면 실행 흐름이 시그니처에 그대로 드러납니다.


## 자동 등록과 수동 확장

CLI는 `src/user/user_route.go`를 생성하고 `BuildApplication()`에서 `user.Register(app)`의 오류를 확인하도록 연결합니다. 다음 코드는 생성 결과를 설명하며, 같은 등록을 다시 추가하면 안 됩니다.

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

새 핸들러를 구현했다면 `user_route.go`의 `Register` 안에 해당 라우트를 직접 추가합니다. 다른 패키지의 컨트롤러는 그 패키지의 등록 함수에서 조립하세요. `main.go`는 생성된 `BuildApplication → Validate → Run` 흐름을 유지합니다.

## 검증과 실행

```bash
spine doctor
spine contract check
spine verify
spine dev
```

```bash
curl http://localhost:8080/user/1
```

계약·로컬 검증의 성공과 실제 HTTP 응답은 각각 확인합니다. `GET /user/1`의 생성된 응답은 `{"id":1}`이며 실제 사용자 조회나 영속 저장을 뜻하지 않습니다.

## 핵심 정리

| 개념 | 설명 |
|------|------|
| **어노테이션 없음** | 순수 Go 구조체와 메서드 |
| **생성자 = 의존성** | 파라미터가 곧 의존성 선언 |
| **시그니처 = API 스펙** | 입력/출력 타입이 명시적 |
| **자동 바인딩** | query, JSON 본문, 헤더 자동 파싱 |
| **httpx.Response[T]** | 상태 코드, 헤더, 쿠키 제어 |
| **httpx.Redirect** | 리다이렉트 응답 |


## 다음 단계

- [튜토리얼: 의존성 주입](/ko/learn/tutorial/3-dependency-injection) — DI 동작 원리
- [튜토리얼: 인터셉터](/ko/learn/tutorial/4-interceptor) — 요청 전/후 처리
