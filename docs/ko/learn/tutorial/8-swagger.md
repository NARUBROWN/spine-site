# 스웨거 문서화

API 문서 생성하기.


## 개요

Spine은 [Swaggo](https://github.com/swaggo/swag)를 사용해 Swagger 문서를 자동 생성합니다.

- 코드 주석에서 API 스펙 추출
- Swagger UI로 문서 제공
- API 테스트 가능


## 설치

```bash
# Swag CLI 설치
go install github.com/swaggo/swag/cmd/swag@latest

# 필요한 패키지 설치
go get github.com/swaggo/swag
go get github.com/swaggo/http-swagger
```


## 프로젝트 설정

### main.go 주석 추가

```go
// main.go
package main

import (
    "myapp/controller"
    "myapp/routes"
    "myapp/service"

    "github.com/NARUBROWN/spine"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"  // 생성된 docs 패키지 import
)

// @title My App API
// @version 1.0.0
// @description Spine 기반 REST API

// @host localhost:8080
// @BasePath /
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // Swagger UI 등록
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    app.Run(":8080")
}
```

### main.go 주석 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@title` | API 제목 | `My App API` |
| `@version` | API 버전 | `1.0.0` |
| `@description` | API 설명 | `Spine 기반 REST API` |
| `@host` | 호스트 주소 | `localhost:8080` |
| `@BasePath` | 기본 경로 | `/` |


## 컨트롤러 문서화

### 기본 형식

```go
// controller/user_controller.go
package controller

import (
    "context"

    "myapp/dto"
    "myapp/service"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser godoc
// @Summary 유저 조회
// @Description ID로 유저 정보를 조회합니다
// @Tags users
// @Param id query int true "User ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} ErrorResponse
// @Router /users [get]
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
```


### CRUD 전체 예시

```go
// GetUser godoc
// @Summary 유저 조회
// @Description ID로 유저 정보를 조회합니다
// @Tags users
// @Param id query int true "User ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} ErrorResponse
// @Router /users [get]
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    // ...
}

// CreateUser godoc
// @Summary 유저 생성
// @Description 새로운 유저를 생성합니다
// @Tags users
// @Accept json
// @Produce json
// @Param body body dto.CreateUserRequest true "유저 생성 요청"
// @Success 200 {object} dto.UserResponse
// @Failure 400 {object} ErrorResponse
// @Router /users [post]
func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,
) (dto.UserResponse, error) {
    // ...
}

// UpdateUser godoc
// @Summary 유저 수정
// @Description 유저 정보를 수정합니다
// @Tags users
// @Accept json
// @Produce json
// @Param id query int true "User ID"
// @Param body body dto.UpdateUserRequest true "유저 수정 요청"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} ErrorResponse
// @Router /users [put]
func (c *UserController) UpdateUser(
    ctx context.Context,
    q query.Values,
    req dto.UpdateUserRequest,
) (dto.UserResponse, error) {
    // ...
}

// DeleteUser godoc
// @Summary 유저 삭제
// @Description 유저를 삭제합니다
// @Tags users
// @Param id query int true "User ID"
// @Success 200
// @Failure 404 {object} ErrorResponse
// @Router /users [delete]
func (c *UserController) DeleteUser(
    ctx context.Context,
    q query.Values,
) error {
    // ...
}
```


## 주석 태그 레퍼런스

### 기본 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@Summary` | 요약 (한 줄) | `유저 조회` |
| `@Description` | 상세 설명 | `ID로 유저 정보를 조회합니다` |
| `@Tags` | 그룹 태그 | `users` |
| `@Router` | 경로와 메서드 | `/users [get]` |

### 요청 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@Accept` | 요청 Content-Type | `json` |
| `@Produce` | 응답 Content-Type | `json` |
| `@Param` | 파라미터 정의 | `id query int true "User ID"` |

### 응답 태그

| 태그 | 설명 | 예시 |
|------|------|------|
| `@Success` | 성공 응답 | `200 {object} dto.UserResponse` |
| `@Failure` | 실패 응답 | `404 {object} ErrorResponse` |


## @Param 형식

```
@Param [이름] [위치] [타입] [필수여부] "[설명]"
```

### 위치 (in)

| 위치 | 설명 | 예시 |
|------|------|------|
| `query` | 쿼리 스트링 | `/users?id=1` |
| `path` | URL 경로 | `/users/{id}` |
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
// @Param body body dto.CreateUserRequest true "유저 생성 요청"

// 헤더
// @Param Authorization header string true "Bearer 토큰"
```


## DTO 문서화

### 요청 DTO

```go
// dto/user_request.go
package dto

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
// dto/user_response.go
package dto

// UserResponse 유저 응답
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
    Error string `json:"error" example:"유저를 찾을 수 없습니다."`
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


## 문서 생성

### 명령어 실행

```bash
# 프로젝트 루트에서 실행
swag init

# 또는 main.go 경로 지정
swag init -g main.go
```

### 생성 결과

```
myapp/
├── docs/
│   ├── docs.go       # Go 코드
│   ├── swagger.json  # JSON 스펙
│   └── swagger.yaml  # YAML 스펙
├── main.go
└── ...
```

### 생성된 docs/docs.go

```go
// Package docs Code generated by swaggo/swag. DO NOT EDIT
package docs

import "github.com/swaggo/swag"

const docTemplate = `{
    "swagger": "2.0",
    "info": {
        "title": "My App API",
        "version": "1.0.0"
    },
    ...
}`

var SwaggerInfo = &swag.Spec{
    Version:     "1.0.0",
    Title:       "My App API",
    Description: "Spine 기반 REST API",
    // ...
}

func init() {
    swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
```

## Swagger UI 접속

### 서버 실행

```bash
go run main.go
```

### 브라우저에서 접속

```
http://localhost:8080/swagger/index.html
```

## 자동 재생성

코드 수정 시 문서를 자동으로 재생성하려면:

### Makefile 사용

```makefile
# Makefile

.PHONY: swagger run

swagger:
	swag init -g main.go

run: swagger
	go run main.go
```

```bash
make run
```

### 스크립트 사용

```bash
#!/bin/bash
# run.sh

swag init -g main.go
go run main.go
```

```bash
chmod +x run.sh
./run.sh
```

## 전체 예제

### 프로젝트 구조

```
myapp/
├── main.go
├── docs/
│   ├── docs.go
│   ├── swagger.json
│   └── swagger.yaml
├── controller/
│   └── user_controller.go
├── dto/
│   ├── user_request.go
│   └── user_response.go
├── service/
│   └── user_service.go
└── routes/
    └── routes.go
```

### main.go

```go
package main

import (
    "myapp/controller"
    "myapp/routes"
    "myapp/service"

    "github.com/NARUBROWN/spine"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"
)

// @title My App API
// @version 1.0.0
// @description Spine 기반 REST API

// @host localhost:8080
// @BasePath /
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // Swagger UI 등록
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    app.Run(":8080")
}
```

### controller/user_controller.go

```go
package controller

import (
    "context"

    "myapp/dto"
    "myapp/service"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser godoc
// @Summary 유저 조회
// @Description ID로 유저 정보를 조회합니다
// @Tags users
// @Param id query int true "User ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /users [get]
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

// CreateUser godoc
// @Summary 유저 생성
// @Description 새로운 유저를 생성합니다
// @Tags users
// @Accept json
// @Produce json
// @Param body body dto.CreateUserRequest true "유저 생성 요청"
// @Success 200 {object} dto.UserResponse
// @Failure 400 {object} dto.ErrorResponse
// @Router /users [post]
func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,
) (dto.UserResponse, error) {
    return c.svc.Create(ctx, req.Name, req.Email)
}
```


## 핵심 정리

| 단계 | 명령/작업 |
|------|----------|
| 1. 설치 | `go install github.com/swaggo/swag/cmd/swag@latest` |
| 2. 주석 작성 | `// @Summary`, `// @Param`, `// @Router` 등 |
| 3. 문서 생성 | `swag init` |
| 4. UI 등록 | `e.GET("/swagger/*", ...)` |
| 5. 접속 | `http://localhost:8080/swagger/index.html` |


## 다음 단계

- [레퍼런스: API](/reference/api) — Spine API 문서
- [레퍼런스: 예제](/reference/examples) — 전체 예제 프로젝트