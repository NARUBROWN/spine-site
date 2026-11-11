# JWT Login Example

Build signup and login APIs, then retrieve your profile using the JWT issued at login. The authentication interceptor applies only to `/me`, so signup and login requests do not require a token.

## Prerequisites

Install the stable [Spine CLI](/en/learn/getting-started/installation). This example uses CLI `v0.4.4` and core `v0.7.5`.

This example uses an in-memory store, plaintext password comparison, and a JWT secret hardcoded in the source to teach the authentication flow. Registered users disappear when the server stops. Before using this in a real service, use password hashing and a JWT secret managed through environment variables.

## 1. Create the Project

Prepare a basic app and the JWT dependency. Run subsequent commands from `login-example/`.

The commands below select stable dependencies from the `main` channel. Check the core and platform versions in the generated `go.mod`.

```sh
spine new login-example --module example.com/login-example --channel main --validator playground --no-interactive
cd login-example
spine doctor
go get github.com/golang-jwt/jwt/v5@v5.3.1
```

### File Layout

In the next steps, add four files under `src/` and replace the generated `internal/application/application.go`. Keep the root `main.go` and `spine.toml` as generated.

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

## 2. Define the User Model, Requests, and Responses

Create `src/model/user.go`. The `json:"-"` tag on `Password` excludes the password from JSON responses.

```go
// src/model/user.go
package model

type User struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	Password string `json:"-"` // Exclude from the JSON response
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

## 3. Add the User Store

Create `src/store/user_store.go`. It stores users in memory and retrieves them by email address or ID. It returns an error if someone signs up again with the same email address.

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

	// Check for duplicate emails
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

## 4. Add the Authentication Interceptor

Create `src/interceptor/auth_interceptor.go`. It reads a JWT from the `Authorization: Bearer <token>` header and verifies its signature and expiration time. It stores the verified `user_id` in the execution context so the controller can read it.

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

var JWTSecret = []byte("your-secret-key") // Use an environment variable in production

type AuthInterceptor struct{}

func (*AuthInterceptor) Constructor() *AuthInterceptor { return &AuthInterceptor{} }

func (i *AuthInterceptor) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	// Extract the token from the Authorization header
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return httperr.Unauthorized("HTTP request required")
	}
	authHeader := request.Header("Authorization")
	if authHeader == "" {
		return httperr.Unauthorized("A token is required.")
	}

	// Parse the "Bearer {token}" format
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return httperr.Unauthorized("Invalid token format.")
	}

	tokenString := parts[1]

	// Validate the JWT token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, httperr.Unauthorized("Invalid signing method.")
		}
		return JWTSecret, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

	if err != nil || !token.Valid {
		return httperr.Unauthorized("The token is invalid.")
	}

	// Extract the user ID from the token
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return httperr.Unauthorized("Unable to read token claims.")
	}

	rawID, ok := claims["user_id"].(float64)
	if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
		return httperr.Unauthorized("Invalid user ID claim.")
	}
	userID := int64(rawID)

	// Store the user ID in ExecutionContext
	ctx.ExecutionContext().Set("userID", userID)

	return nil
}

func (i *AuthInterceptor) PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error {
	return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error) {}
```

## 5. Add the Authentication Controller

