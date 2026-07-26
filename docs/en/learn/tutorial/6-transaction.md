# Transaction Management

Use an interceptor to align a request-scoped database transaction with Spine's prepared-response lifecycle.

## Lifecycle

```text
PreHandle       begin transaction
controller      execute business operations
prepare         serialize response and validate cookies/status
hooks           complete post-execution work
BeforeResponse  commit on success, roll back on error
flush           write the prepared HTTP response
AfterCompletion observe the final result and clean up
```

Do not commit in `AfterCompletion`. v0.5.1 runs `BeforeResponse` after all application-controlled response preparation but before the response is flushed, so a commit failure can still replace a prepared success response with an error.

## Transaction interceptor

```go
package interceptor

import (
    "errors"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

const TxContextKey = "app.tx"

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
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    ctx.Set(TxContextKey, tx)
    return nil
}

func (i *TxInterceptor) PostHandle(core.ExecutionContext, core.HandlerMeta) {}

func (i *TxInterceptor) BeforeResponse(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    executionErr error,
) error {
    value, ok := ctx.Get(TxContextKey)
    if !ok {
        return nil
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return errors.New("invalid request transaction")
    }
    if executionErr != nil {
        return tx.Rollback()
    }
    return tx.Commit()
}

func (i *TxInterceptor) AfterCompletion(
    core.ExecutionContext,
    core.HandlerMeta,
    error,
) {}
```

`BeforeResponse` may be called for an early failure after `PreHandle`, so always make lookup and cleanup defensive. A rollback can itself fail; returning that error preserves it in the final pipeline error.

## Registration

Transactions normally belong on write routes, not every HTTP or WebSocket operation.

```go
app.Constructor(
    NewDB,
    interceptor.NewTxInterceptor,
    repository.NewUserRepository,
    service.NewUserService,
    controller.NewUserController,
)

app.Route(
    "POST",
    "/users",
    (*controller.UserController).Create,
    route.WithInterceptors((*interceptor.TxInterceptor)(nil)),
)
```

The typed-nil interceptor is resolved from the DI container. If you intentionally register one globally for HTTP, scope it explicitly so it does not also wrap WebSocket messages:

```go
app.InterceptorFor(
    boot.InterceptorHTTP,
    (*interceptor.TxInterceptor)(nil),
)
```

## Passing the transaction to application code

`context.Context` carries cancellation and deadlines. `spine.Ctx` is the read-only controller view of values placed in `ExecutionContext` by interceptors.

```go
func (c *UserController) Create(
    ctx context.Context,
    req *dto.CreateUserRequest,
    spineCtx spine.Ctx,
) (httpx.Response[dto.UserResponse], error) {
    value, ok := spineCtx.Get(interceptor.TxContextKey)
    if !ok {
        return httpx.Response[dto.UserResponse]{},
            httperr.InternalServerError("transaction unavailable")
    }

    tx, ok := value.(bun.IDB)
    if !ok {
        return httpx.Response[dto.UserResponse]{},
            httperr.InternalServerError("transaction unavailable")
    }

    user, err := c.service.Create(ctx, tx, req)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, err
    }
    return httpx.Response[dto.UserResponse]{Body: user, Status: 201}, nil
}
```

Pass both values explicitly through service and repository methods:

```go
func (s *UserService) Create(
    ctx context.Context,
    db bun.IDB,
    req *dto.CreateUserRequest,
) (dto.UserResponse, error) {
    user := &entity.User{Name: req.Name, Email: req.Email}
    if err := s.repo.Save(ctx, db, user); err != nil {
        return dto.UserResponse{}, err
    }
    return dto.UserResponse{ID: user.ID, Name: user.Name}, nil
}

func (r *UserRepository) Save(
    ctx context.Context,
    db bun.IDB,
    user *entity.User,
) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

Both `*bun.DB` and `bun.Tx` implement `bun.IDB`, so one repository method can support transactional and non-transactional callers. Any repository call that uses its base `*bun.DB` instead of the supplied `bun.IDB` runs outside the request transaction.

## Transaction options

Choose `sql.TxOptions` in `PreHandle` when the route needs a specific isolation level or read-only transaction:

```go
tx, err := i.db.BeginTx(ctx.Context(), &sql.TxOptions{
    Isolation: sql.LevelSerializable,
    ReadOnly:  false,
})
```

Avoid selecting behavior from method-name conventions when a route-level interceptor makes the transaction boundary explicit.

## External events and atomicity

Spine prepares and validates the response before domain-event post-processing and `BeforeResponse`, but a broker publish cannot be atomic with a later database commit or physical socket write. For durable cross-system consistency:

- write an outbox record in the same database transaction;
- publish the outbox asynchronously;
- use idempotency keys in consumers;
- expect at-least-once delivery from broker retries.

## Key takeaways

| Concern | Correct boundary |
|---|---|
| begin transaction | `PreHandle` |
| commit or rollback | `BeforeResponse` |
| metrics and cleanup | `AfterCompletion` |
| cancellation | `context.Context` |
| request-scoped transaction lookup | `spine.Ctx` |
| repository abstraction | `bun.IDB` |

## Next steps

- [Interceptors](/en/learn/tutorial/4-interceptor)
- [Execution pipeline](/en/learn/core-concepts/pipeline)
- [Current Release](/en/community/changelog)
