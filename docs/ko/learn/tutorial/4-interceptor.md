# 인터셉터

인터셉터 생성 및 사용하기.

## CLI 프로젝트에서 시작

[첫 앱](/ko/learn/getting-started/first-app)과 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)의 `example.com/my-app`을 사용합니다. 사용자 리소스가 아직 없다면 프로젝트 루트에서 생성합니다.

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

텍스트 미리보기에서 생성 파일을 확인한 뒤 일반 생성 명령을 실행합니다. 이미 만든 리소스라면 다시 생성하지 않습니다.

CLI는 `src/user`와 `BuildApplication`의 `user.Register(app)`를 생성합니다. 인터셉터 생성기는 없으므로 아래 `src/interceptor` 파일은 직접 작성합니다. 로그인·수정·주문 같은 추가 메서드는 정책 설명용 수동 확장이며 생성물에 포함되지 않습니다. 앱 등록은 `internal/application/application.go`, 라우트 정책은 `src/user/user_route.go`에 작성하고, 루트 `main.go`의 구성·검증·실행 흐름을 유지합니다.


## 인터셉터란?

인터셉터는 요청 전/후에 실행되는 로직입니다.

- 트랜잭션 관리
- 로깅
- 인증/인가
- 요청 검증

## 라이프사이클

Spine v0.5.1 인터셉터는 4단계 라이프사이클을 가집니다.

```mermaid
graph TD
    Request
    Request --> Pre["PreHandle<br/>- 요청 전 실행<br/>- 에러 반환 시 요청 중단"]
    
    Pre --> Controller["Controller.Method()<br/>- 비즈니스 로직 실행"]
    
    Controller -- 성공 --> Post["PostHandle<br/>- 요청 성공 시 실행<br/>- 에러 발생 시 스킵"]
    
    Post --> Before["BeforeResponse<br/>- 응답 flush 전 역순 실행<br/>- 트랜잭션 커밋/롤백"]
    
    Controller -- 에러 --> Before
    Before --> After["AfterCompletion<br/>- 응답 후 항상 실행<br/>- 로깅, 리소스 정리"]
    
    After --> Response
```


## 인터페이스

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| 메서드 | 실행 시점 | 반환 | 용도 |
|--------|----------|------|------|
| `PreHandle` | 컨트롤러 실행 전 | `error` | 인증, 검증, 트랜잭션 시작 |
| `PostHandle` | 컨트롤러 성공 후 | 없음 | 응답 가공 |
| `BeforeResponse` | 응답을 실제로 쓰기 전 | `error` | transaction commit/rollback |
| `AfterCompletion` | 응답 처리 후 항상 | 없음 | 로깅, 리소스 정리 |

`BeforeResponse`는 직렬화, 쿠키, status 검증 오류를 `executionErr`로 받습니다. transaction 결과 오류는 반드시 반환하십시오. `AfterCompletion` 시점에는 응답이 이미 기록되었을 수 있습니다.


## 전역 인터셉터 vs 라우트 인터셉터

Spine은 두 가지 레벨의 인터셉터를 지원합니다.

| 구분 | 전역 인터셉터 | 라우트 인터셉터 |
|------|--------------|----------------|
| 적용 범위 | 모든 요청 | 특정 라우트만 |
| 등록 방법 | `app.Interceptor()` | `route.WithInterceptors()` |
| 용도 | CORS, 로깅, 트랜잭션 | 인증, 권한 검사 |
| 실행 순서 | 먼저 실행 | 전역 이후 실행 |


## 전역 인터셉터

모든 요청에 적용되는 인터셉터입니다.

### 로깅 인터셉터 예제

```go
// src/interceptor/logging_interceptor.go
package interceptor

import (
    "log"
    "github.com/NARUBROWN/spine/core"
)

type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK",
        ctx.Method(),
        ctx.Path(),
    )
}

func (i *LoggingInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v",
            ctx.Method(),
            ctx.Path(),
            err,
        )
    }
}
```

전역 HTTP `PreHandle`은 라우팅 전에 실행되므로 `HandlerMeta`의 타입과 메서드가 비어 있을 수 있습니다. 생성된 `NewHealthController`는 유지합니다.

### 전역 인터셉터 등록

```go
// internal/application/application.go
package application

import (
    "os"

    "example.com/my-app/src/interceptor"
    "example.com/my-app/src/user"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)
    app.Interceptor(&interceptor.LoggingInterceptor{})

    if err := user.Register(app); err != nil {
        return nil, boot.Options{}, err
    }

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```


## 라우트 인터셉터

특정 라우트에만 적용되는 인터셉터입니다.

### 인증 인터셉터 예제

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
    "errors"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
)

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    
    if token == "" {
        return httperr.Unauthorized("인증이 필요합니다.")
    }
    
    user, err := validateToken(token)
    if err != nil {
        return httperr.Unauthorized("유효하지 않은 토큰입니다.")
    }
    
    ctx.Set("currentUser", user)
    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error { return nil }

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}

