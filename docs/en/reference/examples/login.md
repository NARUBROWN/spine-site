# JWT Login Example

Implement JWT-based login with Spine.

## Project Structure

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


## Create Project

```bash
mkdir login-example
cd login-example
go mod init login-example
```

## Install Dependencies

```bash
go get github.com/NARUBROWN/spine
go get github.com/golang-jwt/jwt/v5
```


## Define Model

```go
// model/user.go
package model

type User struct {
    ID       int64  `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"` // Exclude from JSON response
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


## User Store

Implement simply with an in-memory store.

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

    // Check for email duplication
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


## Auth Interceptor

Route interceptor that validates JWT tokens.

```go
// interceptor/auth_interceptor.go
package interceptor

import (
    "strings"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key") // Use environment variables in production

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Extract token from Authorization header
    authHeader := ctx.Header("Authorization")
    if authHeader == "" {
        return httperr.Unauthorized("Token is required.")
    }

    // Parse "Bearer {token}" format
    parts := strings.Split(authHeader, " ")
    if len(parts) != 2 || parts[0] != "Bearer" {
        return httperr.Unauthorized("Invalid token format.")
    }

    tokenString := parts[1]

    // Validate JWT token
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, httperr.Unauthorized("Invalid signing method.")
        }
        return JWTSecret, nil
    })

    if err != nil || !token.Valid {
        return httperr.Unauthorized("Invalid token.")
    }

    // Extract user ID from token
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("Cannot read token claims.")
    }

    userID := int64(claims["user_id"].(float64))
    
    // Save user ID to ExecutionContext
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```


## Controller

Implement login, signup, and get current user info.

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

// Signup — Authentication not required
func (c *AuthController) Signup(req model.SignupRequest) (model.User, error) {
    if req.Email == "" || req.Password == "" || req.Name == "" {
        return model.User{}, httperr.BadRequest("All fields are required.")
    }

    user, err := c.userStore.Create(req.Email, req.Password, req.Name)
    if err != nil {
        return model.User{}, httperr.BadRequest(err.Error())
    }

    return *user, nil
}

// Login — Authentication not required
func (c *AuthController) Login(req model.LoginRequest) (model.LoginResponse, error) {
    if req.Email == "" || req.Password == "" {
        return model.LoginResponse{}, httperr.BadRequest("Email and password are required.")
    }

    user, err := c.userStore.FindByEmail(req.Email)
    if err != nil {
        return model.LoginResponse{}, httperr.Unauthorized("Invalid email or password.")
    }

    // Check password (In reality, compare hashes using bcrypt, etc.)
    if user.Password != req.Password {
        return model.LoginResponse{}, httperr.Unauthorized("Invalid email or password.")
    }

    // Generate JWT Token
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(interceptor.JWTSecret)
    if err != nil {
        return model.LoginResponse{}, httperr.BadRequest("Failed to generate token.")
    }

    return model.LoginResponse{
        Token: tokenString,
        User:  *user,
    }, nil
}

// Get Me — Authentication required
func (c *AuthController) GetMe(ctx core.ExecutionContext) (model.User, error) {
    // Get userID saved by AuthInterceptor
    userIDValue, ok := ctx.Get("userID")
    if !ok {
        return model.User{}, httperr.Unauthorized("Authentication info not found.")
    }

    userID := userIDValue.(int64)
    user, err := c.userStore.FindByID(userID)
    if err != nil {
        return model.User{}, httperr.NotFound("User not found.")
    }

    return *user, nil
}
```


## main.go

Register routes and start the server.

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

    // Register Constructors
    app.Constructor(
        store.NewUserStore,
        controller.NewAuthController,
    )

    // Global Interceptor — CORS
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
            AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
            AllowHeaders: []string{"Content-Type", "Authorization"},
        }),
    )

    // Public Routes — Authentication not required
    app.Route("POST", "/signup", (*controller.AuthController).Signup)
    app.Route("POST", "/login", (*controller.AuthController).Login)

    // Protected Routes — Authentication required (Use Route Interceptor)
    app.Route(
        "GET",
        "/me",
        (*controller.AuthController).GetMe,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )

    log.Println("Server started: http://localhost:8080")
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
	})
}
```


## Run

```bash
go run .
```


## API Test

### Signup

```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```

Response:

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

### Login

```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234"}'
```

Response:

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

### Get My Info (Auth Required)

Request without token:

```bash
curl http://localhost:8080/me
```

Response:

```json
{
  "message": "Token is required."
}
```

Request with token:

```bash
curl http://localhost:8080/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Response:

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```


## Route Interceptor Flow

```
POST /signup (Public)
   │
   ├─→ CORS.PreHandle (Global)
   ├─→ AuthController.Signup
   └─→ Response 200

POST /login (Public)
   │
   ├─→ CORS.PreHandle (Global)
   ├─→ AuthController.Login
   └─→ Response 200 + JWT Token

GET /me (Protected)
   │
   ├─→ CORS.PreHandle (Global)
   ├─→ Auth.PreHandle (Route) ← Validate Token
   │       │
   │       ├─ No Token → 401 Unauthorized
   │       └─ Valid Token → ctx.Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + User Info
```


## Key Points

| Route | Method | Interceptor | Description |
|--------|--------|----------|------|
| `/signup` | POST | Global only | Signup (Public) |
| `/login` | POST | Global only | Login & Issue JWT (Public) |
| `/me` | GET | Global + Auth | Get My Info (Auth Required) |
