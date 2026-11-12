# 控制器

在 RegisterRoutes 中声明路由，通过对应来源的包装类型接收 HTTP 输入。本独立应用仅返回数据，不保存数据。

## 准备

准备 Go 1.26 以上版本和空目录。在 BuildApplication 中组装应用，CLI 项目中对应 internal/application/application.go。

```sh
go mod init example.com/spine-tutorial
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

## 输入来源与名称

| 来源 | 处理器参数 | 外部名称 |
| --- | --- | --- |
| Path | `input.Path[UserPath]` or `input.Path[int64]` | `path:"id"` |
| Query | `input.Query[SearchQuery]` | `query:"name"` |
| Header | `input.Header[RequestHeaders]` | `header:"X-Request-ID"` |
| Body | `input.Body[CreateUser]` | `json` / `xml` / `form` |

Path、Query 和 Header 默认使用 lowerCamel 名称：ID 对应 id，UserID 对应 userId。需要自定义外部名称时使用标签。Body 遵循解码器的命名规则。不提供 input.Param，直接使用 *DTO 接收 HTTP 输入会触发 HTTP_INPUT_WRAPPER_REQUIRED。字段通过 path.ID、body.Name 读取，标量通过 *id 读取。

## DTO 与可选验证方法 {#dto-validation}

在 BuildApplication 中注册 WithValidator(engine) 后，validate 标签会在处理器前自动验证。如果标签已满足需求，无需 Validate 方法或重复检查。保留名称等额外规则可用普通 Go 方法实现。下例需要导入 errors。

```go
type CreateUserRequest struct {
	Name string `json:"name" validate:"required,max=100"`
}

func (r *CreateUserRequest) Validate() error {
	if r.Name == "admin" {
		return errors.New("此名称不可用")
	}
	return nil
}
```

此方法不会自动执行。需要时在处理器中调用 (*body).Validate() 或 (*CreateUserRequest)(body).Validate()，不要直接在包装类型上调用 body.Validate()。OpenAPI 不会推断方法中的规则。参见[完整验证示例](/zh-Hans/learn/tutorial/7-error-handling#validation-modes)。

## 可运行应用

保存为 main.go。此基础示例不包含自定义 Validate 方法。

HTTP 处理器需要请求上下文时，可以在任意位置声明 `spine.Ctx` 参数。

```go
package main

import (
	"log"

	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type UserPath struct {
	ID int64 `path:"id"`
}
type SearchQuery struct {
	Name string `query:"name"`
}
type RequestHeaders struct {
	RequestID string `header:"X-Request-ID"`
}
type CreateUser struct {
	Name string `json:"name"`
}
type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func (*UserController) Constructor() *UserController { return &UserController{} }
func (c *UserController) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Tags("Users"))
	users.GET("/search", func(q input.Query[SearchQuery], h input.Header[RequestHeaders]) httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"name": q.Name, "request_id": h.RequestID}}
	})
	users.GET("/id/:id", func(path input.Path[UserPath]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{ID: path.ID}}
	}, api.Summary("Get user"))
	users.POST("/", func(body input.Body[CreateUser]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{Name: body.Name}, Options: httpx.ResponseOptions{Status: 201}}
	})
}

func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&UserController{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
func main() {
	app, options, err := BuildApplication()
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

组内的 "/" 表示组基础路径。users.POST("/", ...) 注册 POST /users。新代码使用 RegisterRoutes，app.Route 已弃用。

## 验证请求

```sh
go run .
#
curl -H 'X-Request-ID: r1' 'http://localhost:8080/users/search?name=alice'
curl http://localhost:8080/users/id/12
curl -i -H 'Content-Type: application/json' -d '{"name":"bob"}' http://localhost:8080/users
curl -i http://localhost:8080/users/id/not-a-number
```

依次确认名称和请求 ID、ID 12、201 响应，以及无效整数的 400。

## 输入与返回规则

标量 Path 的顺序和数量必须匹配路径变量。路径 DTO 按名称绑定，可只声明部分键；两种方式不能混用。按来源分离 DTO，避免重复键。最多声明一个 Body，支持 JSON、XML、form 和 multipart。文件使用带 form 标签的 *multipart.FileHeader 或 []*multipart.FileHeader 字段。

成功响应为一个 httpx.Response[T]、Binary 或 Redirect，可同时返回 error。准备阶段会拒绝多个响应值。

## 错误响应 {#error-response}

绑定失败在处理器前返回 400，普通错误返回隐藏内部信息的 500。在[错误处理](/zh-Hans/learn/tutorial/7-error-handling)中连接验证器。

## 下一步

[DI](/zh-Hans/learn/tutorial/3-dependency-injection) / [OpenAPI](/zh-Hans/reference/api/openapi)
