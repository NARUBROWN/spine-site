# 트랜잭션 관리

[데이터베이스](/ko/learn/tutorial/5-database)의 CLI 프로젝트 `example.com/my-app`에서 이어갑니다. `src/database`, `src/entity`, `src/user`를 사용하며 아래 트랜잭션 코드는 직접 추가합니다. CLI는 Bun 트랜잭션이나 outbox 생성기를 제공하지 않습니다.

## 실행 순서

Spine v0.5.1에서는 `PreHandle`에서 트랜잭션을 시작하고 `BeforeResponse`에서 commit 또는 rollback합니다. 응답 직렬화·상태·쿠키 검증과 이벤트 발행 등 응답 준비에 실패해도 rollback할 수 있도록 경계를 잡습니다. `AfterCompletion`은 완료 후 로깅과 정리에 사용합니다.

```text
PreHandle: begin transaction
→ Controller → response preparation → PostHandle
→ BeforeResponse: rollback on error, commit on success
→ HTTP response flush
→ AfterCompletion: logging / cleanup
```

## 인터셉터 구현

```go
// src/interceptor/tx_interceptor.go
package interceptor

import (
    "errors"
    "log"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct{ db *bun.DB }

func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Context() == nil {
        return errors.New("execution context has no request context")
    }
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TxInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    value, ok := ctx.Get("tx")
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

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[TX] %s %s: %v", ctx.Method(), ctx.Path(), err)
    }
}
```

commit·rollback 오류를 반환해야 최종 실행 오류에 반영됩니다. `log`와 `errors`를 포함한 import와 네 인터셉터 메서드를 모두 유지하세요.

## 생성된 앱에 등록

`internal/application/application.go`의 기존 import 블록에 `example.com/my-app/src/interceptor`를 추가합니다. 데이터베이스 튜토리얼에서 이미 등록한 `database.NewDB`와 health·user 등록을 유지하고, 기존 Constructor 호출에 `interceptor.NewTxInterceptor`만 추가하세요. 다음 코드는 `BuildApplication()` 안의 등록 부분입니다.

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

typed-nil `(*interceptor.TxInterceptor)(nil)`은 DI가 생성한 인터셉터 인스턴스로 해결됩니다. `NewTxInterceptor`는 값 하나를 반환합니다. HTTP 트랜잭션에는 `boot.InterceptorHTTP`를 사용하세요. `app.Interceptor(...)`는 WebSocket 메시지에도 적용됩니다. 특정 라우트에만 적용하려면 전역 등록을 생략하고 `route.WithInterceptors((*interceptor.TxInterceptor)(nil))`을 해당 `app.Route` 옵션으로 지정합니다.

## 요청 트랜잭션을 저장소로 전달

아래는 기존 `src/user` 골격에 직접 추가하는 POST 예제입니다. 생성된 `UserController`의 `service`와 `UserService`의 `repository` 필드를 사용합니다. 요청 DTO는 포인터로 받고, `spine.Ctx`는 `github.com/NARUBROWN/spine/pkg/spine`에서 import합니다. 앱 루트 패키지와 이름이 겹치면 `spinectx` alias를 사용하세요.

```go
// src/user/user_create.go
package user

import (
    "context"
    "errors"
    "net/http"

    "example.com/my-app/src/entity"
    "github.com/NARUBROWN/spine/pkg/httpx"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

type CreateUserRequest struct {
    Name string `json:"name"`
    Email string `json:"email"`
}

func (c *UserController) Create(ctx context.Context, values spinectx.Ctx, req *CreateUserRequest) (httpx.Response[*entity.User], error) {
    value, ok := values.Get("tx")
    if !ok {
        return httpx.Response[*entity.User]{}, errors.New("transaction is missing")
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return httpx.Response[*entity.User]{}, errors.New("transaction has unexpected type")
    }
    user, err := c.service.Create(ctx, tx, req)
    if err != nil {
        return httpx.Response[*entity.User]{}, err
    }
    return httpx.Response[*entity.User]{
        Body: user,
        Options: httpx.ResponseOptions{Status: http.StatusCreated},
    }, nil
}

func (s *UserService) Create(ctx context.Context, db bun.IDB, req *CreateUserRequest) (*entity.User, error) {
    user := &entity.User{Name: req.Name, Email: req.Email}
    if err := s.repository.Save(ctx, db, user); err != nil {
        return nil, err
    }
    if err := db.NewSelect().Model(user).WherePK().Scan(ctx); err != nil {
        return nil, err
    }
    return user, nil
}
```

서비스는 `bun.IDB`를 저장소로 넘깁니다. `*bun.DB`와 `bun.Tx`가 같은 인터페이스를 구현하지만, 요청의 tx는 생성자에 자동으로 다시 주입되지 않습니다. 기존 저장소의 `Save(ctx, db, user)` 시그니처를 다음과 같이 추가하거나 맞춥니다.

