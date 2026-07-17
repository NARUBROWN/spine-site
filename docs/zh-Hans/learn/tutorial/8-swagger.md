# Swagger 文档

创建 API 文档。

## 大纲

Spine 使用 [Swaggo](https://github.com/swaggo/swag) 自动生成 Swagger 文档。

- 从代码注释中提取API规范
- 提供 Swagger UI 文档
- 可以进行API测试

## 安装

```bash
# Swag CLI 安装
go install github.com/swaggo/swag/cmd/swag@latest

# 安装所需的包
go get github.com/swaggo/swag
go get github.com/swaggo/http-swagger
```

## 项目设置

### 添加 main.go 评论

```go
// 主程序
package main

import (
    "log"
    "time"

    "myapp/controller"
    "myapp/routes"
    "myapp/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"  // 导入生成的 docs 包
)

// @title 我的应用程序 API
// @版本1.0.0
// @description 基于 Spine 的 REST API

// @主机本地主机：8080
// @基本路径/
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // 注册 Swagger UI
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```

### main.go 注释标签

|标签 |描述 |示例|
|------|------|------|
| `@title` | `@title` API 标题 | `My App API` | `My App API`
| `@version` | `@version` API版本 | `1.0.0` | `1.0.0`
| `@description` | `@description` API说明| `基于 Spine 的 REST API` | `基于 Spine 的 REST API`
| `@host` | `@host`主机地址 | `localhost:8080` | `localhost:8080`
| `@BasePath` | `@BasePath`默认路径 | `/` | `/`

## 控制器文档

### 默认格式

```go
// 控制器/user_controller.go
package controller

import (
    "context"

    "myapp/dto"
    "myapp/service"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// 获取用户 godoc
// @Summary用户查询
// @Description 通过ID查找用户信息
// @标签用户
// @Param id query int true "用户 ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} 错误响应
// @路由器/用户[获取]
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[dto.UserResponse], error) {
    id := int(q.Int("id", 0))

    user, err := c.svc.Get(ctx, id)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, httperr.NotFound("找不到用户。")
    }

    return httpx.Response[dto.UserResponse]{Body: user}, nil
}
```

### CRUD 完整示例

```go
// 获取用户 godoc
// @Summary用户查询
// @Description 通过ID查找用户信息
// @标签用户
// @Param id query int true "用户 ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} 错误响应
// @路由器/用户[获取]
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[dto.UserResponse], error) {
    // ...
}

// 创建用户 godoc
// @Summary 创建用户
// @Description 创建一个新用户
// @标签用户
// @接受json
// @生成json
// @Param body body dto.CreateUserRequest true "请求创建用户"
// @Success 200 {object} dto.UserResponse
// @Failure 400 {object} 错误响应
// @路由器/用户[帖子]
func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
) (httpx.Response[dto.UserResponse], error) {
    // ...
}

// 更新用户 godoc
// @Summary 用户编辑
// @Description 修改用户信息
// @标签用户
// @接受json
// @生成json
// @Param id query int true "用户 ID"
// @Param body body dto.UpdateUserRequest true "用户更新请求"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} 错误响应
// @路由器/用户[放置]
func (c *UserController) UpdateUser(
    ctx context.Context,
    q query.Values,
    req *dto.UpdateUserRequest,
) (httpx.Response[dto.UserResponse], error) {
    // ...
}

// 删除用户 godoc
// @Summary 删除用户
// @Description 删除用户
// @标签用户
// @Param id query int true "用户 ID"
// @Success 200
// @Failure 404 {object} 错误响应
// @Router /用户[删除]
func (c *UserController) DeleteUser(
    ctx context.Context,
    q query.Values,
) error {
    // ...
}
```

## 评论标签参考

### 基本标签

|标签 |描述 |示例|
|------|------|------|
| `@Summary` | `@Summary`摘要（一行）| `查询用户` | `查询用户`
| `@Description` | `@Description`详细说明 | `根据 ID 查询用户信息` | `根据 ID 查询用户信息`
| `@Tags` | `@Tags`组标签| `users` | `users`
| `@Router` | `@Router`路径和方法| `/users [get]` | `/users [get]`

### 请求标签

|标签 |描述 |示例|
|------|------|------|
| `@Accept` | `@Accept`请求内容类型 | `json` | `json`
| `@Produce` | `@Produce`响应内容类型 | `json` | `json`
| `@Param` | `@Param`参数定义| `id query int true "User ID"` | `id query int true "User ID"`

### 响应标签

|标签 |描述 |示例|
|------|------|------|
| `@Success` | `@Success`成功回复 | `200 {object} dto.UserResponse` | `200 {object} dto.UserResponse`
| `@Failure` | `@Failure`失败响应| `404 {object} ErrorResponse` | `404 {object} ErrorResponse`

## @参数格式

```
@Param [姓名] [位置] [类型] [是否必填] "[说明]"
```

### 位置（中）

|地点 |描述 |示例|
|------|------|------|
| `query` | `query`查询字符串| `/users?id=1` | `/users?id=1`
| `path` | `path`网址路径| `/users/{id}` | `/users/{id}`
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
// @Param body body dto.CreateUserRequest true "请求创建用户"

// 标头
// @Param 授权标头字符串 true“不记名令牌”
```

## DTO 文档

### 请求 DTO

```go
// dto/user_request.go
package dto

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
// dto/user_response.go
package dto

// 用户响应 用户响应
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// 错误响应 错误响应
type ErrorResponse struct {
    Error string `json:"error" example:"找不到用户。"`
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

## 创建文档

### 执行命令

```bash
# 从项目根运行
swag init

# 或指定 main.go 的路径
swag init -g main.go
```

### 生成的结果

```
myapp/
├── docs/
│   ├── docs.go       # Go 代码
│   ├── swagger.json  # JSON 规范
│   └── swagger.yaml  # YAML 规范
├── main.go
└── ...
```

### 生成的 docs/docs.go

```go
// 包文档 swaggo/swag 生成的代码。请勿编辑
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
    Description: "基于 Spine 的 REST API",
    // ...
}

func init() {
    swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
```

## Swagger UI 访问

### 运行服务器

```bash
go run main.go
```

### 从浏览器访问

```
http://localhost:8080/swagger/index.html
```

## 自动再生

修改代码时自动重新生成文档：

### 使用 Makefile

```makefile
# 生成文件

.PHONY: swagger run

swagger:
	swag init -g main.go

run: swagger
	go run main.go
```

```bash
make run
```

### 使用脚本

```bash
#!/bin/bash
# 运行sh

swag init -g main.go
go run main.go
```

```bash
chmod +x run.sh
./run.sh
```

## 完整示例

### 项目结构

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
    "log"
    "time"

    "myapp/controller"
    "myapp/routes"
    "myapp/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"
)

// @title 我的应用程序 API
// @版本1.0.0
// @description 基于 Spine 的 REST API

// @主机本地主机：8080
// @基本路径/
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // 注册 Swagger UI
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```

### 控制器/user_controller.go

```go
package controller

import (
    "context"

    "myapp/dto"
    "myapp/service"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// 获取用户 godoc
// @Summary用户查询
// @Description 通过ID查找用户信息
// @标签用户
// @Param id query int true "用户 ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} dto.ErrorResponse
// @路由器/用户[获取]
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))

    user, err := c.svc.Get(ctx, id)
    if err != nil {
        return dto.UserResponse{}, httperr.NotFound("找不到用户。")
    }

    return user, nil
}

// 创建用户 godoc
// @Summary 创建用户
// @Description 创建一个新用户
// @标签用户
// @接受json
// @生成json
// @Param body body dto.CreateUserRequest true "请求创建用户"
// @Success 200 {object} dto.UserResponse
// @Failure 400 {object} dto.ErrorResponse
// @路由器/用户[帖子]
func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,
) (dto.UserResponse, error) {
    return c.svc.Create(ctx, req.Name, req.Email)
}
```

## 主要摘要

|步骤|命令/动作 |
|------|----------|
| 1. 安装| `go install github.com/swaggo/swag/cmd/swag@latest` | `go install github.com/swaggo/swag/cmd/swag@latest`
| 2.写评论| `// @Summary`、`// @Param`、`// @Router` 等 |
| 3. 创建文档 | `swag init` | `swag init`
| 4.UI注册| `e.GET("/swagger/*", ...)` | `e.GET("/swagger/*", ...)`
| 5. 访问 | `http://localhost:8080/swagger/index.html` | `http://localhost:8080/swagger/index.html`

## 后续步骤

- [参考：API](/zh-Hans/reference/api/spine-app) — Spine API 文档
- [参考：示例](/zh-Hans/reference/examples/crud) — 完整示例项目
