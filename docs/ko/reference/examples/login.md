# JWT 로그인 예제

Spine으로 JWT 기반 로그인을 구현합니다.

## 프로젝트 구조

```
login-example/
├── go.mod
├── main.go
├── controller/
│   └── auth_controller.go
├── interceptor/
│   └── auth_interceptor.go
├── model/
│   └── user.go
└── store/
    └── user_store.go
```


## 프로젝트 생성

```bash
mkdir login-example
cd login-example
go mod init login-example
```

## 의존성 설치

```bash
go get github.com/NARUBROWN/spine
go get github.com/golang-jwt/jwt/v5
```


## 모델 정의

```go
// model/user.go
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
// store/user_store.go
package store

import (
    "errors"
    "login-example/model"
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
// interceptor/auth_interceptor.go
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
    })

    if err != nil || !token.Valid {
        return httperr.Unauthorized("유효하지 않은 토큰입니다.")
    }

    // 토큰에서 사용자 ID 추출
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("토큰 클레임을 읽을 수 없습니다.")
    }

    userID := int64(claims["user_id"].(float64))
    
    // ExecutionContext에 사용자 ID 저장
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```


## 컨트롤러

로그인, 회원가입, 내 정보 조회 기능을 구현합니다.

```go
// controller/auth_controller.go
package controller

import (
    "time"

    "login-example/interceptor"
    "login-example/model"
    "login-example/store"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
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
func (c *AuthController) Signup(req model.SignupRequest) (model.User, error) {
    if req.Email == "" || req.Password == "" || req.Name == "" {
        return model.User{}, httperr.BadRequest("모든 필드를 입력해주세요.")
    }

    user, err := c.userStore.Create(req.Email, req.Password, req.Name)
    if err != nil {
        return model.User{}, httperr.BadRequest(err.Error())
    }

    return *user, nil
}

// 로그인 — 인증 불필요
func (c *AuthController) Login(req model.LoginRequest) (model.LoginResponse, error) {
    if req.Email == "" || req.Password == "" {
        return model.LoginResponse{}, httperr.BadRequest("이메일과 비밀번호를 입력해주세요.")
    }

    user, err := c.userStore.FindByEmail(req.Email)
    if err != nil {
        return model.LoginResponse{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // 비밀번호 확인 (실제로는 bcrypt 등으로 해시 비교)
    if user.Password != req.Password {
        return model.LoginResponse{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // JWT 토큰 생성
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(interceptor.JWTSecret)
    if err != nil {
        return model.LoginResponse{}, httperr.BadRequest("토큰 생성에 실패했습니다.")
    }

    return model.LoginResponse{
        Token: tokenString,
        User:  *user,
    }, nil
}

// 내 정보 조회 — 인증 필요
func (c *AuthController) GetMe(ctx core.ExecutionContext) (model.User, error) {
    // AuthInterceptor가 저장한 userID 조회
    userIDValue, ok := ctx.Get("userID")
    if !ok {
        return model.User{}, httperr.Unauthorized("인증 정보를 찾을 수 없습니다.")
    }

    userID := userIDValue.(int64)
    user, err := c.userStore.FindByID(userID)
    if err != nil {
        return model.User{}, httperr.NotFound("사용자를 찾을 수 없습니다.")
    }

    return *user, nil
}
```


## main.go

라우트를 등록하고 서버를 시작합니다.

```go
// main.go
package main

import (
    "log"

    "login-example/controller"
    "login-example/interceptor"
    "login-example/store"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/route"
)

func main() {
    app := spine.New()

    // 생성자 등록
    app.Constructor(
        store.NewUserStore,
        controller.NewAuthController,
    )

    // 전역 인터셉터 — CORS
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
            AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
            AllowHeaders: []string{"Content-Type", "Authorization"},
        }),
    )

    // 공개 라우트 — 인증 불필요
    app.Route("POST", "/signup", (*controller.AuthController).Signup)
    app.Route("POST", "/login", (*controller.AuthController).Login)

    // 보호된 라우트 — 인증 필요 (라우트 인터셉터 사용)
    app.Route(
        "GET",
        "/me",
        (*controller.AuthController).GetMe,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )

    log.Println("서버 시작: http://localhost:8080")
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
	})
}
```


## 실행

```bash
go run .
```


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

```bash
curl http://localhost:8080/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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