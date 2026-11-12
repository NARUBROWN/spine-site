# JWT 로그인 예제

회원가입과 로그인 API를 만들고, 로그인할 때 발급한 JWT로 내 정보를 조회합니다. 인증 인터셉터는 `/me`에만 적용하므로 회원가입과 로그인은 토큰 없이 요청할 수 있습니다.

## 시작 전 준비

[CLI 설치](/ko/learn/getting-started/installation)에서 정식 Spine CLI를 설치하세요. 이 예제는 CLI `v0.4.4`와 코어 `v0.7.5`로 확인했습니다.

이 예제는 인증 흐름을 익히기 위해 메모리 저장소, 평문 비밀번호 비교, 코드에 고정한 JWT 비밀키를 사용합니다. 서버를 종료하면 가입 정보가 사라집니다. 실제 서비스에 적용하기 전에는 비밀번호 해시와 환경변수로 관리하는 JWT 비밀키를 사용해야 합니다.

## 1. 프로젝트 생성

기본 앱과 JWT 의존성을 준비합니다. 이후 명령은 `login-example/`에서 실행합니다.

아래 명령은 `main` 채널의 정식 의존성을 선택합니다. 생성된 `go.mod`에서 코어와 플랫폼 버전을 확인하세요.

```sh
spine new login-example --module example.com/login-example --channel main --validator playground --no-interactive
cd login-example
spine doctor
go get github.com/golang-jwt/jwt/v5@v5.3.1
```

### 파일 배치

다음 단계에서 `src/` 아래에 네 파일을 추가하고, 생성된 `internal/application/application.go`를 교체합니다. 루트의 `main.go`와 `spine.toml`은 그대로 사용합니다.

```text
login-example/
├── go.mod
├── go.sum
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

## 2. 사용자 모델과 요청 및 응답 정의

`src/model/user.go`를 새로 만듭니다. `Password`의 `json:"-"` 태그는 비밀번호가 JSON 응답에 포함되지 않도록 합니다.

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
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type SignupRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
	Name     string `json:"name" validate:"required"`
}
```

## 3. 사용자 저장소 추가

`src/store/user_store.go`를 새로 만듭니다. 메모리에 사용자를 저장하고, 이메일과 ID로 조회합니다. 같은 이메일로 다시 가입하면 오류를 반환합니다.

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

## 4. 인증 인터셉터 추가

`src/interceptor/auth_interceptor.go`를 새로 만듭니다. `Authorization: Bearer <token>` 헤더에서 JWT를 읽고 서명과 만료 시각을 검증합니다. 검증한 `user_id`는 컨트롤러에서 읽을 수 있도록 실행 컨텍스트에 저장합니다.

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
	"strings"

	"github.com/NARUBROWN/spine/core"
	"github.com/NARUBROWN/spine/pkg/httperr"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key") // 실제 환경에서는 환경변수 사용

type AuthInterceptor struct{}

func (*AuthInterceptor) Constructor() *AuthInterceptor { return &AuthInterceptor{} }

func (i *AuthInterceptor) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	// Authorization 헤더에서 토큰 추출
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return httperr.Unauthorized("HTTP request required")
	}
	authHeader := request.Header("Authorization")
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
	ctx.ExecutionContext().Set("userID", userID)

	return nil
}

func (i *AuthInterceptor) PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error {
	return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error) {}
```

## 5. 인증 컨트롤러 추가

`src/controller/auth_controller.go`를 새로 만듭니다. 회원가입은 사용자를 저장하고, 로그인은 이메일과 비밀번호를 확인한 뒤 JWT를 발급합니다. 내 정보 조회는 인터셉터가 저장한 사용자 ID로 저장소를 조회합니다.

```go
// src/controller/auth_controller.go
package controller

import (
	"time"

	"example.com/login-example/src/interceptor"
	"example.com/login-example/src/model"
	"example.com/login-example/src/store"

	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/golang-jwt/jwt/v5"
)

type AuthController struct {
	userStore *store.UserStore
}

func (*AuthController) Constructor(userStore *store.UserStore) *AuthController {
	return &AuthController{userStore: userStore}
}

