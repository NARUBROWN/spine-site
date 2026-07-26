# Transaction Management

Handling transactions in Spine.

## Overview

Spine manages transactions based on **Interceptors**.

```
Request
   │
   ├─→ TxInterceptor.PreHandle      // Start Transaction
   │
   ├─→ Controller → Service → Repository
   │
   └─→ TxInterceptor.AfterCompletion // Commit or Rollback
   
Response
```

- On success → Auto Commit
- On error → Auto Rollback

## TxInterceptor Implementation

```go
// interceptor/tx_interceptor.go
package interceptor

import (
    "errors"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct {
    db *bun.DB
}

// Constructor — DB Dependency Injection
func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

// PreHandle — Start Transaction
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    if reqCtx == nil {
        return errors.New("execution context has no request context")
    }

    // Start Transaction
    tx, err := i.db.BeginTx(reqCtx, nil)
    if err != nil {
        return err
    }

    // Store in ExecutionContext
    ctx.Set("tx", tx)
    return nil
}

// PostHandle — Do nothing
func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

// AfterCompletion — Commit or Rollback
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }

    // Rollback/Commit based on error
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

## Registration

```go
// main.go
func main() {
    app := spine.New()

    // 1. Register Constructors
    app.Constructor(
        NewDB,
        interceptor.NewTxInterceptor,
        repository.NewUserRepository,
        service.NewUserService,
        controller.NewUserController,
    )

    // 2. Register Interceptor (Type reference)
    app.Interceptor(
        (*interceptor.TxInterceptor)(nil),
    )

    routes.RegisterUserRoutes(app)
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

## bun.IDB Interface

The `bun.IDB` interface is key to using transactions in Repositories.

### Problem

```go
// ❌ Cannot use transaction if it receives only *bun.DB
type UserRepository struct {
    db *bun.DB
}
```

### Solution

```go
// ✅ bun.IDB is implemented by both *bun.DB and bun.Tx
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### What is bun.IDB?

| Type | bun.IDB Implementation |
|------|-------------|
| `*bun.DB` | ✅ |
| `bun.Tx` | ✅ |

You can use the same methods (`NewSelect`, `NewInsert`, etc.).


## Transaction Flow

### On Success

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ spineCtx.Get("tx") → bun.IDB
   └─→ Service.Create(ctx, tx, ...)
       └─→ Repository.Save(ctx, tx, ...)  // Uses tx
   └─→ return user, nil  ✓

3. TxInterceptor.AfterCompletion
   └─→ err == nil
   └─→ tx.Commit()  ✓
```

### On Failure

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ spineCtx.Get("tx") → bun.IDB
   └─→ Service.Create(ctx, tx, ...)
       └─→ Repository.Save(ctx, tx, ...)  // Uses tx
   └─→ return error  ✗

3. TxInterceptor.AfterCompletion
   └─→ err != nil
   └─→ tx.Rollback()  ✓
```

## Passing the Transaction to the Handler

`ExecutionContext` and the handler's standard `context.Context` have different roles. The interceptor stores the transaction in the request-scoped execution context. A write handler receives `spine.Ctx`, retrieves the transaction, and explicitly passes it to the service.

```go
// controller/user_controller.go
import (
    "context"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
    spineCtx spine.Ctx,
) (httpx.Response[dto.CreateUserResponse], error) {
    v, exists := spineCtx.Get("tx")
    if !exists {
        return httpx.Response[dto.CreateUserResponse]{},
            httperr.InternalServerError("transaction does not exist")
    }

    tx, ok := v.(bun.IDB)
    if !ok {
        return httpx.Response[dto.CreateUserResponse]{},
            httperr.InternalServerError("invalid transaction type")
    }

    user, err := c.userService.Create(ctx, tx, req.Name, req.Email)
    if err != nil {
        return httpx.Response[dto.CreateUserResponse]{}, err
    }
    return httpx.Response[dto.CreateUserResponse]{Body: user}, nil
}
```

Do not put the transaction into a separate `context.WithValue`. `spine.Ctx` exposes the same request-scoped values that the interceptor writes through `ExecutionContext.Set`.

## Using Transactions in Service and Repository

Pass both values explicitly: `context.Context` carries cancellation and deadlines, while `bun.IDB` selects the transaction used for the query.

```go
// service/user_service.go
func (s *UserService) Create(
    ctx context.Context,
    tx bun.IDB,
    name string,
    email string,
) (dto.CreateUserResponse, error) {
    user := &entity.User{Name: name, Email: email}
    if err := s.repo.Save(ctx, tx, user); err != nil {
        return dto.CreateUserResponse{}, err
    }
    return dto.CreateUserResponse{
        ID: int(user.ID), Name: user.Name, Email: user.Email,
    }, nil
}
```

```go
// repository/user_repository.go
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}

