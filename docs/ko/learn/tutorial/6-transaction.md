# 트랜잭션 관리

한 HTTP 요청에서 실행한 여러 INSERT를 하나의 트랜잭션으로 묶습니다. 요청이 성공하면 커밋하고, 중간에 실패하면 앞선 INSERT까지 롤백하는 인터셉터를 작성합니다.

[데이터베이스](/ko/learn/tutorial/5-database)의 `example.com/my-app`에서 이어갑니다. `src/database`, `src/entity`, `src/user`와 마이그레이션을 먼저 준비하세요. 아래 트랜잭션 코드는 직접 추가하며, CLI는 Bun 트랜잭션이나 outbox 생성기를 제공하지 않습니다.

## 실행 순서

Spine v0.5.1에서는 `PreHandle`에서 트랜잭션을 시작하고 `BeforeResponse`에서 커밋하거나 롤백합니다. 응답 직렬화, 상태 코드와 쿠키 검증, 이벤트 발행 등 응답 준비 과정에서 발생한 오류도 롤백 조건에 포함됩니다. `AfterCompletion`은 완료 후 로그를 남기거나 자원을 정리할 때 사용합니다.

```text
PreHandle: 트랜잭션 시작
→ 컨트롤러 → 응답 준비 → PostHandle
→ BeforeResponse: 오류가 있으면 롤백, 없으면 커밋
→ HTTP 응답 전송
→ AfterCompletion: 로그 기록과 자원 정리
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

`Commit()`과 `Rollback()`의 오류를 반환해야 최종 실행 오류에 반영됩니다. `log`와 `errors`를 포함한 import와 네 인터셉터 메서드를 모두 유지하세요.

## 생성된 앱에 등록

`internal/application/application.go`의 import 블록에 `example.com/my-app/src/interceptor`를 추가합니다. 데이터베이스 튜토리얼에서 등록한 `database.NewDB`와 health, user 등록을 유지하고, 기존 `app.Constructor` 호출에 `interceptor.NewTxInterceptor`를 추가하세요. 다음 코드는 `BuildApplication()` 안의 등록 부분입니다.

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

`(*interceptor.TxInterceptor)(nil)`은 인터셉터 타입을 지정합니다. Spine은 이 타입에 해당하는 인스턴스를 DI로 생성하며, `NewTxInterceptor`는 값 하나를 반환해야 합니다.

HTTP 요청에만 적용하려면 위와 같이 `boot.InterceptorHTTP`를 사용하세요. `app.Interceptor(...)`는 WebSocket 메시지에도 적용됩니다. 특정 라우트에만 적용하려면 전역 등록을 생략하고, 해당 `app.Route`에 `route.WithInterceptors((*interceptor.TxInterceptor)(nil))` 옵션을 지정합니다.

## 요청 트랜잭션을 저장소로 전달

`src/user/user_create.go`를 추가해 요청의 트랜잭션으로 사용자를 저장합니다. 생성된 `UserController`의 `service`와 `UserService`의 `repository` 필드를 사용합니다.

요청 DTO는 포인터로 받습니다. `spine.Ctx`는 `github.com/NARUBROWN/spine/pkg/spine`에서 가져옵니다. 아래 코드는 앱 루트 패키지와 이름이 겹치지 않도록 `spinectx`라는 별칭을 사용합니다.

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

서비스는 요청의 트랜잭션을 `bun.IDB`로 받아 저장소에 전달합니다. `*bun.DB`와 `bun.Tx`는 같은 인터페이스를 구현하지만, 요청의 트랜잭션이 저장소 생성자에 자동으로 다시 주입되지는 않습니다.

`src/user/user_repository.go`의 기존 `Save` 메서드를 다음 구현으로 교체합니다. 같은 이름의 메서드를 추가로 선언하지 않습니다.

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

## 여러 쓰기를 묶고 롤백 확인

이번에는 한 요청에서 여러 사용자를 저장합니다. `src/user/user_batch.go`를 만들고, 아래 POST 라우트를 `src/user/user_route.go`의 `Register`에 추가하세요. 두 번째 INSERT가 중복 이메일로 실패하면 첫 번째 INSERT도 롤백되어야 합니다.

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

읽기 요청에서 트랜잭션을 시작하지 않으려면 `PreHandle` 맨 앞에 다음 조건을 넣습니다. `BeforeResponse`도 트랜잭션이 없는 경우를 처리해야 하며, 위 구현에는 이 처리가 포함되어 있습니다. 트랜잭션을 사용하는 컨트롤러는 제외 대상에 넣지 마세요.

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

계약과 로컬 검사로는 실제 DB의 커밋과 롤백을 확인할 수 없습니다. 앱을 실행하려면 데이터베이스 튜토리얼의 `DATABASE_URL` 설정과 마이그레이션이 필요합니다. 다음 단계에서 성공 요청의 저장과 실패 요청의 롤백을 확인합니다. 커밋과 롤백 자체가 실패하는 경우의 오류 처리는 별도로 확인해야 합니다.

## 실제 DB에서 확인

데이터베이스 튜토리얼대로 마이그레이션을 실행하고 앱을 시작한 뒤, 다른 터미널에서 아래 요청을 보냅니다. 예제의 GET은 새로 만든 테스트 DB에서 첫 사용자의 ID가 1이라고 가정합니다. 기존 DB를 사용한다면 POST 응답의 ID로 GET 경로를 바꾸세요.

첫 POST는 HTTP 201로 저장되고, 응답의 ID로 GET하면 같은 사용자가 반환됩니다. `/user/batch` 요청은 두 번째 이메일이 중복되어 HTTP 500으로 실패합니다. DB 오류를 일반 오류로 반환하므로 응답에 내부 SQL 오류는 노출되지 않습니다.

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

DB 클라이언트에서 다음 SELECT 결과가 각각 1과 0인지 확인하세요. 두 번째 결과가 0이면 실패 전에 실행한 첫 INSERT까지 롤백된 것입니다. 마지막 Bob 요청은 중복되지 않는 이메일을 사용하므로 다시 HTTP 201로 저장되어야 합니다.

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 원자성 경계

DB 커밋, 브로커의 이벤트 발행, 소켓의 응답 전송은 하나의 원자적 트랜잭션으로 묶이지 않습니다. 이벤트를 발행한 뒤 DB 커밋이 실패할 수 있고, 커밋 후 응답 전송이 실패할 수도 있습니다.

DB 변경과 이벤트 기록을 함께 보장해야 한다면 같은 DB 트랜잭션에 outbox 레코드를 저장하고, 별도 전달 작업에서 이벤트를 발행합니다. 재전송에도 같은 이벤트 ID를 사용하고, 소비자는 이 ID로 중복을 판별해야 합니다.

- [Interceptor API](/ko/reference/api/interceptor)
- [데이터베이스 연결](/ko/learn/tutorial/5-database)
