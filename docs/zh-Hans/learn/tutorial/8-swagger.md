# Swagger 与 OpenAPI 文档

使用[第一个应用](/zh-Hans/learn/getting-started/first-app)中 CLI 生成的项目。按[控制器](/zh-Hans/learn/tutorial/2-controller)中的 `spine generate resource user` 生成 `src/user`。CLI 静态 OpenAPI 导出和 Swaggo、Swagger UI 集成是独立功能。

## 使用 CLI 导出 OpenAPI

CLI 根据已注册的路由和处理函数签名生成 OpenAPI 3.1，不需要 Swaggo 注释。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

输出包含 `/health`、`/user/{id}` 和 `x-spine-*` 分析依据。Spine 的 `/user/:id` 在 OpenAPI 中表示为 `/user/{id}`。运行时选择的状态码等会标为静态分析边界。导出不会安装 Swagger UI 或注册 HTTP 端点。只有检查现有文件并确认替换时才使用 `--force`。

## 可选：Swaggo 与 Swagger UI

下面使用 Swaggo 生成独立的 Swagger 2.0 文档，并手动将 UI 挂载到 Echo transport。CLI 不会自动配置此集成。CLI 的 `openapi.json` 与 Swaggo 的 `docs/swagger.json` 是不同的产物。

### 1. 安装工具

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. 添加通用注释

在 `internal/application/application.go` 的 `BuildApplication()` 前添加注释。保留生成的 main 和 `spine.toml` 中的 `composition = "./internal/application"`。

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

### 3. 为实际查询处理函数添加文档

手动扩展生成的 `src/user/user_controller.go`，如下所示。`UserIDResponse` 是新增的文档类型，响应 JSON 仍为 `{"id":1}`。此示例不实现数据库查询或完整 CRUD。

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

在项目根目录运行。在此步骤之前不要导入尚不存在的 `example.com/hello-spine/docs`。`--parseInternal` 用于解析包含通用注释的 internal 包。

```bash
swag init -g internal/application/application.go --parseInternal
```

生成 `docs/docs.go`、`docs/swagger.json` 和 `docs/swagger.yaml`。`docs.go` 的 init 函数负责注册规范，因此在生成后添加空白导入。请勿手动编辑生成文件。

### 5. 挂载 UI

向 `internal/application/application.go` 的 import 块添加：

```go
import (
    _ "example.com/hello-spine/docs"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

在同一文件的 `BuildApplication()` 中，`app := spine.New()` 之后、return 之前添加。保留原有 health 和 user 注册。

```go
app.Transport(func(transport any) {
    e := transport.(*echo.Echo)
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})
```

### 6. 验证并运行

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
spine contract check
spine verify
spine dev
```

在另一个终端检查 `http://localhost:8080/swagger/index.html` 和 `/swagger/doc.json`。Try it out 也应请求实际的 `/user/1`。通过 `app.Transport` 直接添加的 Echo 路由不属于 CLI 静态 Spine 路由契约，因此需要单独检查 UI 路径。

## 手动扩展 CRUD 的注释与 DTO 参考

下面的标签与 DTO 用于自行实现的额外功能。`resource` 不生成这些请求、响应类型或 POST、PUT、DELETE 处理函数。将类型放在 `src/user` 的同一个 `package user` 中，确保注释与实际路由、响应状态一致。处理函数必须通过指针接收请求 DTO。`example`、`enums`、`minimum` 等是文档元数据，不会自动执行输入验证。

## 评论标签参考

### 基本标签

|标签 |描述 |示例|
|------|------|------|
| `@Summary` | `@Summary`摘要（一行）| `查询用户` | `查询用户`
| `@Description` | `@Description`详细说明 | `根据 ID 查询用户信息` | `根据 ID 查询用户信息`
| `@Tags` | `@Tags`组标签| `users` | `users`
| `@Router` | `@Router`路径和方法| `/user [get]` | `/user [get]`

### 请求标签

|标签 |描述 |示例|
|------|------|------|
| `@Accept` | `@Accept`请求内容类型 | `json` | `json`
| `@Produce` | `@Produce`响应内容类型 | `json` | `json`
| `@Param` | `@Param`参数定义| `id query int true "User ID"` | `id query int true "User ID"`

### 响应标签

|标签 |描述 |示例|
|------|------|------|
| `@Success` | `@Success`成功回复 | `200 {object} UserResponse` | `200 {object} UserResponse`
| `@Failure` | `@Failure`失败响应| `404 {object} ErrorResponse` | `404 {object} ErrorResponse`

## @参数格式

```
@Param [姓名] [位置] [类型] [是否必填] "[说明]"
```

### 位置（中）

|地点 |描述 |示例|
|------|------|------|
| `query` | `query`查询字符串| `/user?id=1` | `/user?id=1`
| `path` | `path`网址路径| `/user/{id}` | `/user/{id}`
| `body` | `body`请求正文 | JSON 正文 |
| `header` | `header`标题| `Authorization` | `Authorization`
| `formData` | `formData`表格数据|上传文件 |

### 类型

|类型 |描述 |
|------|------|
| `int`、`integer` |整数 |
| `string` | `string`字符串|
| `bool`、`boolean` |金条|
| `number` | `number`错误|
| `object` | `object`对象（DTO）|
| `array` | `array`数组|

### 例子

```go
// 查询参数
// @Param id query int true "用户 ID"
// @Param name 查询字符串 false "用户名"
// @Param active query bool false "活动状态"

// 请求正文
// @Param body body CreateUserRequest true "请求创建用户"

// 标头
// @Param 授权标头字符串 true“不记名令牌”
```

## DTO 文档

### 请求 DTO

```go
// src/user/user_request.go
package user

// CreateUserRequest 用户创建请求
type CreateUserRequest struct {
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// UpdateUserRequest 用户修改请求
type UpdateUserRequest struct {
    Name  string `json:"name" example:"Alice Updated"`
    Email string `json:"email" example:"alice.new@example.com"`
}
```

### 响应 DTO

```go
// src/user/user_response.go
package user

// 用户响应 用户响应
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// 错误响应 错误响应
type ErrorResponse struct {
    Message string `json:"message" example:"找不到用户。"`
}
```

### DTO 标签

|标签 |描述 |示例|
|------|------|------|
| `example` | `example`示例值​​| `example:"Alice"` | `example:"Alice"`
| `enums` | `enums`允许值列表​​| `enums:"active,inactive"` | `enums:"active,inactive"`
| `minimum` | `minimum`最低 | `minimum:"1"` | `minimum:"1"`
| `maximum` | `maximum`最大值| `maximum:"100"` | `maximum:"100"`
| `default` | `default`默认 | `default:"10"` | `default:"10"`


## 重新生成文档

修改注释或 DTO 后重新运行 Swaggo。`spine dev` 不会自动运行 Swaggo。CLI 规范使用 `contract export` 单独更新。

```makefile
.PHONY: swagger run

swagger:
	swag init -g internal/application/application.go --parseInternal

run: swagger
	spine dev
```

## 后续步骤

- [Spine API](/zh-Hans/reference/api/spine-app)
- [Swaggo v1.16.6](https://github.com/swaggo/swag/tree/v1.16.6)
- [http-swagger v1.3.4](https://pkg.go.dev/github.com/swaggo/http-swagger@v1.3.4)