func validateToken(token string) (map[string]string, error) {
    if token != "Bearer demo-token" {
        return nil, errors.New("invalid demo token")
    }
    return map[string]string{"id": "1", "name": "Alice"}, nil
}
```

토큰 검사는 동작 확인용 공개 데모입니다. 실제 앱에서는 인증 서비스로 교체하세요. 생성된 `GET /user/:id` 등록을 아래 코드로 수정하고, `BuildApplication`의 `user.Register(app)`는 유지합니다.

### 라우트 인터셉터 등록

`route.WithInterceptors()`를 사용합니다.

```go
// src/user/user_route.go
package user

import (
    "example.com/my-app/src/interceptor"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/route"
)

func Register(app spine.App) error {
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    app.Route(
        "GET",
        "/user/:id",
        (*UserController).Get,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )
    return nil
}
```


## 전역 + 라우트 인터셉터 조합

실제 애플리케이션에서는 두 가지를 함께 사용합니다.

```go
// internal/application/application.go
package application

import (
    "os"

    "example.com/my-app/src/interceptor"
    "example.com/my-app/src/user"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/interceptor/cors"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)
    app.Interceptor(&interceptor.LoggingInterceptor{})
    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins:     []string{"https://app.example.com"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Authorization", "Content-Type"},
        AllowCredentials: true,
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)

    if err := user.Register(app); err != nil {
        return nil, boot.Options{}, err
    }

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```


## 실행 순서

전역 인터셉터가 먼저, 라우트 인터셉터가 나중에 실행됩니다.

### 등록 예시

```go
// 전역 인터셉터
app.Interceptor(
    &interceptor.LoggingInterceptor{},   // 전역 1
    &interceptor.CORSInterceptor{},      // 전역 2
)

// 라우트 인터셉터
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&interceptor.AuthInterceptor{}),  // 라우트 1
)
```

### 실행 흐름

```
Request (GET /users/1)
   │
   ├─→ Logging.PreHandle     (전역 1)
   ├─→ CORS.PreHandle        (전역 2)
   ├─→ Auth.PreHandle        (라우트 1)
   │
   ├─→ UserController.GetUser
   │
   ├─→ Auth.PostHandle       (라우트 1)
   ├─→ CORS.PostHandle       (전역 2)
   ├─→ Logging.PostHandle    (전역 1)
   │
   ├─→ Auth.BeforeResponse       (라우트 1)
   ├─→ CORS.BeforeResponse       (전역 2)
   ├─→ Logging.BeforeResponse    (전역 1)
   │
   ├─→ Auth.AfterCompletion       (라우트 1)
   ├─→ CORS.AfterCompletion       (전역 2)
   └─→ Logging.AfterCompletion    (전역 1)
   
Response
```

- `PreHandle`: 전역 → 라우트 순서
- `PostHandle`: 라우트 → 전역 역순
- `BeforeResponse`: `PreHandle`에 성공한 인터셉터만 라우트 → 전역 역순
- `AfterCompletion`: 라우트 → 전역 역순


## 에러 처리

### PreHandle에서 에러 반환

`PreHandle`에서 에러를 반환하면 요청이 중단됩니다.

```go
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("인증이 필요합니다.")
    }
    return nil
}
```

```
Request (GET /users/1, 토큰 없음)
   │
   ├─→ Logging.PreHandle     ✓
   ├─→ CORS.PreHandle        ✓
   ├─→ Auth.PreHandle        ✗ (에러 반환)
   │
   ├─→ CORS.BeforeResponse
   ├─→ Logging.BeforeResponse
   │
   ├─→ Auth.AfterCompletion
   ├─→ CORS.AfterCompletion
   └─→ Logging.AfterCompletion
   
Response (401 Unauthorized)
```


## ExecutionContext

요청 컨텍스트에서 값을 저장하고 조회합니다.

### 메서드

| 메서드 | 설명 |
|--------|------|
| `Context()` | `context.Context` 반환 |
| `Method()` | HTTP 메서드 (GET, POST 등) |
| `Path()` | 요청 경로 |
| `Header(name)` | 헤더 값 조회 |
| `Set(key, value)` | 값 저장 |
| `Get(key)` | 값 조회 |

### 인터셉터 간 데이터 전달

아래 코드는 `PreHandle`에서 컨텍스트를 공유하는 부분만 발췌한 예입니다. 새 타입을 실제로 등록하려면 네 수명주기 메서드를 모두 구현해야 합니다.

```go
// AuthInterceptor — 사용자 정보 저장
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    user, err := validateToken(token)
    if err != nil {
        return httperr.Unauthorized("invalid credentials")
    }
    ctx.Set("currentUser", user)
    return nil
}