기존 `Save` 메서드를 다음 구현으로 교체합니다. 같은 이름의 메서드를 추가로 선언하지 않습니다.

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

`src/user/user_route.go`의 `Register`에 POST 라우트를 직접 추가합니다. 기존 GET 등록은 유지합니다.

```go
app.Route("POST", "/user", (*UserController).Create)
```

## 한 요청의 여러 쓰기와 rollback

위의 단일 생성과 같은 트랜잭션에 여러 사용자를 저장합니다. `src/user/user_batch.go`를 추가하고 아래 POST 라우트를 `src/user/user_route.go`의 `Register`에 추가하세요. 두 번째 INSERT가 중복 email로 실패하면 첫 번째 INSERT도 rollback되어야 합니다.

```go
// src/user/user_batch.go
package user

import (
    "context"
    "errors"
    "net/http"

    "example.com/my-app/src/entity"
    "github.com/NARUBROWN/spine/pkg/httpx"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

type CreateUsersRequest struct {
    Users []CreateUserRequest `json:"users"`
}

func (c *UserController) CreateBatch(ctx context.Context, values spinectx.Ctx, req *CreateUsersRequest) (httpx.Response[[]*entity.User], error) {
    value, ok := values.Get("tx")
    if !ok {
        return httpx.Response[[]*entity.User]{}, errors.New("transaction is missing")
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return httpx.Response[[]*entity.User]{}, errors.New("transaction has unexpected type")
    }
    users := make([]*entity.User, 0, len(req.Users))
    for index := range req.Users {
        user, err := c.service.Create(ctx, tx, &req.Users[index])
        if err != nil {
            return httpx.Response[[]*entity.User]{}, err
        }
        users = append(users, user)
    }
    return httpx.Response[[]*entity.User]{
        Body: users,
        Options: httpx.ResponseOptions{Status: http.StatusCreated},
    }, nil
}
```

```go
app.Route("POST", "/user/batch", (*UserController).CreateBatch)
```

## 읽기 요청 제외

읽기 요청을 제외하려면 `PreHandle` 맨 앞에 다음 조건을 넣습니다. `BeforeResponse`도 트랜잭션이 없는 경우를 처리해야 합니다. tx가 필요한 컨트롤러를 이 제외 대상에 넣지 마세요.

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## 검증과 실행

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
spine doctor
spine inspect
spine contract check
spine verify
spine dev
```

계약과 로컬 검사 통과는 DB commit·rollback의 실제 동작을 증명하지 않습니다. 앱을 실행하려면 데이터베이스 튜토리얼의 `DATABASE_URL`과 마이그레이션이 필요합니다. 실제 DB에서 성공 요청의 저장, 실패 요청의 rollback, commit·rollback 오류 처리를 별도 확인하세요.

## 실제 DB에서 확인

먼저 데이터베이스 튜토리얼대로 마이그레이션을 실행하고 앱을 시작합니다. 아래 예제는 빈 테스트 DB를 가정합니다. 첫 요청은 HTTP 201이며 응답의 ID로 GET하면 같은 사용자가 반환됩니다. batch 요청은 두 번째 email이 중복되어 HTTP 500으로 실패합니다. 이 예제는 DB 오류를 일반 오류로 반환하므로 응답에는 내부 SQL 오류가 노출되지 않습니다.

```bash
curl -i -X POST http://localhost:8080/user \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
curl -i http://localhost:8080/user/1

curl -i -X POST http://localhost:8080/user/batch \
  -H 'Content-Type: application/json' \
  -d '{"users":[{"name":"Rollback","email":"rollback@example.com"},{"name":"Duplicate","email":"alice@example.com"}]}'

curl -i -X POST http://localhost:8080/user \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bob","email":"bob@example.com"}'
```

DB 클라이언트에서 다음 SELECT 결과가 각각 1과 0인지 확인하세요. 두 번째 결과가 0이어야 실패 전에 실행한 첫 INSERT까지 rollback된 것입니다. 이후 고유 email로 요청하면 다시 HTTP 201로 저장되어야 합니다.

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 원자성 경계

DB commit은 broker publish나 실제 socket write와 하나의 원자적 트랜잭션이 아닙니다. 이벤트가 발행된 뒤 commit이 실패할 수 있고, commit 후 응답 전송도 실패할 수 있습니다. DB 변경과 이벤트 기록은 같은 DB 트랜잭션에 outbox로 저장하고 별도 relay로 발행하며, 소비자는 안정적인 이벤트 ID로 중복을 처리해야 합니다.

- [Interceptor API](/ko/reference/api/interceptor)
- [Database](/ko/learn/tutorial/5-database)
