# 交易管理

::: info 0.7.5 API
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

先準備[資料庫專案](/zh-Hant/learn/tutorial/5-database)。一個請求中的多個 INSERT 共用同一交易。

## 執行順序

```text
PreHandle: BeginTx, 요청별 저장소에 tx 저장
→ 입력 바인딩과 태그 검증
→ 컨트롤러 → 서비스 → 저장소
→ 응답 직렬화와 검증, 성공 후처리
→ BeforeResponse: 오류가 있으면 Rollback, 없으면 Commit
→ HTTP 응답 전송
→ AfterCompletion: 로그와 정리
```

綁定在交易開始後進行，因此綁定錯誤也會觸發回滾。序列化、狀態碼與 Cookie 驗證在提交前完成。

## 攔截器

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

排除唯讀 GET/HEAD/OPTIONS。無交易的請求允許通過結束處理。Commit/Rollback 錯誤也須回傳。掛鉤使用 spine.Ctx，值使用 ExecutionContext().Set/Get，資料庫呼叫使用 ExecutionContext().Context()。

## 明確傳遞

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

控制器檢查 bun.Tx 是否存在及其型別，再以 bun.IDB 傳給前章的服務與 Save 方法。不要用請求交易覆寫共享物件。

## 取代現有檔案

取代以下兩個檔案。Constructor 註冊 DI，InterceptorFor 套用 HTTP 範圍。驗證器仍在 BuildApplication，標籤驗證失敗在處理器前回傳 400。不會自動呼叫任意 DTO Validate 方法。

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

## 驗證提交與回滾

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

在含前章 Alice 的新資料表中，依序得到 201、重複 batch 的 500、驗證失敗的 400。SELECT 結果應為 1 與 0，batch 的第一個 INSERT 也會回滾。重複執行前檢查既有電子郵件。

## 錯誤與原子性

BeforeResponse 錯誤優先決定回應，回滾失敗可將原來的 404 變為 500。AfterCompletion 也接收先前錯誤，但它在嘗試寫入後執行，不能作為提交點。資料庫變更、訊息發布與回應傳送不屬於同一原子交易。如需連結資料庫與事件記錄，應在同一交易寫入 outbox，再單獨傳遞。

## 下一步

[輸入驗證](/zh-Hant/learn/tutorial/7-error-handling) / [攔截器](/zh-Hant/learn/tutorial/4-interceptor)
