# Swagger Documentation

Generating API documentation.

## Overview

Spine uses [Swaggo](https://github.com/swaggo/swag) to automatically generate Swagger documentation.

- Extract API specs from code comments
- Provide documentation via Swagger UI
- API testing capabilities

## Installation

```bash
# Install Swag CLI
go install github.com/swaggo/swag/cmd/swag@latest

# Install required packages
go get github.com/swaggo/swag
go get github.com/swaggo/http-swagger
```

## Project Configuration

### Adding Comments to main.go

```go
// main.go
package main

import (
    "myapp/controller"
    "myapp/routes"
    "myapp/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"  // Import generated docs package
)

// @title My App API
// @version 1.0.0
// @description REST API based on Spine

// @host localhost:8080
// @BasePath /
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // Register Swagger UI
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

### main.go Annotation Tags

| Tag | Description | Example |
|------|------|------|
| `@title` | API Title | `My App API` |
| `@version` | API Version | `1.0.0` |
| `@description` | API Description | `REST API based on Spine` |
| `@host` | Host Address | `localhost:8080` |
| `@BasePath` | Base Path | `/` |


## Controller Documentation

### Basic Format

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
// @Summary Get User
// @Description key words: Get user info by ID
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
        return dto.UserResponse{}, httperr.NotFound("User not found.")
    }

    return user, nil
}
```

### CRUD Complete Example

```go
// GetUser godoc
// @Summary Get User
// @Description Get user info by ID
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
// @Summary Create User
// @Description Create a new user
// @Tags users
// @Accept json
// @Produce json
// @Param body body dto.CreateUserRequest true "User creation request"
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
// @Summary Update User
// @Description Update user info
// @Tags users
// @Accept json
// @Produce json
// @Param id query int true "User ID"
// @Param body body dto.UpdateUserRequest true "User update request"
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
// @Summary Delete User
// @Description Delete a user
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


## Annotation Tag Reference

### Basic Tags

| Tag | Description | Example |
|------|------|------|
| `@Summary` | Summary (One line) | `Get User` |
| `@Description` | Detailed Description | `Get user info by ID` |
| `@Tags` | Group Tag | `users` |
| `@Router` | Path and Method | `/users [get]` |

### Request Tags

| Tag | Description | Example |
|------|------|------|
| `@Accept` | Request Content-Type | `json` |
| `@Produce` | Response Content-Type | `json` |
| `@Param` | Parameter Definition | `id query int true "User ID"` |

### Response Tags

| Tag | Description | Example |
|------|------|------|
| `@Success` | Success Response | `200 {object} dto.UserResponse` |
| `@Failure` | Failure Response | `404 {object} ErrorResponse` |


## @Param Format

```
@Param [Name] [Location] [Type] [Required] "[Description]"
```

### Location (in)

| Location | Description | Example |
|------|------|------|
| `query` | Query String | `/users?id=1` |
| `path` | URL Path | `/users/{id}` |
| `body` | Request Body | JSON body |
| `header` | Header | `Authorization` |
| `formData` | Form Data | File Upload |

### Type

| Type | Description |
|------|------|
| `int`, `integer` | Integer |
| `string` | String |
| `bool`, `boolean` | Boolean |
| `number` | Float/Double |
| `object` | Object (DTO) |
| `array` | Array |

### Examples

```go
// Query Parameter
// @Param id query int true "User ID"
// @Param name query string false "User name"
// @Param active query bool false "Active status"

// Request Body
// @Param body body dto.CreateUserRequest true "User creation request"

// Header
// @Param Authorization header string true "Bearer Token"
```


## DTO Documentation

### Request DTO

```go
// dto/user_request.go
package dto

// CreateUserRequest User creation request
type CreateUserRequest struct {
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// UpdateUserRequest User update request
type UpdateUserRequest struct {
    Name  string `json:"name" example:"Alice Updated"`
    Email string `json:"email" example:"alice.new@example.com"`
}
```

### Response DTO

```go
// dto/user_response.go
package dto

// UserResponse User response
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse Error response
type ErrorResponse struct {
    Error string `json:"error" example:"User not found."`
}
```

### DTO Tags

| Tag | Description | Example |
|------|------|------|
| `example` | Example Value | `example:"Alice"` |
| `enums` | Allowed Values | `enums:"active,inactive"` |
| `minimum` | Minimum Value | `minimum:"1"` |
| `maximum` | Maximum Value | `maximum:"100"` |
| `default` | Default Value | `default:"10"` |


## Generating Documentation

### Running Command

```bash
// Run at project root
swag init

// Or specify main.go path
swag init -g main.go
```

### Generated Result

```
myapp/
├── docs/
├── docs.go       # Go Code
├── swagger.json  # JSON Spec
└── swagger.yaml  # YAML Spec
├── main.go
└── ...
```

### Generated docs/docs.go

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
    Description: "REST API based on Spine",
    // ...
}

func init() {
    swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
```

## Accessing Swagger UI

### Running Server

```bash
go run main.go
```

### Browsing

```
http://localhost:8080/swagger/index.html
```

## Auto Regeneration

To auto-regenerate docs on code change:

### Using Makefile

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

### Using Script

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

## Complete Example

### Project Structure

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
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"
)

// @title My App API
// @version 1.0.0
// @description REST API based on Spine

// @host localhost:8080
// @BasePath /
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // Register Swagger UI
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
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
// @Summary Get User
// @Description Get user info by ID
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
        return dto.UserResponse{}, httperr.NotFound("User not found.")
    }

    return user, nil
}

// CreateUser godoc
// @Summary Create User
// @Description Create a new user
// @Tags users
// @Accept json
// @Produce json
// @Param body body dto.CreateUserRequest true "User creation request"
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


## Key Takeaways

| Step | Command/Action |
|------|----------|
| 1. Install | `go install github.com/swaggo/swag/cmd/swag@latest` |
| 2. Add Comments | `// @Summary`, `// @Param`, `// @Router` etc. |
| 3. Generate Docs | `swag init` |
| 4. Register UI | `e.GET("/swagger/*", ...)` |
| 5. Access | `http://localhost:8080/swagger/index.html` |


## Next Steps

- [Reference: API](/en/reference/api/spine-app) — Spine API Docs
- [Reference: Examples](/en/reference/examples/crud) — Complete Example Project
