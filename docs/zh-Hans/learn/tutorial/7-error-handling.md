# 错误处理与输入验证

区分自动标签验证和自定义规则。此独立应用不保存数据。

## 组装验证器

[控制器依赖](/zh-Hans/learn/tutorial/2-controller)

```sh
go get github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

engine 是保存 playground.New() 返回值的变量。在 BuildApplication 中创建一次并传给 spine.WithValidator(engine)。playground 实现运行时验证和 OpenAPI SchemaDescriber，也可使用实现公开验证契约的其他引擎。

## 运行示例

替换 main.go，在 BuildApplication 中注册验证器并启用 OpenAPI。

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
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}

	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{OpenAPI: boot.OpenAPIOptions{Enabled: true}}, EnableGracefulShutdown: true}, nil
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

## 三种验证方式 {#validation-modes}

注册的引擎在绑定后、处理器前检查 validate 标签。request.Validate() 是显式调用自定义普通方法。app.Validate(options) 在运行前检查可验证的配置和 DI。未注册引擎时，标签本身不会执行验证。

如果标签已满足需求，省略 DTO Validate 和手动调用。本例仅为保留名称规则添加它们，该规则不会自动执行，也不会被 OpenAPI 推断。通过 (*body).Validate() 或 (*CreateUser)(body).Validate() 调用 DTO 方法。参见 [DTO 定义](/zh-Hans/learn/tutorial/2-controller#dto-validation)。

## 请求与规范

```sh
go run .
#
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
curl http://localhost:8080/openapi.json
```

依次为 200、400、404、400、400、201。POST 失败分别来自标签和手动规则。OpenAPI 标记 name、email 必填，但规范本身不执行验证。当验证器提供必填信息时，即使存在 json:",string" 等表达限制，也会保留 Required。CLI 静态 export 不执行引擎，应在准备好的应用中检查引擎生成的规范。

## 错误响应

绑定和标签验证失败在处理器前返回 400。HTTPError 仅允许 400–599，200/302 等无效状态按普通 500 处理。普通错误隐藏内部详情。httperr 仅填写可公开消息。BeforeResponse 错误优先于处理器错误决定响应。

## 下一步

[拦截器](/zh-Hans/learn/tutorial/4-interceptor) / [OpenAPI](/zh-Hans/reference/api/openapi)
