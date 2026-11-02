# Swagger and OpenAPI documentation

Export an OpenAPI file with the CLI, then add Swaggo documentation and Swagger UI if you want to send requests from a browser. The CLI's static OpenAPI export and the Swaggo UI setup are separate workflows.

The feature-based `src/user` examples on this page use the `my-app` project created with `--layout legacy` in [Project Structure](/en/learn/tutorial/1-project-structure). CLI `v0.4.0` defaults to the role-based `layered-v1` layout. Both layouts use Spine `v0.6.0` and Echo platform `v0.1.0`.

Use the `example.com/my-app` project from [Your first app](/en/learn/tutorial/1-project-structure). First generate `src/user` with `spine generate resource user` from [Controllers](/en/learn/tutorial/2-controller). If you used a different module path, replace only the `example.com/my-app` prefix in the import path below with your module path and keep the `/docs` suffix. Run commands from the project root.

## Export OpenAPI with the CLI

The CLI generates an OpenAPI 3.1 document from registered routes and handler signatures. Swaggo annotations are not required.

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

Check the generated `openapi.json` for `/health` and `/user/{id}`. Spine's `/user/:id` is represented as `/user/{id}` in OpenAPI, and the `x-spine-*` fields record the analysis evidence and its limitations. For example, static analysis alone cannot determine response status codes selected at runtime.

This command generates only a documentation file. If you need Swagger UI, continue with the next steps. To replace an existing file, review its contents before using `--force`.

## Optional: Swaggo and Swagger UI

Generate Swagger 2.0 documentation with Swaggo and add a UI route to the Echo transport layer. Write the files and registration code yourself. The CLI's `openapi.json` and Swaggo's `docs/swagger.json` are separate documents, so update each one separately.

### 1. Install the tools

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. Add API metadata

Add the following comments directly above `BuildApplication()` in `internal/application/application.go`. Keep the generated `main.go` and the `composition = "./internal/application"` setting in `spine.toml`.

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

### 3. Document the GET handler

Replace the generated `src/user/user_controller.go` with the following code. `UserIDResponse` is a type added to document the response schema. This handler returns the ID from the path, so the JSON response for `/user/1` remains `{"id":1}`. It does not look up a user in the database.

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

Generate the documentation package with the following command. Do not import `example.com/my-app/docs` before it has been generated. `--parseInternal` includes the internal package that contains the API metadata.

```bash
swag init -g internal/application/application.go --parseInternal
```

This generates `docs/docs.go`, `docs/swagger.json`, and `docs/swagger.yaml`. The `init` function in `docs.go` registers the documentation, so add a side-effect import for this package in the next step. Do not edit the generated files directly.

### 5. Connect the UI

Add these imports to the import block in `internal/application/application.go`.

```go
import (
    _ "example.com/my-app/docs"
    "github.com/labstack/echo/v5"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

Register Echo extensions through the typed `WithEcho` option when constructing the platform. Replace the existing `app := platform.New()` with the code below and keep the constructor and route registrations that follow. `App.Transport` was removed in Spine v0.6.0.

```go
app := platform.New(platform.WithEcho(func(e *echo.Echo) {
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
}))
```

### 6. Verify and run

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

Open `http://localhost:8080/swagger/index.html` in a browser and check that the GET route appears. `/swagger/doc.json` should return the generated Swagger 2.0 document. Use Try it out in the UI to request `/user/1`; the response should be HTTP 200 with `{"id":1}`.

Native Echo routes added through platform options bypass Spine HTTP interceptors and response staging, and are outside the static Spine route contract. Check their actual behavior separately.

## Annotations and DTOs for additional features

The tags and DTOs below are examples to refer to when adding features. The `resource` generator does not generate these request and response types or POST, PUT, and DELETE handlers. Add the types you need to `package user` in `src/user`, and write annotations that match your actual routes and response status codes.

Receive request DTOs as pointers in handlers. Tags such as `example`, `enums`, and `minimum` supply information for documentation; they do not run input validation automatically.

### Basic annotation tags

| Tag | Description | Example |
|------|------|------|
| `@Summary` | One-line summary | `Look up a user` |
| `@Description` | Detailed description | `Look up user information by ID` |
| `@Tags` | Group tag | `users` |
| `@Router` | Path and method | `/user [get]` |

### Request tags

| Tag | Description | Example |
|------|------|------|
| `@Accept` | Request Content-Type | `json` |
| `@Produce` | Response Content-Type | `json` |
| `@Param` | Parameter definition | `id query int true "User ID"` |

### Response tags

| Tag | Description | Example |
|------|------|------|
| `@Success` | Successful response | `200 {object} UserResponse` |
| `@Failure` | Error response | `404 {object} ErrorResponse` |


## Specify request parameters

```
@Param [name] [location] [type] [required] "[description]"
```

### Parameter locations

| Location | Description | Example |
|------|------|------|
| `query` | Query string | `/user?id=1` |
| `path` | URL path | `/user/{id}` |
| `body` | Request body | JSON object |
| `header` | Header | `Authorization` |
| `formData` | Form data | File upload |

### Types

| Type | Description |
|------|------|
| `int`, `integer` | Integer |
| `string` | String |
| `bool`, `boolean` | Boolean |
| `number` | Real number |
| `object` | Object (DTO) |
| `array` | Array |

### Example

```go
// 쿼리 파라미터
// @Param id query int true "User ID"
// @Param name query string false "User name"
// @Param active query bool false "Active status"

// 요청 본문
// @Param body body CreateUserRequest true "유저 생성 요청"

// 헤더
// @Param Authorization header string true "Bearer 토큰"
```


## Document DTOs

### Request DTO

```go
// src/user/user_request.go
package user

// CreateUserRequest 유저 생성 요청
type CreateUserRequest struct {
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// UpdateUserRequest 유저 수정 요청
type UpdateUserRequest struct {
    Name  string `json:"name" example:"Alice Updated"`
    Email string `json:"email" example:"alice.new@example.com"`
}
```

### Response DTO

```go
// src/user/user_response.go
package user

// UserResponse 유저 응답
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
    Message string `json:"message" example:"유저를 찾을 수 없습니다."`
}
```

### DTO tags

| Tag | Description | Example |
|------|------|------|
| `example` | Example value | `example:"Alice"` |
| `enums` | List of allowed values | `enums:"active,inactive"` |
| `minimum` | Minimum value | `minimum:"1"` |
| `maximum` | Maximum value | `maximum:"100"` |
| `default` | Default value | `default:"10"` |



## Regenerate documentation

Regenerate the Swaggo documentation whenever you change annotations or DTOs. `spine dev` does not run Swaggo automatically. Add the following Makefile to update the documentation before starting the app with `make run`. Update the CLI's OpenAPI file separately with `spine contract export`.

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
