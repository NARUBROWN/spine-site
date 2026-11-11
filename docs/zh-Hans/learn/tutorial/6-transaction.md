# 事务管理

::: info 0.7.5 API
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

先准备[数据库项目](/zh-Hans/learn/tutorial/5-database)。一个请求中的多个 INSERT 共用同一事务。

## 执行顺序

```text
PreHandle: BeginTx, 요청별 저장소에 tx 저장
→ 입력 바인딩과 태그 검증
→ 컨트롤러 → 서비스 → 저장소
→ 응답 직렬화와 검증, 성공 후처리
→ BeforeResponse: 오류가 있으면 Rollback, 없으면 Commit
→ HTTP 응답 전송
→ AfterCompletion: 로그와 정리
```

绑定在事务开始后进行，因此绑定错误也会触发回滚。序列化、状态码和 Cookie 验证在提交前完成。

## 拦截器

```go
// src/interceptor/tx_interceptor.go
package interceptor

import (
	"errors"
	"github.com/NARUBROWN/spine/core"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/uptrace/bun"
	"log"
)

type TxInterceptor struct{ db *bun.DB }

func (*TxInterceptor) Constructor(db *bun.DB) *TxInterceptor {
	return &TxInterceptor{db: db}
}
func (i *TxInterceptor) PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error {
	request, ok := ctx.HTTPRequestContext()
	if !ok {
		return errors.New("HTTP request context unavailable")
	}
	switch request.Method() {
	case "GET", "HEAD", "OPTIONS":
		return nil
	}
	tx, err := i.db.BeginTx(ctx.ExecutionContext().Context(), nil)
	if err != nil {
		return err
	}
	ctx.ExecutionContext().Set("tx", tx)
	return nil
}
func (*TxInterceptor) PostHandle(spinectx.Ctx, core.HandlerMeta) {}
func (*TxInterceptor) BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error {
	value, ok := ctx.ExecutionContext().Get("tx")
	if !ok {
		return nil
	}
	tx, ok := value.(bun.Tx)
	if !ok {
		return errors.New("transaction has unexpected type")
	}
	if executionErr != nil {
		return tx.Rollback()
	}
	return tx.Commit()
}
func (*TxInterceptor) AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error) {
	if err != nil {
		log.Printf("[TX] %s: %v", meta.HandlerName(), err)
	}
}
```

排除只读 GET/HEAD/OPTIONS。无事务的请求允许通过结束处理。Commit/Rollback 错误也须返回。钩子使用 spine.Ctx，值使用 ExecutionContext().Set/Get，数据库调用使用 ExecutionContext().Context()。

## 显式传递

```go
// src/controller/user_create.go
package controller

import (
	"errors"
	"example.com/my-app/src/entity"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/uptrace/bun"
	"net/http"
)

type CreateUserRequest struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}
type CreateUsersRequest struct {
	Users []CreateUserRequest `json:"users" validate:"required,min=1,dive"`
}

func requestTransaction(ctx spinectx.Ctx) (bun.Tx, error) {
	value, ok := ctx.ExecutionContext().Get("tx")
	if !ok {
		return bun.Tx{}, errors.New("transaction is missing")
	}
	tx, ok := value.(bun.Tx)
	if !ok {
		return bun.Tx{}, errors.New("transaction has unexpected type")
	}
	return tx, nil
}
func (c *UserController) Create(ctx spinectx.Ctx, body input.Body[CreateUserRequest]) (httpx.Response[*entity.User], error) {
	tx, err := requestTransaction(ctx)
	if err != nil {
		return httpx.Response[*entity.User]{}, err
	}
	user, err := c.service.Create(ctx.ExecutionContext().Context(), tx, body.Name, body.Email)
	if err != nil {
		return httpx.Response[*entity.User]{}, err
	}
	return httpx.Response[*entity.User]{Body: user, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
}
func (c *UserController) CreateBatch(ctx spinectx.Ctx, body input.Body[CreateUsersRequest]) (httpx.Response[[]*entity.User], error) {
	tx, err := requestTransaction(ctx)
	if err != nil {
		return httpx.Response[[]*entity.User]{}, err
	}
	users := make([]*entity.User, 0, len(body.Users))
	for _, request := range body.Users {
		user, err := c.service.Create(ctx.ExecutionContext().Context(), tx, request.Name, request.Email)
		if err != nil {
			return httpx.Response[[]*entity.User]{}, err
		}
		users = append(users, user)
	}
	return httpx.Response[[]*entity.User]{Body: users, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
}
```