func (c *AuthController) RegisterRoutes(r *api.Registry) {
	// 회원가입 — 인증 불필요
	r.POST("/signup", func(req input.Body[model.SignupRequest]) (httpx.Response[model.User], error) {
		user, err := c.userStore.Create(req.Email, req.Password, req.Name)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
		}

		return httpx.Response[model.User]{Body: *user}, nil
	})

	// 로그인 — 인증 불필요
	r.POST("/login", func(req input.Body[model.LoginRequest]) (httpx.Response[model.LoginResponse], error) {
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
			return httpx.Response[model.LoginResponse]{}, err
		}

		return httpx.Response[model.LoginResponse]{
			Body: model.LoginResponse{
				Token: tokenString,
				User:  *user,
			},
		}, nil
	})

	// 내 정보 조회 — 인증 필요
	r.GET("/me", func(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
		// AuthInterceptor가 저장한 userID 조회
		userIDValue, ok := ctx.ExecutionContext().Get("userID")
		if !ok {
			return httpx.Response[model.User]{}, httperr.Unauthorized("인증 정보를 찾을 수 없습니다.")
		}

		userID, valid := userIDValue.(int64)
		if !valid {
			return httpx.Response[model.User]{}, httperr.Unauthorized("invalid authentication context")
		}
		user, err := c.userStore.FindByID(userID)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.NotFound("사용자를 찾을 수 없습니다.")
		}

		return httpx.Response[model.User]{Body: *user}, nil
	}, api.Interceptors((*interceptor.AuthInterceptor)(nil)))
}
```

## 6. 생성자와 인증 라우트 등록

`internal/application/application.go` 전체를 다음 코드로 교체합니다. 저장소와 컨트롤러 생성자를 등록하고 `/me`에만 인증 인터셉터를 연결합니다. 생성된 루트 `main.go`는 `BuildApplication`, `Validate`, `Run`을 순서대로 실행합니다.

내장 CORS 인터셉터는 `Constructor` 메서드가 없으므로 `constructor.Custom` 팩토리를 `app.Constructor`에 등록합니다. 설정은 등록 전에 검증하고, 팩토리가 객체를 생성하도록 합니다. 적용할 때는 `(*cors.CORSInterceptor)(nil)`로 컨테이너에서 조회합니다.

```go
// internal/application/application.go
package application

import (
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"time"

	"example.com/login-example/src/controller"
	"example.com/login-example/src/interceptor"
	"example.com/login-example/src/store"

	"github.com/NARUBROWN/spine"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/interceptor/cors"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Custom(store.NewUserStore), constructor.Interceptor(&interceptor.AuthInterceptor{}), constructor.Controller(&controller.AuthController{}))

	corsConfig := cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}
	if err := cors.ValidateConfig(corsConfig); err != nil {
		return nil, boot.Options{}, err
	}
	app.Constructor(constructor.Custom(func() *cors.CORSInterceptor {
		return cors.New(corsConfig)
	}))
	app.InterceptorFor(boot.InterceptorHTTP, (*cors.CORSInterceptor)(nil))

	return app, boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP:                   &boot.HTTPOptions{},
	}, nil
}
```

## 7. 검증하고 서버 실행

프로젝트 루트에서 형식을 정리하고 의존성과 코드를 검사한 뒤 서버를 실행합니다.

```sh
gofmt -w src internal/application
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

`contract check`는 정적 계약을 검사합니다. `verify`는 정적 계약과 gofmt, go vet, Go 테스트를 검사합니다. 실제 회원가입과 로그인, 인증은 다음 HTTP 요청으로 확인합니다.

## 8. 회원가입과 인증 요청 확인

서버를 실행한 상태에서 다른 터미널을 열어 아래 요청을 순서대로 보냅니다. 새 서버에서 첫 가입자의 ID는 `1`입니다.

### 회원가입

```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```

HTTP 200과 가입한 사용자 정보가 반환됩니다. 비밀번호는 응답에 포함되지 않습니다.

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

HTTP 200과 JWT가 반환됩니다. 아래 응답은 토큰을 줄여 표시한 예시입니다. `/me`를 요청할 때는 실제 응답의 `token` 값을 사용합니다.

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

### 토큰 없이 내 정보 조회

인증 헤더 없이 `/me`를 요청합니다.

```bash
curl http://localhost:8080/me
```

HTTP 401과 다음 오류 메시지가 반환됩니다.

```json
{
  "message": "토큰이 필요합니다."
}
```

### 토큰으로 내 정보 조회

로그인 응답의 `token` 값을 생략 없이 복사합니다. 먼저 아래 `read` 명령을 실행하고, 입력을 기다리는 상태에서 토큰을 붙여넣은 뒤 Enter를 누릅니다. 이어 `curl` 명령으로 `/me`를 요청합니다.

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

토큰이 유효하면 HTTP 200과 해당 사용자의 정보가 반환됩니다.

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

## 인증 인터셉터가 실행되는 순서

CORS 인터셉터는 모든 라우트에서 실행됩니다. 인증 인터셉터는 `/me`에서 토큰을 검증한 뒤 컨트롤러에 사용자 ID를 전달합니다.

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
   │       └─ 토큰 유효 → ctx.ExecutionContext().Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + 사용자 정보
```

## 라우트별 인증 범위

| 라우트 | 메서드 | 인터셉터 | 설명 |
|--------|--------|----------|------|
| `/signup` | POST | CORS | 토큰 없이 회원가입 |
| `/login` | POST | CORS | 토큰 없이 로그인 후 JWT 발급 |
| `/me` | GET | CORS, Auth | JWT 검증 후 내 정보 조회 |

## 다음 단계

[인터셉터 API](/ko/reference/api/interceptor)에서 실행 순서와 각 메서드의 역할을 확인하세요. 사용자 정보를 영속적으로 저장하려면 [데이터베이스 연결](/ko/learn/tutorial/5-database)을 참고하세요.
