# 트랜잭션 관리

[DB 프로젝트](/ko/learn/tutorial/5-database)를 먼저 준비합니다. 한 요청의 여러 INSERT를 한 트랜잭션으로 처리합니다.

## 실행 순서

```text
PreHandle: BeginTx, 요청별 저장소에 tx 저장
→ 입력 바인딩과 태그 검증
→ 컨트롤러 → 서비스 → 저장소
→ 응답 직렬화와 검증, 성공 후처리
→ BeforeResponse: 오류가 있으면 Rollback, 없으면 Commit
→ HTTP 응답 전송
→ AfterCompletion: 로그와 정리
```

바인딩은 트랜잭션 시작 뒤입니다. 바인딩 오류도 롤백으로 이어집니다. 직렬화, 상태 코드와 쿠키 검증은 커밋 전에 수행합니다.

## 인터셉터

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

읽기 GET/HEAD/OPTIONS는 제외합니다. 트랜잭션이 없으면 종료 훅은 통과합니다. Commit/Rollback 오류도 반환합니다. 훅은 spine.Ctx, 값은 ExecutionContext().Set/Get, DB 컨텍스트는 ExecutionContext().Context()를 사용합니다.

## 명시적인 전달

```go
// src/controller/user_create.go
package controller

import (
	"errors"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"github.com/uptrace/bun"
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
```

컨트롤러에서 bun.Tx의 존재와 타입을 확인해 서비스와 저장소의 bun.IDB로 전달합니다. 앞 장의 Save와 서비스는 그대로 사용합니다. 공유 객체에 요청 트랜잭션을 덮어쓰지 않습니다.

## 기존 파일 교체

두 파일을 교체합니다. Constructor는 DI 제공, InterceptorFor는 HTTP 범위 적용입니다. 검증기는 계속 BuildApplication에 있어 태그 오류는 핸들러 전에 400입니다. 임의 DTO Validate 메서드를 자동 호출하지 않습니다.

```go
// src/controller/user_controller.go
package controller

import (
	"database/sql"
	"errors"
	"net/http"

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
	r.GET("/users/:id", func(ctx spinectx.Ctx, path input.Path[UserPath]) (httpx.Response[*entity.User], error) {
		user, err := c.service.Get(ctx.ExecutionContext().Context(), path.ID)
		if errors.Is(err, sql.ErrNoRows) {
			return httpx.Response[*entity.User]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[*entity.User]{Body: user}, err
	})

	r.POST("/users", func(ctx spinectx.Ctx, body input.Body[CreateUserRequest]) (httpx.Response[*entity.User], error) {
		tx, err := requestTransaction(ctx)
		if err != nil {
			return httpx.Response[*entity.User]{}, err
		}
		user, err := c.service.Create(ctx.ExecutionContext().Context(), tx, body.Name, body.Email)
		if err != nil {
			return httpx.Response[*entity.User]{}, err
		}
		return httpx.Response[*entity.User]{Body: user, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})

	r.POST("/users/batch", func(ctx spinectx.Ctx, body input.Body[CreateUsersRequest]) (httpx.Response[[]*entity.User], error) {
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
	})
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

## 커밋과 롤백 확인

```sh
gofmt -w src internal
go build ./...
go run .
# 다른 터미널: 앞 장에서 Alice를 넣은 테이블 기준
curl -i -H 'Content-Type: application/json' -d '{"name":"Bob","email":"bob@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"users":[{"name":"Rollback","email":"rollback@example.com"},{"name":"Duplicate","email":"alice@example.com"}]}' http://localhost:8080/users/batch
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
```

```sql
SELECT COUNT(*) FROM users WHERE email = 'bob@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

앞 장의 Alice가 있는 새 테이블 기준으로 201, 중복 batch의 500, 검증 실패 400입니다. SELECT 결과는 1과 0이어야 합니다. batch의 첫 INSERT도 롤백됩니다. 재실행 전 이메일 상태를 확인합니다.

## 오류와 원자성

BeforeResponse 오류가 HTTP 응답에 우선하므로 원래 404도 롤백 실패 시 500이 될 수 있습니다. 이전 오류도 AfterCompletion에 전달합니다. AfterCompletion은 응답 전송 시도 뒤이므로 커밋 장소가 아닙니다. DB, 브로커 발행과 실제 응답 전송은 한 원자적 트랜잭션이 아닙니다. DB와 이벤트 기록을 함께 보장하려면 같은 트랜잭션에 outbox를 저장하고 별도 전달합니다.

## 다음 단계

[입력 검증](/ko/learn/tutorial/7-error-handling) / [인터셉터](/ko/learn/tutorial/4-interceptor)
