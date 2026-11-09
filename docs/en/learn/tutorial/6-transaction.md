# Manage transactions

::: info
The `legacy` layout in this tutorial uses compatibility `app.Route`. See [route migration](/en/learn/migration/preview-controller-routes) for new controllers, [input migration](/en/learn/migration/v0.7.1-preview) for compatibility rules, and [OpenAPI](/en/reference/api/openapi) for specification options.
:::

Group multiple INSERTs from one HTTP request into a single transaction. Write an interceptor that commits when the request succeeds and rolls back earlier INSERTs if a later operation fails.

The `src/user` examples use the app created with `--layout legacy` in [Project Structure](/en/learn/tutorial/1-project-structure). The default `layered-v1` layout uses role-based directories.

Continue with `example.com/my-app` from [Database](/en/learn/tutorial/5-database). Prepare `src/database`, `src/entity`, `src/user`, and the migrations first. Add the transaction code below yourself; the CLI does not provide a Bun transaction or outbox generator.

## Execution order

In Spine v0.7.1, start the transaction in `PreHandle` and commit or roll it back in `BeforeResponse`. Errors during response preparation, including response serialization, status code and cookie validation, and event publication, also trigger a rollback. Use `AfterCompletion` to log results or clean up resources after completion.

```text
PreHandle: Begin the transaction
→ Controller → Response preparation → PostHandle
→ BeforeResponse: Roll back on error; otherwise, commit
→ Send the HTTP response
→ AfterCompletion: Log results and clean up resources
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

Return errors from `Commit()` and `Rollback()` so they are included in the final execution error. Keep all imports, including `log` and `errors`, and all four interceptor methods.

## Register with the generated app

Add `example.com/my-app/src/interceptor` to the import block in `internal/application/application.go`. Keep `database.NewDB` and the health and user registrations from the database tutorial, and add `interceptor.NewTxInterceptor` to the existing `app.Constructor` call. The following code is the registration section inside `BuildApplication()`.

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

`(*interceptor.TxInterceptor)(nil)` specifies the interceptor type. Spine creates an instance of this type through DI, and `NewTxInterceptor` must return a single value.

To apply the interceptor only to HTTP requests, use `boot.InterceptorHTTP` as shown above. `app.Interceptor(...)` also applies to WebSocket messages. To apply it only to a particular route, omit the global registration and set `route.WithInterceptors((*interceptor.TxInterceptor)(nil))` on that `app.Route`.

## Pass the request transaction to the repository

Add `src/user/user_create.go` to save a user with the request's transaction. Use the `service` field in the generated `UserController` and the `repository` field in `UserService`.

Receive the request DTO as a pointer. Import `spine.Ctx` from `github.com/NARUBROWN/spine/pkg/spine`. The code below uses the alias `spinectx` to avoid a name conflict with the app's root package.

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

The service receives the request's transaction as `bun.IDB` and passes it to the repository. Although `*bun.DB` and `bun.Tx` implement the same interface, the request's transaction is not automatically reinjected into the repository constructor.

Replace the existing `Save` method in `src/user/user_repository.go` with the following implementation. Do not declare an additional method with the same name.

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

Add the POST route directly to `Register` in `src/user/user_route.go`. Keep the existing GET registration.

```go
app.Route("POST", "/user", (*UserController).Create)
```

## Group multiple writes and check rollback

Now save multiple users in one request. Create `src/user/user_batch.go` and add the POST route below to `Register` in `src/user/user_route.go`. If the second INSERT fails because of a duplicate email, the first INSERT must also be rolled back.

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

To avoid starting a transaction for read requests, add the following condition at the start of `PreHandle`. `BeforeResponse` must also handle requests without a transaction; the implementation above already does this. Do not exclude controllers that use transactions.

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## Verify and run

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
go mod download all
spine doctor
spine inspect
spine contract check
spine verify
spine dev
```

Contract checks and local checks cannot confirm commits and rollbacks in an actual database. To run the app, set `DATABASE_URL` and run the migrations from the database tutorial. The next step checks that successful requests save data and failed requests roll it back. Error handling for failures in the commit and rollback operations themselves requires separate verification.

## Check with an actual database

Run the migrations and start the app as described in the database tutorial, then send the requests below from another terminal. The GET example assumes that the first user in a newly created test database has an ID of 1. If you use an existing database, change the GET path to use the ID from the POST response.

The first POST saves a user and returns HTTP 201. A GET with the ID from the response returns the same user. The `/user/batch` request fails with HTTP 500 because the second email is a duplicate. The database error is returned as a regular error, so the response does not expose the internal SQL error.

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

In a database client, check that the following SELECT queries return 1 and 0, respectively. A second result of 0 means that the first INSERT, which ran before the failure, was also rolled back. The final Bob request uses a unique email, so it should save successfully and return HTTP 201 again.

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## Atomicity boundary

A database commit, event publication to a broker, and response transmission over a socket do not form a single atomic transaction. The database commit can fail after an event has been published, and response transmission can fail after the commit.

If you need to guarantee that a database change and its event record are saved together, save an outbox record in the same database transaction and publish the event in a separate delivery job. Reuse the same event ID for retries, and have consumers use that ID to detect duplicates.

- [Interceptor API](/en/reference/api/interceptor)
- [Connect to a database](/en/learn/tutorial/5-database)
