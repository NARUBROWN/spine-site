# Transaction Management

Continue with the CLI project `example.com/my-app` from [Database](/en/learn/tutorial/5-database). Use `src/database`, `src/entity`, and `src/user`; add the transaction code below manually. The CLI does not generate Bun transaction or outbox implementations.

## Execution order

In Spine v0.5.1, start the transaction in `PreHandle` and commit or roll back in `BeforeResponse`. This boundary also handles response preparation failures, including serialization, status/cookie validation, and event dispatch. Use `AfterCompletion` for completion logging and cleanup.

```text
PreHandle: begin transaction
→ Controller → response preparation → PostHandle
→ BeforeResponse: rollback on error, commit on success
→ HTTP response flush
→ AfterCompletion: logging / cleanup
```

## Implement the interceptor

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

Return commit and rollback errors so they become execution errors. Keep the imports, including `log` and `errors`, and all four interceptor methods.

## Register in the generated app

Add `example.com/my-app/src/interceptor` to the imports in `internal/application/application.go`. Keep the database tutorial’s `database.NewDB` provider and existing health/user registration; add only `interceptor.NewTxInterceptor` to the existing Constructor call. This excerpt belongs inside `BuildApplication()`.

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

The typed-nil `(*interceptor.TxInterceptor)(nil)` resolves to the DI-created interceptor instance. `NewTxInterceptor` returns one value. Use `boot.InterceptorHTTP` for HTTP transactions; `app.Interceptor(...)` also applies to WebSocket messages. To scope a transaction to one route, omit global interceptor registration and pass `route.WithInterceptors((*interceptor.TxInterceptor)(nil))` to that `app.Route` call.

## Pass the request transaction to the repository

This POST example is a manual extension to `src/user`. It uses the generated `UserController.service` and `UserService.repository` fields. Receive the request DTO as a pointer. Import `spine.Ctx` from `github.com/NARUBROWN/spine/pkg/spine`; use the alias `spinectx` if the root app package would conflict.

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

The service forwards `bun.IDB` to the repository. Both `*bun.DB` and `bun.Tx` implement it, but request transactions are not reinjected into constructors. Add or align the repository’s `Save(ctx, db, user)` signature as below.

Replace the existing `Save` method with this implementation. Do not declare a second method with the same name.

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

Add the POST route manually inside `Register` in `src/user/user_route.go`. Keep the existing GET registration.

```go
app.Route("POST", "/user", (*UserController).Create)
```

## Multiple writes and rollback in one request

Save multiple users in the same transaction as the single-create example. Add `src/user/user_batch.go` and register the POST route below inside `Register` in `src/user/user_route.go`. If the second INSERT fails on a duplicate email, the first INSERT must roll back too.

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

## Exclude read requests

To skip read requests, add this condition at the start of `PreHandle`. `BeforeResponse` must also handle the absence of a transaction. Do not skip transactions for handlers that require them.

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## Verify and run

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
spine doctor
spine inspect
spine contract check
spine verify
spine dev
```

Passing contract and local checks does not prove real database commits and rollbacks. Running the app requires `DATABASE_URL` and migrations from the database tutorial. Separately check successful persistence, rollback on failure, and commit/rollback error handling against a real database.

## Check against a real database

Run migrations as shown in the database tutorial, then start the app. These requests assume an empty test database. The first request returns HTTP 201; GET its response ID to read the same persisted user. The batch fails with HTTP 500 because its second email is duplicated. This example returns database failures as ordinary errors, so the response does not disclose internal SQL errors.

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

Use a database client to confirm that the SELECT results below are 1 and 0. The second result must be 0 to show that the earlier successful INSERT also rolled back. A later request with a unique email should still return HTTP 201 and persist.

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## Atomicity boundary

A database commit is not atomic with broker publication or the physical socket write. Events may be published before a later commit failure, and response delivery may fail after commit. Store business changes and an outbox record in the same database transaction, publish through a separate relay, and deduplicate consumers using stable event IDs.

- [Interceptor API](/en/reference/api/interceptor)
- [Database](/en/learn/tutorial/5-database)
