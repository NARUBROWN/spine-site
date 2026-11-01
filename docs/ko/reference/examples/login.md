# JWT 로그인 예제

Spine으로 JWT 기반 로그인을 구현합니다.

## 프로젝트 구조

```text
login-example/
├── go.mod
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    ├── controller/auth_controller.go
    ├── interceptor/auth_interceptor.go
    ├── model/user.go
    └── store/user_store.go
```


## CLI로 프로젝트 생성

[CLI 설치](/ko/learn/getting-started/installation)를 먼저 완료합니다. CLI 0.1.4는 JWT 인증 생성기를 제공하지 않으므로, 기본 프로젝트를 생성한 뒤 아래 인증 코드를 `src/`에 직접 추가합니다.

```sh
spine new login-example --module example.com/login-example
cd login-example
go mod tidy
spine doctor
go get github.com/golang-jwt/jwt/v5
```

## 모델 정의

```go
// src/model/user.go
package model

type User struct {
    ID       int64  `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"` // JSON 응답에서 제외
    Name     string `json:"name"`
}

type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type LoginResponse struct {
    Token string `json:"token"`
    User  User   `json:"user"`
}

type SignupRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
    Name     string `json:"name"`
}
```


## 유저 저장소

인메모리 저장소로 간단하게 구현합니다.

```go
// src/store/user_store.go
package store

import (
    "errors"
    "example.com/login-example/src/model"
    "sync"
)

type UserStore struct {
    mu     sync.RWMutex
    users  map[int64]*model.User
    nextID int64
}

func NewUserStore() *UserStore {
    return &UserStore{
        users:  make(map[int64]*model.User),
        nextID: 1,
    }
}

func (s *UserStore) Create(email, password, name string) (*model.User, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 이메일 중복 체크
    for _, u := range s.users {
        if u.Email == email {
            return nil, errors.New("email already exists")
        }
    }

    user := &model.User{
        ID:       s.nextID,
        Email:    email,
        Password: password,
        Name:     name,
    }
    s.users[s.nextID] = user
    s.nextID++

    return user, nil
}

func (s *UserStore) FindByEmail(email string) (*model.User, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    for _, u := range s.users {
        if u.Email == email {
            return u, nil
        }
    }
    return nil, errors.New("user not found")
}

func (s *UserStore) FindByID(id int64) (*model.User, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    user, ok := s.users[id]
    if !ok {
        return nil, errors.New("user not found")
    }
    return user, nil
}
```


## 인증 인터셉터

JWT 토큰을 검증하는 라우트 인터셉터입니다.

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
    "strings"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key") // 실제 환경에서는 환경변수 사용

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Authorization 헤더에서 토큰 추출
    authHeader := ctx.Header("Authorization")
    if authHeader == "" {
        return httperr.Unauthorized("토큰이 필요합니다.")
    }

    // "Bearer {token}" 형식 파싱
    parts := strings.Split(authHeader, " ")
    if len(parts) != 2 || parts[0] != "Bearer" {
        return httperr.Unauthorized("잘못된 토큰 형식입니다.")
    }

    tokenString := parts[1]

    // JWT 토큰 검증
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, httperr.Unauthorized("잘못된 서명 방식입니다.")
        }
        return JWTSecret, nil
    }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

    if err != nil || !token.Valid {
        return httperr.Unauthorized("유효하지 않은 토큰입니다.")
    }

    // 토큰에서 사용자 ID 추출
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("토큰 클레임을 읽을 수 없습니다.")
    }

    rawID, ok := claims["user_id"].(float64)
    if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
        return httperr.Unauthorized("Invalid user ID claim.")
    }
    userID := int64(rawID)
    
    // ExecutionContext에 사용자 ID 저장
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```


## 컨트롤러

로그인, 회원가입, 내 정보 조회 기능을 구현합니다.

