# トランザクション管理

::: info 0.7.5 API
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

先に [DB プロジェクト](/ja/learn/tutorial/5-database)を用意します。一つのリクエストの複数 INSERT を一つのトランザクションにします。

## 実行順序

```text
PreHandle: BeginTx, 요청별 저장소에 tx 저장
→ 입력 바인딩과 태그 검증
→ 컨트롤러 → 서비스 → 저장소
→ 응답 직렬화와 검증, 성공 후처리
→ BeforeResponse: 오류가 있으면 Rollback, 없으면 Commit
→ HTTP 응답 전송
→ AfterCompletion: 로그와 정리
```

バインドはトランザクション開始後で、バインドエラーもロールバック対象です。直列化、ステータス、Cookie 検証はコミット前です。

## インターセプター

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

読み取り GET/HEAD/OPTIONS は除外します。トランザクションのないリクエストは終了処理を通過します。Commit/Rollback のエラーも返します。フックは spine.Ctx、値は ExecutionContext().Set/Get、DB 呼び出しは ExecutionContext().Context() を使います。

## 明示的な受け渡し

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

コントローラーで bun.Tx の有無と型を確認し、前章のサービスと Save の bun.IDB 引数に渡します。共有オブジェクトをリクエストのトランザクションで上書きしません。

## 既存ファイルの置き換え

次の二つを置き換えます。Constructor は DI 提供、InterceptorFor は HTTP 適用範囲です。検証器は BuildApplication に維持し、タグ違反はハンドラー前に 400 です。任意の DTO Validate メソッドは自動実行されません。

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

## コミットとロールバックの確認

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

前章の Alice がある新規テーブルで、201、重複 batch の 500、検証失敗の 400 です。SELECT は 1 と 0 になり、batch の最初の INSERT も戻ります。再実行前にメールの状態を確認します。

## エラーと原子性

BeforeResponse のエラーが応答で優先するため、元が 404 でもロールバック失敗で 500 になります。以前のエラーも AfterCompletion に渡しますが、応答試行後なのでコミット場所には使えません。DB、ブローカー発行、応答送信は一つの原子的処理ではありません。DB 変更とイベント記録には同じトランザクションで outbox を保存し、別途配信します。

## 次のステップ

[入力検証](/ja/learn/tutorial/7-error-handling) / [インターセプター](/ja/learn/tutorial/4-interceptor)