Create `src/controller/auth_controller.go`. Signup saves a user, and login checks the email address and password before issuing a JWT. The profile endpoint queries the store using the user ID saved by the interceptor.

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
	// Registration, no authentication required
	r.POST("/signup", func(req input.Body[model.SignupRequest]) (httpx.Response[model.User], error) {
		user, err := c.userStore.Create(req.Email, req.Password, req.Name)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
		}

		return httpx.Response[model.User]{Body: *user}, nil
	})

	// Login, no authentication required
	r.POST("/login", func(req input.Body[model.LoginRequest]) (httpx.Response[model.LoginResponse], error) {
		user, err := c.userStore.FindByEmail(req.Email)
		if err != nil {
			return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("Email or password is incorrect.")
		}

		// Check the password; in production, compare hashes with bcrypt or similar
		if user.Password != req.Password {
			return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("Email or password is incorrect.")
		}

		// Create a JWT token
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

	// Read the current user's profile, authentication required
	r.GET("/me", func(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
		// Read the userID stored by AuthInterceptor
		userIDValue, ok := ctx.ExecutionContext().Get("userID")
		if !ok {
			return httpx.Response[model.User]{}, httperr.Unauthorized("Authentication information was not found.")
		}

		userID, valid := userIDValue.(int64)
		if !valid {
			return httpx.Response[model.User]{}, httperr.Unauthorized("invalid authentication context")
		}
		user, err := c.userStore.FindByID(userID)
		if err != nil {
			return httpx.Response[model.User]{}, httperr.NotFound("User was not found.")
		}

		return httpx.Response[model.User]{Body: *user}, nil
	}, api.Interceptors((*interceptor.AuthInterceptor)(nil)))
}
```

## 6. Register Constructors and Authentication Routes

Replace the entire contents of `internal/application/application.go` with the following code. Register the store and controller constructors, and attach the authentication interceptor only to `/me`. The generated root `main.go` calls `BuildApplication`, `Validate`, and `Run` in that order.

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

	corsInterceptor, err := cors.NewValidated(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	})
	if err != nil {
		return nil, boot.Options{}, err
	}
	app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)

	return app, boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP:                   &boot.HTTPOptions{},
	}, nil
}
```

## 7. Validate and Start the Server

From the project root, format the code, check dependencies and code, and start the server.

```sh
gofmt -w src internal/application
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

`contract check` checks static contracts. `verify` checks static contracts, gofmt, go vet, and Go tests. Use the HTTP requests below to check actual signup, login, and authentication.

## 8. Test Signup and Authentication Requests

With the server running, open another terminal and send the following requests in order. The first registered user on a fresh server has the ID `1`.

### Sign Up

```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```

The response returns HTTP 200 and the registered user's details. It does not include the password.

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

### Log In

```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234"}'
```

The response returns HTTP 200 and a JWT. The example response below shows an abbreviated token. Use the actual response's `token` value when requesting `/me`.

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

### Retrieve Your Profile Without a Token

Request `/me` without an authentication header.

```bash
curl http://localhost:8080/me
```

The response returns HTTP 401 and the following error message.

```json
{
  "message": "A token is required."
}
```

### Retrieve Your Profile with a Token

Copy the full `token` value from the login response. First run the `read` command below. When it waits for input, paste the token and press Enter. Then use the `curl` command to request `/me`.

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

If the token is valid, the response returns HTTP 200 and that user's details.

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

## Authentication Interceptor Execution Order

The CORS interceptor runs on every route. On `/me`, the authentication interceptor verifies the token and passes the user ID to the controller.

```
POST /signup (public)
   │
   ├─→ CORS.PreHandle (global)
   ├─→ AuthController.Signup
   └─→ Response 200

POST /login (public)
   │
   ├─→ CORS.PreHandle (global)
   ├─→ AuthController.Login
   └─→ Response 200 + JWT token

GET /me (protected)
   │
   ├─→ CORS.PreHandle (global)
   ├─→ Auth.PreHandle (route) ← Verify token
   │       │
   │       ├─ No token → 401 Unauthorized
   │       └─ Valid token → ctx.ExecutionContext().Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + user details
```

## Authentication Scope by Route

| Route | Method | Interceptors | Description |
|--------|--------|----------|------|
| `/signup` | POST | CORS | Sign up without a token |
| `/login` | POST | CORS | Log in without a token and receive a JWT |
| `/me` | GET | CORS, Auth | Verify the JWT and retrieve your profile |

## Next Steps

See the [Interceptor API](/en/reference/api/interceptor) for the execution order and each method's role. To persist user data, see [Database Connection](/en/learn/tutorial/5-database).