控制器检查 bun.Tx 是否存在及其类型，再以 bun.IDB 传给前章的服务和 Save 方法。不要用请求事务覆盖共享对象。

## 替换现有文件

替换以下两个文件。Constructor 注册 DI，InterceptorFor 应用 HTTP 范围。验证器仍在 BuildApplication 中，标签验证失败在处理器前返回 400。不会自动调用任意 DTO Validate 方法。

```go
// src/controller/user_controller.go
package controller

import (
	"database/sql"
	"errors"
	"example.com/my-app/src/entity"
	"example.com/my-app/src/service"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type UserPath struct {
	ID int64 `path:"id"`
}
type UserController struct{ service *service.UserService }

func (*UserController) Constructor(svc *service.UserService) *UserController {
	return &UserController{service: svc}
}
func (c *UserController) RegisterRoutes(r *api.Registry) {
	r.GET("/users/:id", c.Get)
	r.POST("/users", c.Create)
	r.POST("/users/batch", c.CreateBatch)
}
func (c *UserController) Get(ctx spinectx.Ctx, path input.Path[UserPath]) (httpx.Response[*entity.User], error) {
	user, err := c.service.Get(ctx.ExecutionContext().Context(), path.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return httpx.Response[*entity.User]{}, httperr.NotFound("user not found")
	}
	return httpx.Response[*entity.User]{Body: user}, err
}
```

```go
// internal/application/application.go
package application

import (
	"example.com/my-app/src/controller"
	"example.com/my-app/src/database"
	"example.com/my-app/src/interceptor"
	"example.com/my-app/src/repository"
	"example.com/my-app/src/service"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(
		constructor.Custom(database.NewDB),
		constructor.Interceptor(&interceptor.TxInterceptor{}),
		constructor.Repository(&repository.UserRepository{}),
		constructor.Service(&service.UserService{}),
		constructor.Controller(&controller.UserController{}),
	)
	app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
	return app, boot.Options{
		Address:                ":8080",
		HTTP:                   &boot.HTTPOptions{OpenAPI: boot.OpenAPIOptions{Enabled: true}},
		EnableGracefulShutdown: true,
	}, nil
}
```

## 验证提交与回滚

```sh
gofmt -w src internal
go build ./...
go run .
#
curl -i -H 'Content-Type: application/json' -d '{"name":"Bob","email":"bob@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"users":[{"name":"Rollback","email":"rollback@example.com"},{"name":"Duplicate","email":"alice@example.com"}]}' http://localhost:8080/users/batch
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
```

```sql
SELECT COUNT(*) FROM users WHERE email = 'bob@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

在含前章 Alice 的新表中，依次得到 201、重复 batch 的 500、验证失败的 400。SELECT 结果应为 1 和 0，batch 的第一个 INSERT 也会回滚。重复运行前检查已有邮箱。

## 错误与原子性

BeforeResponse 错误优先决定响应，回滚失败可将原来的 404 变为 500。AfterCompletion 也接收先前错误，但它在写入尝试后运行，不能作为提交点。数据库变更、消息发布和响应发送不属于同一原子事务。如需绑定数据库与事件记录，应在同一事务写入 outbox，再单独投递。

## 下一步

[输入验证](/zh-Hans/learn/tutorial/7-error-handling) / [拦截器](/zh-Hans/learn/tutorial/4-interceptor)
