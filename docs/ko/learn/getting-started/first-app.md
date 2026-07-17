# 첫 번째 앱

5분 안에 사용자 조회 API를 만들어봅니다.

## 완성된 모습

```bash
curl "http://localhost:8080/users?id=1"
```

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```


## 1. 프로젝트 생성

```bash
mkdir hello-spine && cd hello-spine
go mod init hello-spine
go get github.com/NARUBROWN/spine
```


## 2. 프로젝트 구조

```
hello-spine/
├── main.go
├── controller/
│   └── user_controller.go
├── service/
│   └── user_service.go
└── routes/
    └── routes.go
```

## 3. 코드 작성

### main.go

```go
package main

import (
    "log"
    "time"

    "hello-spine/controller"
    "hello-spine/routes"
    "hello-spine/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    // 생성자 등록 — 순서 상관없음
    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    // 라우트 등록
    routes.RegisterRoutes(app)

    // 서버 시작
    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```

### service/user_service.go

```go
package service

// UserResponse 응답 구조체
type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

// UserService 사용자 서비스
type UserService struct {
    // 실제로는 Repository를 주입받지만, 여기선 간단히 구현
}

func NewUserService() *UserService {
    return &UserService{}
}

// Get 사용자 조회 (하드코딩된 데이터)
func (s *UserService) Get(id int) (UserResponse, error) {
    // 실제로는 DB에서 조회
    users := map[int]UserResponse{
        1: {ID: 1, Name: "Alice", Email: "alice@example.com"},
        2: {ID: 2, Name: "Bob", Email: "bob@example.com"},
    }

    if user, ok := users[id]; ok {
        return user, nil
    }

    return UserResponse{}, nil
}
```

### controller/user_controller.go

```go
package controller

import (
    "context"

    "hello-spine/service"

    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

// NewUserController 생성자 — 파라미터가 곧 의존성
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser 사용자 조회 핸들러
// 함수 시그니처가 곧 API 스펙
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[service.UserResponse], error) {
    id := int(q.Int("id", 0))
    user, err := c.svc.Get(id)
    if err != nil {
        return httpx.Response[service.UserResponse]{}, err
    }
    return httpx.Response[service.UserResponse]{Body: user}, nil
}
```

### routes/routes.go

```go
package routes

import (
    "hello-spine/controller"

    "github.com/NARUBROWN/spine"
)

func RegisterRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).GetUser)
}
```

## 4. 실행

```bash
go run main.go
```

```
________       _____             
__  ___/__________(_)___________ 
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/ 
       /_/        
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## 5. 테스트

```bash
# Alice 조회
curl "http://localhost:8080/users?id=1"
```

```json
{"id":1,"name":"Alice","email":"alice@example.com"}
```

```bash
# Bob 조회
curl "http://localhost:8080/users?id=2"
```

```json
{"id":2,"name":"Bob","email":"bob@example.com"}
```

## 🎉 완성!

5분 만에 첫 번째 Spine 앱을 만들었습니다.

### 지금까지 배운 것

| 개념 | 코드 |
|------|------|
| 앱 생성 | `spine.New()` |
| 의존성 등록 | `app.Constructor(...)` |
| 라우트 등록 | `app.Route("GET", "/users", ...)` |
| 서버 시작 | `app.Run(boot.Options{...})` |

### 핵심 포인트

- **생성자 파라미터 = 의존성 선언** — 어노테이션 불필요
- **함수 시그니처 = API 스펙** — 입출력이 명확
- **라우트 한 곳에서 관리** — 흐름이 보임

## 다음 단계

- [튜토리얼: 프로젝트 구조](/ko/learn/tutorial/1-project-structure) — 실제 프로젝트 구조 잡기
- [튜토리얼: 인터셉터](/ko/learn/tutorial/4-interceptor) — 트랜잭션, 로깅 추가하기
- [튜토리얼: 데이터베이스](/ko/learn/tutorial/5-database) — Bun ORM 연결하기