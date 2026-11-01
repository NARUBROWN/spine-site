# Swagger and OpenAPI Documentation

Use the CLI-generated project from [First App](/en/learn/getting-started/first-app). Generate `src/user` with `spine generate resource user` as described in [Controllers](/en/learn/tutorial/2-controller). CLI static OpenAPI export and Swaggo/Swagger UI integration are separate features.

## Export OpenAPI with the CLI

The CLI generates OpenAPI 3.1 from registered routes and handler signatures. Swaggo annotations are not required.

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

The output includes `/health`, `/user/{id}`, and `x-spine-*` analysis evidence. Spine `/user/:id` becomes OpenAPI `/user/{id}`. Runtime-selected status codes and other limits remain explicit. Exporting does not install Swagger UI or mount an HTTP endpoint. Review an existing output before replacing it with `--force`.

## Optional: Swaggo and Swagger UI

The following creates a separate Swagger 2.0 document with Swaggo and manually mounts its UI on the Echo transport. The CLI does not configure this integration. CLI `openapi.json` and Swaggo `docs/swagger.json` are different outputs.

### 1. Install tools

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. Add general annotations

Add these immediately above `BuildApplication()` in `internal/application/application.go`. Keep the generated main and `composition = "./internal/application"` in `spine.toml`.

```go
// @title Hello Spine API
// @version 1.0.0
// @description Spine HTTP API
// @host localhost:8080
// @BasePath /
func BuildApplication() (spine.App, boot.Options, error) {
    // ...
}
```

### 3. Document the actual lookup handler

Manually extend the generated `src/user/user_controller.go` as follows. `UserIDResponse` is an added documentation type; the response JSON remains `{"id":1}`. This does not implement database lookup or full CRUD.

```go
package user

import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct{ service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

type UserIDResponse struct {
    ID int64 `json:"id" example:"1"`
}

// Get godoc
// @Summary Get user ID
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} UserIDResponse
// @Router /user/{id} [get]
func (c *UserController) Get(id path.Int) httpx.Response[UserIDResponse] {
    return httpx.Response[UserIDResponse]{Body: UserIDResponse{ID: id.Value}}
}
```

### 4. Generate the docs package first

Run from the project root. Do not import `example.com/hello-spine/docs` before it exists. `--parseInternal` includes the internal package containing the general annotations.

```bash
swag init -g internal/application/application.go --parseInternal
```

This generates `docs/docs.go`, `docs/swagger.json`, and `docs/swagger.yaml`. The init function in `docs.go` registers the specification, so add its blank import after generation. Do not edit generated files manually.

### 5. Mount the UI

Add these imports to `internal/application/application.go`.

```go
import (
    _ "example.com/hello-spine/docs"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

Add this inside `BuildApplication()`, after `app := spine.New()` and before its return. Keep the existing health and user registrations.

```go
app.Transport(func(transport any) {
    e := transport.(*echo.Echo)
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})
```

### 6. Verify and run

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
spine contract check
spine verify
spine dev
```

In another terminal, check `http://localhost:8080/swagger/index.html` and `/swagger/doc.json`. Try it out must also reach the real `/user/1` endpoint. Echo routes added directly through `app.Transport` are outside the CLI static Spine route contract, so verify the UI endpoint separately.

## Annotations and DTOs for manual CRUD extensions

The tags and DTOs below are reference examples for additional features you implement. The `resource` generator does not create these request/response types or POST, PUT, and DELETE handlers. Put them in the same `package user` under `src/user` and match annotations to real routes and response status codes. Receive request DTOs as pointers. Tags such as `example`, `enums`, and `minimum` describe documentation; they do not execute input validation.

## Annotation Tag Reference

### Basic Tags

| Tag | Description | Example |
|------|------|------|
| `@Summary` | Summary (One line) | `Get User` |
| `@Description` | Detailed Description | `Get user info by ID` |
| `@Tags` | Group Tag | `users` |
| `@Router` | Path and Method | `/user [get]` |

### Request Tags

| Tag | Description | Example |
|------|------|------|
| `@Accept` | Request Content-Type | `json` |
| `@Produce` | Response Content-Type | `json` |
| `@Param` | Parameter Definition | `id query int true "User ID"` |

### Response Tags

| Tag | Description | Example |
|------|------|------|
| `@Success` | Success Response | `200 {object} UserResponse` |
| `@Failure` | Failure Response | `404 {object} ErrorResponse` |


## @Param Format

```
@Param [Name] [Location] [Type] [Required] "[Description]"
```

### Location (in)

| Location | Description | Example |
|------|------|------|
| `query` | Query String | `/user?id=1` |
| `path` | URL Path | `/user/{id}` |
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
// @Param body body CreateUserRequest true "User creation request"

// Header
// @Param Authorization header string true "Bearer Token"
```


## DTO Documentation

### Request DTO

```go
// src/user/user_request.go
package user

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
// src/user/user_response.go
package user

// UserResponse User response
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse Error response
type ErrorResponse struct {
    Message string `json:"message" example:"User not found."`
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



## Regenerate documentation

Regenerate Swaggo output after changing annotations or DTOs. `spine dev` does not run Swaggo automatically. Refresh the CLI specification separately with `contract export`.

```makefile
.PHONY: swagger run

swagger:
	swag init -g internal/application/application.go --parseInternal

run: swagger
	spine dev
```

## Next steps

- [Spine API](/en/reference/api/spine-app)
- [Swaggo v1.16.6](https://github.com/swaggo/swag/tree/v1.16.6)
- [http-swagger v1.3.4](https://pkg.go.dev/github.com/swaggo/http-swagger@v1.3.4)
