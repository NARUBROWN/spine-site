# Swagger 与 OpenAPI 文档

使用 CLI 导出 OpenAPI 文件，按需添加 Swaggo 文档和 Swagger UI，并从浏览器发送请求。CLI 的静态 OpenAPI 导出与使用 Swaggo 的 UI 配置分别进行。

本页按功能划分的 `src/user` 示例使用[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中通过 `--layout legacy` 创建的 `my-app`。CLI `v0.4.2` 默认生成按角色划分的 `layered-v1` 结构。两种布局都使用 Spine `v0.6.5` 和 Echo 平台 `v0.1.0`。

使用[第一个应用](/zh-Hans/learn/tutorial/1-project-structure)中创建的 `example.com/my-app` 项目。请先按[控制器](/zh-Hans/learn/tutorial/2-controller)教程使用 `spine generate resource user` 生成 `src/user`。如果使用了其他模块路径，请仅将下文 import 路径中的 `example.com/my-app` 部分替换为该模块路径，并保留 `/docs` 后缀。所有命令均在项目根目录执行。

## 使用 CLI 导出 OpenAPI

CLI 根据已注册的路由和处理器签名生成 OpenAPI 3.1 文档，无需 Swaggo 注释。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

检查生成的 `openapi.json` 中的 `/health` 和 `/user/{id}`。Spine 的 `/user/:id` 在 OpenAPI 中表示为 `/user/{id}`，`x-spine-*` 字段会记录分析依据和限制。例如，仅凭静态分析无法确定运行时选择的响应状态码。

此命令只生成文档文件。如果需要 Swagger UI，请继续以下步骤。替换现有文件时，请先确认内容，再使用 `--force`。

## 可选：Swaggo 与 Swagger UI

使用 Swaggo 生成 Swagger 2.0 文档，并向 Echo 传输层添加 UI 路由。文件和注册代码需要手动编写。CLI 的 `openapi.json` 与 Swaggo 的 `docs/swagger.json` 是不同的文档，需要分别更新。

### 1. 安装工具

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. 添加 API 基本信息

在 `internal/application/application.go` 的 `BuildApplication()` 正上方添加以下注释。保留生成的 `main.go` 和 `spine.toml` 中的 `composition = "./internal/application"` 设置。

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

### 3. 为 GET 处理器编写文档

用以下代码替换生成的 `src/user/user_controller.go`。`UserIDResponse` 是为记录响应 schema 而添加的类型。此处理器返回路径中的 ID，`/user/1` 的响应 JSON 与之前一样，为 `{"id":1}`。它不会从数据库中查询用户。

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

### 4. 先生成 docs 包

使用以下命令生成文档包。生成前，不要导入尚不存在的 `example.com/my-app/docs`。`--parseInternal` 指定同时读取包含 API 基本信息的 internal 包。

```bash
swag init -g internal/application/application.go --parseInternal
```

这会生成 `docs/docs.go`、`docs/swagger.json` 和 `docs/swagger.yaml`。由于 `docs.go` 的 `init` 函数会注册文档，下一步需要以仅执行副作用的方式导入此包。不要直接修改生成的文件。

### 5. 连接 UI

在 `internal/application/application.go` 的 import 块中添加以下内容。

```go
import (
    _ "example.com/my-app/docs"
    "github.com/labstack/echo/v5"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

创建平台时，通过具有明确类型的 `WithEcho` 选项注册 Echo 扩展。用以下代码替换现有的 `app := spine.New(echoplatform.Option())`，保留后续的构造函数和路由注册。Spine v0.6.0 已移除 `App.Transport`。

```go
app := spine.New(echoplatform.Option(echoplatform.WithEcho(func(e *echo.Echo) {
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})))
```

### 6. 验证并运行

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

在浏览器中打开 `http://localhost:8080/swagger/index.html`，确认显示了 GET 路由。`/swagger/doc.json` 应返回生成的 Swagger 2.0 文档。在 UI 中使用 Try it out 请求 `/user/1`，应返回 HTTP 200 和 `{"id":1}`。

通过平台选项添加的原生 Echo 路由不会经过 Spine HTTP 拦截器和响应 staging，也不包含在静态 Spine 路由契约中。请单独检查其实际行为。

## 扩展功能时使用的注释与 DTO

以下标签和 DTO 是添加功能时的参考示例。`resource` 生成器不会生成这些请求和响应类型，也不会生成 POST、PUT、DELETE 处理器。请在 `src/user` 的 `package user` 中添加所需类型，并根据实际路由和响应状态码编写注释。

处理器通过指针接收请求 DTO。`example`、`enums`、`minimum` 等标签提供文档所需的信息，不会自动执行输入验证。

### 基本注释标签

| 标签 | 说明 | 示例 |
|------|------|------|
| `@Summary` | 单行摘要 | `查询用户` |
| `@Description` | 详细说明 | `通过 ID 查询用户信息` |
| `@Tags` | 分组标签 | `users` |
| `@Router` | 路径和方法 | `/user [get]` |

### 请求标签

| 标签 | 说明 | 示例 |
|------|------|------|
| `@Accept` | 请求 Content-Type | `json` |
| `@Produce` | 响应 Content-Type | `json` |
| `@Param` | 参数定义 | `id query int true "User ID"` |

### 响应标签

| 标签 | 说明 | 示例 |
|------|------|------|
| `@Success` | 成功响应 | `200 {object} UserResponse` |
| `@Failure` | 失败响应 | `404 {object} ErrorResponse` |


## 指定请求参数

```
@Param [名称] [位置] [类型] [是否必填] "[说明]"
```

### 参数位置

| 位置 | 说明 | 示例 |
|------|------|------|
| `query` | 查询字符串 | `/user?id=1` |
| `path` | URL 路径 | `/user/{id}` |
| `body` | 请求体 | JSON 对象 |
| `header` | 请求头 | `Authorization` |
| `formData` | 表单数据 | 文件上传 |

### 类型

| 类型 | 说明 |
|------|------|
| `int`, `integer` | 整数 |
| `string` | 字符串 |
| `bool`, `boolean` | 布尔值 |
| `number` | 实数 |
| `object` | 对象（DTO） |
| `array` | 数组 |

### 示例

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


## 为 DTO 编写文档

### 请求 DTO

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

### 响应 DTO

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

### DTO 标签

| 标签 | 说明 | 示例 |
|------|------|------|
| `example` | 示例值 | `example:"Alice"` |
| `enums` | 允许值列表 | `enums:"active,inactive"` |
| `minimum` | 最小值 | `minimum:"1"` |
| `maximum` | 最大值 | `maximum:"100"` |
| `default` | 默认值 | `default:"10"` |



## 重新生成文档

修改注释或 DTO 后，需要重新生成 Swaggo 文档。`spine dev` 不会自动运行 Swaggo。添加以下 Makefile 后，可使用 `make run` 更新文档并运行应用。CLI 的 OpenAPI 文件需要通过 `spine contract export` 单独更新。

```makefile
.PHONY: swagger run

swagger:
	swag init -g internal/application/application.go --parseInternal

run: swagger
	spine dev
```

## 下一步

- [Spine API](/zh-Hans/reference/api/spine-app)
- [Swaggo v1.16.6](https://github.com/swaggo/swag/tree/v1.16.6)
- [http-swagger v1.3.4](https://pkg.go.dev/github.com/swaggo/http-swagger@v1.3.4)
