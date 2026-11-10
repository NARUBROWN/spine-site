# 错误处理与输入验证

在 Spine v0.7.1 中结合 DTO 自动验证与自定义规则，并返回输入错误和资源不存在的 HTTP 响应。

## 可运行示例

需要 Go 1.26 或更高版本。在独立 Go 模块中安装依赖，将代码保存为 `main.go` 并运行。此示例不会保存用户。

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0 github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

```go
package main

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}

func (u *CreateUser) Validate() error {
	if strings.EqualFold(strings.TrimSpace(u.Name), "admin") {
		return errors.New("name is reserved")
	}
	return nil
}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.POST("/users", func(body input.Body[CreateUser]) (httpx.Response[CreateUser], error) {
		if err := (*CreateUser)(body).Validate(); err != nil {
			return httpx.Response[CreateUser]{}, httperr.BadRequest(err.Error())
		}
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})
	r.GET("/users/:id", func(id input.Path[int64]) (httpx.Response[map[string]any], error) {
		if *id <= 0 {
			return httpx.Response[map[string]any]{}, httperr.BadRequest("invalid user ID")
		}
		if *id != 1 {
			return httpx.Response[map[string]any]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": "Alice"}}, nil
	})
}
func main() {
	engine, err := playground.New()
	if err != nil {
		log.Fatal(err)
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

## 验证何时执行

注册 `spine.WithValidator(engine)` 后，正文绑定成功时会检查 `validate` 标签，失败则在处理函数执行前返回 400。未注册验证器时，仅有标签不会执行验证。

DTO 的 `Validate()` 不会自动调用。示例在标签验证通过后由处理函数调用它来检查保留名称。也可以用此方式扩展跨字段或应用规则。只向 `BadRequest` 传递可公开的消息。

`app.Validate(options)` 在启动前检查应用配置，不会验证请求 DTO，也不会实际执行构造函数或外部服务。

## 检查响应

依次返回 200、400、404、400、400 和 201。第一个 POST 错误包含字段验证信息，第二个来自自定义规则。

```bash
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
```

## 错误映射

`httperr.BadRequest`、`Unauthorized` 和 `NotFound` 分别返回 400、401 和 404。其他状态可使用 `httperr.HTTPError`。普通错误会转成 500，不要直接公开内部错误。可以使用 `errors.Is` 判断领域错误。

## 了解更多

- [httperr](/zh-Hans/learn/core-concepts/httperr)
- [拦截器](/zh-Hans/learn/tutorial/4-interceptor)
