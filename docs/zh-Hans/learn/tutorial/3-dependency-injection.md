# 依赖注入

::: info 0.7.5 API
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

通过构造函数参数类型连接仓库、服务和控制器。此独立应用无需数据库，GET /greeting 返回 hello。

## 构造契约

各类型实现 Constructor(依赖...) *Self。通过 constructor 包注册 Repository、Service、Controller、Interceptor 角色。Controller 还实现 RegisterRoutes，Interceptor 还实现四个钩子。Custom 用于外部工厂或普通对象。

&Service{} 是类型标记。字段不会被复制，Constructor 在新 receiver 上调用。生成实例在应用内共享。

## 运行示例

[控制器依赖](/zh-Hans/learn/tutorial/2-controller)

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type Repository struct{}

func (*Repository) Constructor() *Repository { return &Repository{} }
func (*Repository) Greeting() string         { return "hello" }

type Service struct{ repository *Repository }

func (*Service) Constructor(repository *Repository) *Service { return &Service{repository: repository} }

type Controller struct{ service *Service }

func (*Controller) Constructor(service *Service) *Controller { return &Controller{service: service} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/greeting", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Service(&Service{}), constructor.Repository(&Repository{}))
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

## 依赖解析

```sh
go run .
#
curl http://localhost:8080/greeting
```

无论注册顺序如何，都按依赖顺序创建并返回 hello。图检查拒绝重复类型、缺失依赖、接口歧义与循环。构造函数准备阶段运行时检查 nil 返回和 panic。

## 外部工厂

```go
app.Constructor(constructor.Custom(database.NewDB))
```

例如 database.NewDB 的签名为 func NewDB() *bun.DB。对象和函数构造器只支持一个返回值。拒绝 (T, error) 与可变参数，允许普通 []T 参数。接口优先匹配返回类型完全一致的提供者，否则必须只有一个可赋值的提供者。

## 验证与生命周期

BuildApplication 仅组装应用。app.Validate 不执行构造函数；Prepare 执行构造函数并收集 RegisterRoutes。Run 准备并启动应用。不会自动调用 DI 对象的任意 Close，数据库资源由所有者管理。请求事务通过 ExecutionContext().Set/Get 和显式服务参数传递，不能覆盖共享对象字段。

## 下一步

[拦截器](/zh-Hans/learn/tutorial/4-interceptor) / [数据库](/zh-Hans/learn/tutorial/5-database) / [事务](/zh-Hans/learn/tutorial/6-transaction)
