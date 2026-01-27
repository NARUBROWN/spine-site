# 컨트롤러

Spine에서 컨트롤러 작성하기.


## 컨트롤러란?

컨트롤러는 HTTP 요청을 받아 서비스에 위임하는 계층입니다.

Spine의 컨트롤러는 **순수한 Go 구조체**입니다. 어노테이션도, 데코레이터도, 특별한 인터페이스 구현도 필요 없습니다.

```go
// 이게 전부입니다
type UserController struct {
    svc *service.UserService
}
```

## 기본 구조

### 1. 구조체 정의

```go
package controller

type UserController struct {
    svc *service.UserService  // 의존성
}
```

### 2. 생성자 작성

```go
// 생성자 파라미터 = 의존성 선언
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 3. 핸들러 메서드 작성

```go
// 함수 시그니처가 곧 API 스펙
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

### 4. 라우트 등록

```go
app.Route("GET", "/users/:id", (*UserController).GetUser)
```


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


## 입력 받기

### 쿼리 파라미터

`query.Values`를 사용해 쿼리 스트링을 파싱합니다.

```go
// GET /users?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[dto.UserResponse] {
    id := q.Int("id", 0)                      // int64, 기본값 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, 기본값 false
    
    user, _ := c.svc.Get(ctx, int(id))
    return httpx.Response[dto.UserResponse]{Body: user}
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
// GET /users?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]dto.UserResponse] {
    // page.Page = 2 (기본값: 1)
    // page.Size = 10 (기본값: 20)
    users, _ := c.svc.List(ctx, page.Page, page.Size)
    return httpx.Response[[]dto.UserResponse]{Body: users}
}
```


### HTTP 헤더

`header.Values`를 사용해 HTTP 헤더에 접근합니다.

```go
import "github.com/NARUBROWN/spine/pkg/header"

func (c *CommonController) CheckHeader(
    headers header.Values,
) httpx.Response[dto.HeaderInfo] {
    return httpx.Response[dto.HeaderInfo]{
        Body: dto.HeaderInfo{
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

`path` 패키지의 타입을 사용하여 라우트 경로의 파라미터를 바인딩합니다.

```go
// GET /users/:id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
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

DTO 구조체를 포인터로 선언하면 자동으로 JSON이 바인딩됩니다.

```go
// POST /users
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,  // ← 포인터로 선언
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201,
        },
    }
}
```

```go
// dto/user_request.go
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
) httpx.Response[dto.UserResponse] {
    // 인터셉터에서 Set한 값 조회
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }
    
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```


## 응답 반환

Spine은 `httpx.Response[T]`, `httpx.Redirect`, `error` 세 가지 반환 타입을 지원합니다.

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
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    
    return httpx.Response[dto.UserResponse]{
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
    req *dto.CreateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    
    return httpx.Response[dto.UserResponse]{
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
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    
    return httpx.Response[dto.UserResponse]{
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
    req *dto.LoginRequest,
) httpx.Response[dto.LoginResponse] {
    token, refreshToken, _ := c.svc.Login(ctx, req.Email, req.Password)
    
    return httpx.Response[dto.LoginResponse]{
        Body: dto.LoginResponse{Success: true},
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
    c.svc.ProcessOAuthCode(ctx, code)
    
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
    req *dto.LoginRequest,
) httpx.Redirect {
    token, _ := c.svc.Login(ctx, req.Email, req.Password)
    
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
    _, err := c.svc.Get(ctx, int(userId.Value))
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

에러 처리가 필요한 경우 `httpx.Response[T]` 내에서 상태 코드로 처리하거나, 별도 에러 핸들러 메서드를 만들 수 있습니다.

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{
                Status: 404,
            },
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
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


## 라우트 등록

컨트롤러 메서드를 라우트에 연결합니다.

```go
// routes/user_routes.go
package routes

import (
    "my-app/controller"
    "github.com/NARUBROWN/spine"
)

func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).ListUsers)
    app.Route("GET", "/users/:id", (*controller.UserController).GetUser)
    app.Route("POST", "/users", (*controller.UserController).CreateUser)
    app.Route("PUT", "/users/:id", (*controller.UserController).UpdateUser)
    app.Route("DELETE", "/users/:id", (*controller.UserController).DeleteUser)
}
```

```go
// main.go
func main() {
    app := spine.New()
    app.Constructor(/* ... */)
    routes.RegisterUserRoutes(app)
    app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    })
}
```


## 전체 예제

```go
// controller/user_controller.go
package controller

import (
    "context"
    "net/http"
    "time"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GET /users?page=1&size=20
func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]dto.UserResponse] {
    users, _ := c.svc.List(ctx, page.Page, page.Size)
    
    return httpx.Response[[]dto.UserResponse]{
        Body: users,
        Options: httpx.ResponseOptions{
            Headers: map[string]string{
                "X-Total-Count": "100",
            },
        },
    }
}

// GET /users/:id
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
}

// POST /users
func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: http.StatusCreated, // 201
        },
    }
}

// PUT /users/:id
func (c *UserController) UpdateUser(
    ctx context.Context,
    userId path.Int,
    req *dto.UpdateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Update(ctx, int(userId.Value), req.Name)
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
}

// DELETE /users/:id
func (c *UserController) DeleteUser(
    ctx context.Context,
    userId path.Int,
) error {
    return c.svc.Delete(ctx, int(userId.Value))
}
```

```go
// controller/auth_controller.go
package controller

import (
    "context"
    "time"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type AuthController struct {
    svc *service.AuthService
}

func NewAuthController(svc *service.AuthService) *AuthController {
    return &AuthController{svc: svc}
}

// POST /auth/login
func (c *AuthController) Login(
    ctx context.Context,
    req *dto.LoginRequest,
) httpx.Redirect {
    token, _ := c.svc.Login(ctx, req.Email, req.Password)
    
    return httpx.Redirect{
        Location: "/dashboard",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
            },
        },
    }
}

// POST /auth/logout
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
