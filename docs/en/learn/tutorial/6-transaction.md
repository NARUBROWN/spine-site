# Transactions

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Prepare the [database project](/en/learn/tutorial/5-database) first. Several INSERTs in one request share one transaction.

## Execution order

```text
PreHandle: BeginTx, 요청별 저장소에 tx 저장
→ 입력 바인딩과 태그 검증
→ 컨트롤러 → 서비스 → 저장소
→ 응답 직렬화와 검증, 성공 후처리
→ BeforeResponse: 오류가 있으면 Rollback, 없으면 Commit
→ HTTP 응답 전송
→ AfterCompletion: 로그와 정리
```

Binding occurs after transaction start, so binding errors also trigger rollback. Serialization, status and cookie validation occur before commit.

## Interceptor

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

Skip read methods GET/HEAD/OPTIONS. Completion of requests without transactions is allowed. Return Commit/Rollback errors too. Hooks use spine.Ctx, values use ExecutionContext().Set/Get, and DB calls use ExecutionContext().Context().

## Explicit propagation

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

Check the bun.Tx value and type in the controller, then pass it as bun.IDB to the unchanged service and Save method from the previous chapter. Do not overwrite shared objects with request transactions.

## Replace existing files

Replace these two files. Constructor registers DI; InterceptorFor applies HTTP scope. Keep the validator in BuildApplication, so tag failures return 400 before handlers. Arbitrary DTO Validate methods are not called automatically.

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

## Verify commit and rollback

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

With Alice from the previous chapter in a fresh table, expect 201, 500 for the duplicate batch and 400 for validation. SELECT results should be 1 and 0: the first batch INSERT also rolls back. Check existing emails before repeating.

## Errors and atomicity

BeforeResponse errors take response priority: a rollback failure can turn an original 404 into 500. AfterCompletion also receives earlier errors, but runs after the write attempt and cannot be the commit point. DB changes, broker publishing and response delivery are not one atomic transaction. To couple DB changes and event records, write an outbox in the same transaction and deliver separately.

## Next steps

[Validation](/en/learn/tutorial/7-error-handling) / [Interceptors](/en/learn/tutorial/4-interceptor)
