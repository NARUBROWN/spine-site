# spine.App

메인 애플리케이션 인터페이스에 대한 API 참조.

## 개요

`App`은 Spine 애플리케이션의 진입점입니다. 생성자 등록, 라우트 정의, Interceptor 설정, 서버 실행을 담당합니다.

```go
import "github.com/NARUBROWN/spine"
```

## 인터페이스 정의

```go
type App interface {
    Constructor(constructors ...any)
    Route(method string, path string, handler any)
    Interceptor(interceptors ...core.Interceptor)
    Run(address string) error
}
```

## 생성자

### New

```go
func New() App
```

새로운 Spine 애플리케이션 인스턴스를 생성합니다.

**반환값**
- `App` - 애플리케이션 인스턴스

**예시**
```go
app := spine.New()
```

## 메서드

### Constructor

```go
Constructor(constructors ...any)
```

IoC Container에 생성자 함수를 등록합니다. 등록된 생성자는 의존성 주입에 사용됩니다.

**매개변수**
- `constructors` - 생성자 함수들 (가변 인자)

**생성자 규칙**
- 함수여야 합니다
- 반환값은 정확히 하나여야 합니다
- 매개변수는 다른 등록된 타입이어야 합니다 (의존성)

**예시**
```go
// 의존성 없는 생성자
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// 의존성 있는 생성자
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

app.Constructor(
    NewUserRepository,
    NewUserController,
)
```

### Route

```go
Route(method string, path string, handler any)
```

HTTP 라우트를 등록합니다.

**매개변수**
- `method` - HTTP 메서드 (`"GET"`, `"POST"`, `"PUT"`, `"DELETE"` 등)
- `path` - URL 경로 패턴. `:param` 형식으로 경로 파라미터 정의
- `handler` - Controller 메서드 표현식

**경로 패턴**
- `/users` - 정적 경로
- `/users/:id` - 단일 파라미터
- `/users/:userId/posts/:postId` - 다중 파라미터

**예시**
```go
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// 중첩 경로
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

### Interceptor

```go
Interceptor(interceptors ...core.Interceptor)
```

Interceptor를 등록합니다. 등록 순서대로 `PreHandle`이 실행되고, 역순으로 `PostHandle`과 `AfterCompletion`이 실행됩니다.

**매개변수**
- `interceptors` - Interceptor 인스턴스들 (가변 인자)

**예시**
```go
app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "OPTIONS"},
        AllowHeaders: []string{"Content-Type"},
    }),
    &LoggingInterceptor{},
    &AuthInterceptor{},
)
```

### Run

```go
Run(address string) error
```

HTTP 서버를 시작합니다. 이 메서드는 블로킹됩니다.

**매개변수**
- `address` - 리스닝 주소 (예: `":8080"`, `"127.0.0.1:3000"`)

**반환값**
- `error` - 서버 시작 실패 시 에러

**예시**
```go
if err := app.Run(":8080"); err != nil {
    log.Fatal(err)
}
```

## 전체 예시

```go
package main

import (
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
)

func main() {
    app := spine.New()

    // 생성자 등록
    app.Constructor(
        NewUserRepository,
        NewUserController,
    )

    // 라우트 등록
    app.Route("GET", "/users", (*UserController).List)
    app.Route("GET", "/users/:id", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)

    // Interceptor 등록
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
        }),
        &LoggingInterceptor{},
    )

    // 서버 실행
    app.Run(":8080")
}
```

## 부트스트랩 순서

`Run()` 호출 시 다음 순서로 초기화됩니다:

1. IoC Container 생성
2. 생성자 등록
3. Router 구성 및 HandlerMeta 생성
4. Controller Warm-up (의존성 미리 해결)
5. Pipeline 구성
6. ArgumentResolver 등록
7. ReturnValueHandler 등록
8. Interceptor 등록
9. HTTP 서버 시작

## 참고

- [Interceptor](/docs/api/interceptor) - Interceptor 인터페이스
- [실행 파이프라인](/docs/concepts/execution-pipeline) - 요청 처리 흐름
- [IoC Container](/docs/concepts/ioc-container) - 의존성 주입