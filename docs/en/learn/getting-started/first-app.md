# First App

Create a user lookup API in 5 minutes.

## Completed Result

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


## 1. Create Project

```bash
mkdir hello-spine && cd hello-spine
go mod init hello-spine
go get github.com/NARUBROWN/spine
```


## 2. Project Structure

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

## 3. Writing Code

### main.go

```go
package main

import (
    "hello-spine/controller"
    "hello-spine/routes"
    "hello-spine/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    // Register constructors — order doesn't matter
    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    // Register routes
    routes.RegisterRoutes(app)

    // Start server
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
	})
}
```

### service/user_service.go

```go
package service

// UserResponse struct
type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

// UserService
type UserService struct {
    // Usually inject Repository, but simplified here
}

func NewUserService() *UserService {
    return &UserService{}
}

// Get user (hardcoded data)
func (s *UserService) Get(id int) (UserResponse, error) {
    // usually select from DB
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

    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

// NewUserController — parameters are dependencies
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser handler
// Function signature is the API spec
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (service.UserResponse, error) {
    id := int(q.Int("id", 0))
    return c.svc.Get(id)
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

## 4. Run

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

## 5. Test

```bash
# Get Alice
curl "http://localhost:8080/users?id=1"
```

```json
{"id":1,"name":"Alice","email":"alice@example.com"}
```

```bash
# Get Bob
curl "http://localhost:8080/users?id=2"
```

```json
{"id":2,"name":"Bob","email":"bob@example.com"}
```

## 🎉 Done!

You built your first Spine app in 5 minutes.

### What we learned

| Concept | Code |
|------|------|
| Create App | `spine.New()` |
| Register Dependency | `app.Constructor(...)` |
| Register Route | `app.Route("GET", "/users", ...)` |
| Start Server | `app.Run(boot.Options{...})` |

### Key Points

- **Constructor Parameter = Dependency Declaration** — No annotations needed
- **Function Signature = API Spec** — Clear input/output
- **Routes Managed in One Place** — Visible flow

## Next Steps

- [Tutorial: Project Structure](/en/learn/tutorial/1-project-structure) — Setup real project structure
- [Tutorial: Interceptor](/en/learn/tutorial/4-interceptor) — Add transaction, logging
- [Tutorial: Database](/en/learn/tutorial/5-database) — Connect Bun ORM