func (r *UserRepository) Save(
    ctx context.Context,
    tx bun.IDB,
    user *entity.User,
) error {
    _, err := tx.NewInsert().Model(user).Exec(ctx)
    return err
}
```

The injected `r.db` remains useful for non-transactional reads. Write methods that must participate in the request transaction use the explicitly supplied `tx`.

## Using Multiple Repositories

Using multiple repositories within a single transaction.

### Service Example

```go
// service/order_service.go
type OrderService struct {
    orderRepo *repository.OrderRepository
    userRepo  *repository.UserRepository
}

func NewOrderService(
    orderRepo *repository.OrderRepository,
    userRepo *repository.UserRepository,
) *OrderService {
    return &OrderService{
        orderRepo: orderRepo,
        userRepo:  userRepo,
    }
}

func (s *OrderService) CreateOrder(ctx context.Context, tx bun.IDB, userID int, items []Item) error {
    // 1. Find User
    user, err := s.userRepo.FindByID(ctx, userID)
    if err != nil {
        return err  // Rolled back
    }

    // 2. Create Order
    order := &entity.Order{UserID: user.ID, Items: items}
    if err := s.orderRepo.Save(ctx, tx, order); err != nil {
        return err  // Rolled back
    }

    // 3. Deduct User Points
    user.Points -= calculateTotal(items)
    if err := s.userRepo.Update(ctx, tx, user); err != nil {
        return err  // Rolled back
    }

    return nil  // All success → Commit
}
```

Every operation that receives this `tx` executes within the same transaction. A repository call that uses its base `db` instead is outside that transaction.

## Transaction Options

### Read-Only Transaction

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    
    // Read-only transaction
    tx, err := i.db.BeginTx(reqCtx, &sql.TxOptions{
        ReadOnly: true,
    })
    if err != nil {
        return err
    }
    
    ctx.Set("tx", tx)
    return nil
}
```

### Isolation Level

```go
import "database/sql"

tx, err := i.db.BeginTx(reqCtx, &sql.TxOptions{
    Isolation: sql.LevelSerializable,  // Serializable
})
```

| Isolation Level | Constant |
|----------|------|
| Read Uncommitted | `sql.LevelReadUncommitted` |
| Read Committed | `sql.LevelReadCommitted` |
| Repeatable Read | `sql.LevelRepeatableRead` |
| Serializable | `sql.LevelSerializable` |


## Optional Transaction

Transactions may not be needed for all requests.

### Method 1: Distinguish by Method Name

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    methodName := meta.Method.Name
    
    // Skip transaction for methods starting with Get
    if strings.HasPrefix(methodName, "Get") || strings.HasPrefix(methodName, "List") {
        return nil
    }
    
    // Start transaction
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return  // Skip if no transaction
    }
    
    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

### Method 2: Distinguish by HTTP Method

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // Skip transaction for GET requests
    if ctx.Method() == "GET" {
        return nil
    }
    
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    
    ctx.Set("tx", tx)
    return nil
}
```

## Error Logging

You can add logging upon transaction rollback.

```go
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }
    
    if err != nil {
        log.Printf("[TX] Rollback: %s %s - %v", ctx.Method(), ctx.Path(), err)
        _ = tx.Rollback()
    } else {
        log.Printf("[TX] Commit: %s %s", ctx.Method(), ctx.Path())
        _ = tx.Commit()
    }
}
```

## Complete Example

```go
// main.go
func main() {
    app := spine.New()

    app.Constructor(
        NewDB,
        interceptor.NewTxInterceptor,
        repository.NewUserRepository,
        repository.NewOrderRepository,
        service.NewUserService,
        service.NewOrderService,
        controller.NewUserController,
        controller.NewOrderController,
    )

    app.Interceptor(
        (*interceptor.TxInterceptor)(nil),
        &interceptor.LoggingInterceptor{},
    )

    routes.RegisterUserRoutes(app)
    routes.RegisterOrderRoutes(app)
    
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

```go
// interceptor/tx_interceptor.go
type TxInterceptor struct {
    db *bun.DB
}

func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }
    
    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

## Key Takeaways

| Concept | Description |
|------|------|
| **Interceptor-Based** | Start in PreHandle, End in AfterCompletion |
| **Auto Commit/Rollback** | Processed automatically based on error |
| **bun.IDB** | Common interface implemented by `*bun.DB` and `bun.Tx` |
| **Request Sharing** | Store with `ExecutionContext.Set`, retrieve with handler-injected `spine.Ctx.Get` |
| **Explicit Propagation** | Pass `context.Context` and `bun.IDB` through service/repository calls |


## Next Steps

- [Tutorial: Error Handling](/en/learn/tutorial/7-error-handling) — httperr usage
- [Reference: API](/en/reference/api/spine-app) — Spine API Docs
