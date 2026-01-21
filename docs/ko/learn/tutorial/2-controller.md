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
    q query.Values,
) (dto.UserResponse, error) {
    return c.svc.Get(ctx, q.Int("id", 0))
}
```

### 4. 라우트 등록

```go
app.Route("GET", "/users", (*UserController).GetUser)
```


## 핸들러 시그니처

Spine은 핸들러의 함수 시그니처를 분석해 자동으로 입력을 바인딩합니다.

### 지원하는 파라미터 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `context.Context` | 요청 컨텍스트 | `ctx context.Context` |
| `query.Values` | 쿼리 파라미터 | `q query.Values` |
| `struct` (DTO) | JSON 요청 본문 | `req CreateUserRequest` |

### 지원하는 반환 타입

| 타입 | 설명 |
|------|------|
| `(T, error)` | 응답 객체와 에러 |
| `error` | 에러만 반환 (응답 본문 없음) |


## 입력 받기

### 쿼리 파라미터

`query.Values`를 사용해 쿼리 스트링을 파싱합니다.

```go
// GET /users?id=1&name=alice

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    id := q.Int("id", 0)           // int64, 기본값 0
    name := q.String("name", "")   // string, 기본값 ""
    
    return c.svc.Get(ctx, int(id))
}
```

#### query.Values 메서드

| 메서드 | 반환 타입 | 설명 |
|--------|----------|------|
| `String(key, default)` | `string` | 문자열 값 |
| `Int(key, default)` | `int64` | 정수 값 |
| `Bool(key, default)` | `bool` | 불리언 값 |
| `Float(key, default)` | `float64` | 실수 값 |


### JSON 요청 본문

DTO 구조체를 파라미터로 선언하면 자동으로 JSON이 바인딩됩니다.

```go
// POST /users
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,  // ← 자동 바인딩
) (dto.UserResponse, error) {
    return c.svc.Create(ctx, req.Name, req.Email)
}
```

```go
// dto/user_request.go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

### 쿼리 + JSON 본문 함께 사용

```go
// PUT /users?id=1
// Body: {"name": "Alice Updated"}

func (c *UserController) UpdateUser(
    ctx context.Context,
    q query.Values,
    req dto.UpdateUserRequest,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))
    return c.svc.Update(ctx, id, req.Name)
}
```

## 응답 반환

### 성공 응답

구조체를 반환하면 자동으로 JSON 응답이 됩니다.

```go
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    user, err := c.svc.Get(ctx, int(q.Int("id", 0)))
    if err != nil {
        return dto.UserResponse{}, err
    }
    
    return user, nil  // ← 200 OK + JSON
}
```

```go
// dto/user_response.go
type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

응답:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### 에러 응답

`httperr` 패키지를 사용해 HTTP 상태 코드와 메시지를 반환합니다.

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    user, err := c.svc.Get(ctx, int(q.Int("id", 0)))
    if err != nil {
        // 404 Not Found
        return dto.UserResponse{}, httperr.NotFound("유저를 찾을 수 없습니다.")
    }
    
    return user, nil
}
```

#### httperr 함수

| 함수 | 상태 코드 |
|------|----------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.Forbidden(msg)` | 403 |
| `httperr.NotFound(msg)` | 404 |
| `httperr.InternalServerError(msg)` | 500 |


### 응답 본문 없이 반환

삭제 등 응답 본문이 필요 없는 경우 `error`만 반환합니다.

```go
func (c *UserController) DeleteUser(
    ctx context.Context,
    q query.Values,
) error {
    id := int(q.Int("id", 0))
    return c.svc.Delete(ctx, id)  // ← 성공 시 200 OK (본문 없음)
}
```


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
    app.Route("GET", "/users", (*controller.UserController).GetUser)
    app.Route("POST", "/users", (*controller.UserController).CreateUser)
    app.Route("PUT", "/users", (*controller.UserController).UpdateUser)
    app.Route("DELETE", "/users", (*controller.UserController).DeleteUser)
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
	})
}
```

## 전체 예제

```go
// controller/user_controller.go
package controller

import (
    "context"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GET /users?id=1
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))
    
    user, err := c.svc.Get(ctx, id)
    if err != nil {
        return dto.UserResponse{}, httperr.NotFound("유저를 찾을 수 없습니다.")
    }
    
    return user, nil
}

// POST /users
func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,
) (dto.UserResponse, error) {
    return c.svc.Create(ctx, req.Name, req.Email)
}

// PUT /users?id=1
func (c *UserController) UpdateUser(
    ctx context.Context,
    q query.Values,
    req dto.UpdateUserRequest,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))
    
    user, err := c.svc.Update(ctx, id, req.Name)
    if err != nil {
        return dto.UserResponse{}, httperr.NotFound("유저를 찾을 수 없습니다.")
    }
    
    return user, nil
}

// DELETE /users?id=1
func (c *UserController) DeleteUser(
    ctx context.Context,
    q query.Values,
) error {
    id := int(q.Int("id", 0))
    return c.svc.Delete(ctx, id)
}
```


## 핵심 정리

| 개념 | 설명 |
|------|------|
| **어노테이션 없음** | 순수 Go 구조체와 메서드 |
| **생성자 = 의존성** | 파라미터가 곧 의존성 선언 |
| **시그니처 = API 스펙** | 입력/출력 타입이 명시적 |
| **자동 바인딩** | query, JSON 본문 자동 파싱 |


## 다음 단계

- [튜토리얼: 의존성 주입](/ko/learn/tutorial/3-dependency-injection) — DI 동작 원리
- [튜토리얼: 인터셉터](/ko/learn/tutorial/4-interceptor) — 요청 전/후 처리