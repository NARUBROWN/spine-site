# Transaction 관리

Spine v0.5.1에서는 인터셉터의 `PreHandle`에서 transaction을 시작하고 `BeforeResponse`에서 commit 또는 rollback합니다. `AfterCompletion`은 응답 이후의 정리에만 사용합니다.

```text
PreHandle: transaction 시작
→ Controller → 반환값 직렬화·쿠키·status 검증 → PostHandle
→ BeforeResponse: 오류면 rollback, 성공이면 commit
→ 실제 HTTP 응답 flush
→ AfterCompletion: logging·cleanup
```

이 순서 덕분에 Controller가 성공했더라도 JSON 직렬화나 쿠키 검증이 실패하면 commit하지 않습니다.

## TxInterceptor 구현

```go
package interceptor

import (
    "errors"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct {
    db *bun.DB
}

func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

func (i *TxInterceptor) PreHandle(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
) error {
    reqCtx := ctx.Context()
    if reqCtx == nil {
        return errors.New("execution context has no request context")
    }
    tx, err := i.db.BeginTx(reqCtx, nil)
    if err != nil {
        return err
    }
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) PostHandle(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
) {}

func (i *TxInterceptor) BeforeResponse(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    executionErr error,
) error {
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

func (i *TxInterceptor) AfterCompletion(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    err error,
) {
    if err != nil {
        log.Printf("[TX] %s %s: %v", ctx.Method(), ctx.Path(), err)
    }
}
```

commit이나 rollback 오류를 반드시 반환해야 최종 실행 오류에 포함됩니다. 무시하면 응답이 성공으로 처리될 수 있습니다.

## 등록 범위

HTTP 요청 transaction이라면 HTTP scope를 명시하십시오. `app.Interceptor(...)`는 HTTP뿐 아니라 WebSocket message에도 적용됩니다.

```go
app.Constructor(NewDB, NewTxInterceptor)
app.InterceptorFor(
    boot.InterceptorHTTP,
    (*TxInterceptor)(nil),
)
```

route별 transaction이 필요하면 `route.WithInterceptors((*TxInterceptor)(nil))`을 사용합니다. typed-nil은 container singleton으로 resolve됩니다.

## Repository에 transaction 전달

`*bun.DB`와 `bun.Tx`가 공통으로 구현하는 `bun.IDB`를 사용합니다.

```go
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}

func (r *UserRepository) Save(
    ctx context.Context,
    db bun.IDB,
    user *User,
) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

Controller는 `ControllerContext`에서 transaction을 읽고 service와 repository에 명시적으로 전달합니다.

```go
func (c *UserController) Create(
    ctx context.Context,
    spineCtx spine.Ctx,
    req CreateUserRequest,
) (*User, error) {
    value, ok := spineCtx.Get("tx")
    if !ok {
        return nil, errors.New("transaction is missing")
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return nil, errors.New("transaction has unexpected type")
    }
    return c.service.Create(ctx, tx, req)
}
```

## 선택적 transaction

읽기 요청을 제외하려면 `PreHandle`과 `BeforeResponse` 양쪽에서 transaction 존재 여부를 처리합니다.

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "GET" {
        return nil
    }
    // transaction 시작 후 ctx.Set("tx", tx)
    return nil
}
```

## 원자성 경계

`BeforeResponse`의 DB commit은 실제 socket write나 broker publish와 하나의 원자적 transaction이 아닙니다. event publish 뒤 commit 실패까지 일관된 결과로 보장해야 한다면 transactional outbox와 idempotency key를 사용하십시오.

## 핵심 정리

| 단계 | 역할 |
|---|---|
| `PreHandle` | transaction 시작 및 context 저장 |
| `BeforeResponse` | 준비 단계 오류를 포함해 rollback/commit하고 오류 반환 |
| `AfterCompletion` | 응답 이후 logging과 cleanup |
| `bun.IDB` | DB와 transaction을 repository에 같은 계약으로 전달 |

- [Interceptor API](/ko/reference/api/interceptor)
- [현재 릴리스](/ko/community/changelog)