```go
// src/controller/auth_controller.go
package controller

import (
    "time"

    "example.com/login-example/src/interceptor"
    "example.com/login-example/src/model"
    "example.com/login-example/src/store"

    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/golang-jwt/jwt/v5"
)

type AuthController struct {
    userStore *store.UserStore
}

func NewAuthController(userStore *store.UserStore) *AuthController {
    return &AuthController{
        userStore: userStore,
    }
}

// 회원가입 — 인증 불필요
func (c *AuthController) Signup(req *model.SignupRequest) (httpx.Response[model.User], error) {
    if req.Email == "" || req.Password == "" || req.Name == "" {
        return httpx.Response[model.User]{}, httperr.BadRequest("모든 필드를 입력해주세요.")
    }

    user, err := c.userStore.Create(req.Email, req.Password, req.Name)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
    }

    return httpx.Response[model.User]{Body: *user}, nil
}

// 로그인 — 인증 불필요
func (c *AuthController) Login(req *model.LoginRequest) (httpx.Response[model.LoginResponse], error) {
    if req.Email == "" || req.Password == "" {
        return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("이메일과 비밀번호를 입력해주세요.")
    }

    user, err := c.userStore.FindByEmail(req.Email)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // 비밀번호 확인 (실제로는 bcrypt 등으로 해시 비교)
    if user.Password != req.Password {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // JWT 토큰 생성
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(interceptor.JWTSecret)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("토큰 생성에 실패했습니다.")
    }

    return httpx.Response[model.LoginResponse]{
        Body: model.LoginResponse{
            Token: tokenString,
            User:  *user,
        },
    }, nil
}

// 내 정보 조회 — 인증 필요
func (c *AuthController) GetMe(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
    // AuthInterceptor가 저장한 userID 조회
    userIDValue, ok := ctx.Get("userID")
    if !ok {
        return httpx.Response[model.User]{}, httperr.Unauthorized("인증 정보를 찾을 수 없습니다.")
    }

    userID := userIDValue.(int64)
    user, err := c.userStore.FindByID(userID)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.NotFound("사용자를 찾을 수 없습니다.")
    }

    return httpx.Response[model.User]{Body: *user}, nil
}
```


## 앱 구성

생성된 루트 `main.go`는 그대로 유지합니다. `BuildApplication` → `Validate` → `Run` 순서로 실행하며, 다음 코드는 `internal/application/application.go`를 대체합니다.

```go
// internal/application/application.go
package application

import (
    "time"

    "example.com/login-example/src/controller"
    "example.com/login-example/src/interceptor"
    "example.com/login-example/src/store"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/route"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(store.NewUserStore, controller.NewAuthController)

    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders: []string{"Content-Type", "Authorization"},
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
    app.Route("POST", "/signup", (*controller.AuthController).Signup)
    app.Route("POST", "/login", (*controller.AuthController).Login)
    app.Route("GET", "/me", (*controller.AuthController).GetMe,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 검증과 실행

```sh
gofmt -w src internal/application
go mod tidy
spine contract check
spine verify
spine dev
```

`contract check`는 정적 계약, `verify`는 계약·gofmt·vet·Go 테스트를 확인합니다. 실제 가입·로그인·인증 요청은 아래 HTTP 테스트로 별도 확인합니다. 메모리 저장소와 평문 비밀번호 비교는 학습용입니다. 실제 서비스에서는 비밀번호 해시와 환경변수 기반 JWT 비밀키를 사용하세요.

## API 테스트

### 회원가입

```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```

응답:

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

### 로그인

```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234"}'
```

응답:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "name": "Alice"
  }
}
```

### 내 정보 조회 (인증 필요)

토큰 없이 요청:

```bash
curl http://localhost:8080/me
```

응답:

```json
{
  "message": "토큰이 필요합니다."
}
```

토큰과 함께 요청:

로그인 응답의 `token` 값을 생략 없이 복사합니다. 아래 `read` 명령을 실행하면 그 토큰을 붙여넣고 Enter를 누른 뒤 `/me` 요청을 실행합니다.

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

응답:

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```


## 라우트 인터셉터 동작 흐름

```
POST /signup (공개)
   │
   ├─→ CORS.PreHandle (전역)
   ├─→ AuthController.Signup
   └─→ Response 200

POST /login (공개)
   │
   ├─→ CORS.PreHandle (전역)
   ├─→ AuthController.Login
   └─→ Response 200 + JWT 토큰

GET /me (보호됨)
   │
   ├─→ CORS.PreHandle (전역)
   ├─→ Auth.PreHandle (라우트) ← 토큰 검증
   │       │
   │       ├─ 토큰 없음 → 401 Unauthorized
   │       └─ 토큰 유효 → ctx.Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + 사용자 정보
```


## 핵심 정리

| 라우트 | 메서드 | 인터셉터 | 설명 |
|--------|--------|----------|------|
| `/signup` | POST | 전역만 | 회원가입 (공개) |
| `/login` | POST | 전역만 | 로그인 후 JWT 발급 (공개) |
| `/me` | GET | 전역 + Auth | 내 정보 조회 (인증 필요) |