// 컨트롤러에서는 읽기 전용 spine.Ctx로 조회
// 또는 다른 인터셉터에서 조회
func (i *AuditInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    user, ok := ctx.Get("currentUser")
    if ok {
        log.Printf("User %v accessing %s", user, ctx.Path())
    }
    return nil
}
```


## HandlerMeta

실행될 핸들러의 메타 정보입니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `ControllerType` | `reflect.Type` | 컨트롤러 타입 |
| `Method` | `reflect.Method` | 핸들러 메서드 |
| `Interceptors` | `[]Interceptor` | 라우트에 바인딩된 인터셉터 |

### 사용 예시

```go
func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if meta.ControllerType != nil {
        log.Printf("컨트롤러: %s", meta.ControllerType.String())
    }
    log.Printf("메서드: %s", meta.Method.Name)              // GetUser
    return nil
}
```


## 의존성 주입이 필요한 인터셉터

생성자가 있는 인터셉터는 `Constructor`에 먼저 등록합니다.

### 트랜잭션 인터셉터 예제

```go
// src/interceptor/tx_interceptor.go
package interceptor

import (
    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct {
    db *bun.DB
}

func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TxInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    v, ok := ctx.Get("tx")
    if !ok {
        return nil
    }
    
    tx, ok := v.(bun.Tx)
    if !ok {
        return nil
    }
    if executionErr != nil {
        return tx.Rollback()
    } else {
        return tx.Commit()
    }
}

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```

### 등록 (전역)

```go
app.Constructor(
    NewDB,
    interceptor.NewTxInterceptor,
)

app.Interceptor(
    (*interceptor.TxInterceptor)(nil),  // 타입으로 참조
)
```

### 등록 (라우트)

```go
app.Constructor(
    NewDB,
    interceptor.NewTxInterceptor,
)

app.Route(
    "POST",
    "/orders",
    (*OrderController).CreateOrder,
    route.WithInterceptors((*interceptor.TxInterceptor)(nil)),  // 타입으로 참조
)
```


## 등록 방법 정리

### 전역 인터셉터

| 방식 | 코드 | 사용 시점 |
|------|------|----------|
| 인스턴스 직접 전달 | `&interceptor.LoggingInterceptor{}` | 의존성 없음 |
| 타입으로 참조 | `(*interceptor.TxInterceptor)(nil)` | 의존성 있음 |

```go
app.Interceptor(
    &interceptor.LoggingInterceptor{},      // 인스턴스
    (*interceptor.TxInterceptor)(nil),      // 타입 참조
)
```

### 라우트 인터셉터

| 방식 | 코드 | 사용 시점 |
|------|------|----------|
| 인스턴스 직접 전달 | `&interceptor.AuthInterceptor{}` | 의존성 없음 |
| 타입으로 참조 | `(*interceptor.TxInterceptor)(nil)` | 의존성 있음 |

```go
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(
        &interceptor.AuthInterceptor{},         // 인스턴스
        (*interceptor.TxInterceptor)(nil),      // 타입 참조
    ),
)
```


## 핵심 정리

| 개념 | 설명 |
|------|------|
| **전역 인터셉터** | `app.Interceptor()` — 모든 요청에 적용 |
| **라우트 인터셉터** | `route.WithInterceptors()` — 특정 라우트만 |
| **실행 순서** | 전역 → 라우트 (`PostHandle`/`BeforeResponse`/`AfterCompletion`은 역순) |
| **4단계 라이프사이클** | PreHandle → PostHandle → BeforeResponse → AfterCompletion |
| **에러 시 중단** | PreHandle 에러 → 컨트롤러 스킵 |
| **컨텍스트 공유** | `ctx.Set()` / `ctx.Get()`으로 데이터 전달 |


## 검증

프로젝트 루트에서 실행합니다. 정적 계약·로컬 Go 검증과 실제 HTTP·WebSocket 인증·DB E2E 검증은 별개입니다.

```sh
gofmt -w src/interceptor/*.go src/user/user_route.go internal/application/application.go
spine contract check
spine verify
spine dev
```

다른 터미널에서 확인합니다. health는 HTTP 200, 토큰 없는 사용자 요청은 401, 데모 토큰 요청은 200이어야 합니다. 마지막 응답에 지정한 origin의 CORS 헤더가 포함됩니다.

```bash
curl -i http://localhost:8080/health
curl -i http://localhost:8080/user/1
curl -i http://localhost:8080/user/1 \
  -H 'Authorization: Bearer demo-token' \
  -H 'Origin: https://app.example.com'
```

## 다음 단계

- [튜토리얼: 데이터베이스](/ko/learn/tutorial/5-database) — Bun ORM 연결
- [튜토리얼: 에러 처리](/ko/learn/tutorial/7-error-handling) — httperr 사용법
