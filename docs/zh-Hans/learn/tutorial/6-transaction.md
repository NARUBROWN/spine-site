# 交易管理

在 Spine 中处理事务。

## 大纲

Spine 在基于拦截器的基础上管理事务。

```
Request
   │
   ├─→ TxInterceptor.PreHandle      // 开始事务
   │
   ├─→ Controller → Service → Repository
   │
   └─→ TxInterceptor.AfterCompletion // 提交或回滚

Response
```

- 成功后→自动提交
- 如果出现错误→自动回滚

## TxInterceptor 实现

```go
// 拦截器/tx_interceptor.go
package interceptor

import (
    "errors"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct {
    db *bun.DB
}

// 构造函数——DB依赖注入
func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

// PreHandle — 开始交易
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    if reqCtx == nil {
        return errors.New("execution context has no request context")
    }

    // 开始交易
    tx, err := i.db.BeginTx(reqCtx, nil)
    if err != nil {
        return err
    }

    // 保存到执行上下文
    ctx.Set("tx", tx)
    return nil
}

// PostHandle — 不执行任何操作
func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

// AfterCompletion — 提交或回滚
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }

    // 根据错误回滚/提交
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

## 登记

```go
// 主程序
func main() {
    app := spine.New()

    // 1. 注册一个构造函数
    app.Constructor(
        NewDB,
        interceptor.NewTxInterceptor,
        repository.NewUserRepository,
        service.NewUserService,
        controller.NewUserController,
    )

    // 2.注册拦截器（见类型）
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

## bun.IDB 接口

`bun.IDB` 接口是在存储库中使用事务的关键。

### 问题

```go
// ❌ 如果只收到*bun.DB，则无法使用交易。
type UserRepository struct {
    db *bun.DB
}
```

### 解决

```go
// ✅ bun.IDB 由 *bun.DB 和 bun.Tx 实现
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 包子.IDB 是什么？

|类型 |实施|bun.IDB
|------|-------------|
| `*bun.DB` | `*bun.DB` ✅ |
| `bun.Tx` | ✅ |

您可以使用相同的方法（`NewSelect`、`NewInsert` 等）。

## 交易流程

### 关于成功

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ spine.Ctx.Get("tx")
   └─→ Service.Create(ctx, tx, ...)
       └─→ Repository.Save(ctx, tx, ...)  // 使用 tx
   └─→ return user, nil  ✓

3. TxInterceptor.AfterCompletion
   └─→ err == nil
   └─→ tx.Commit()  ✓
```

### 失败时

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ spine.Ctx.Get("tx")
   └─→ Service.Create(ctx, tx, ...)
       └─→ Repository.Save(ctx, tx, ...)  // 使用 tx
   └─→ return error  ✗

3. TxInterceptor.AfterCompletion
   └─→ err != nil
   └─→ tx.Rollback()  ✓
```

## 使用存储库中的事务

查询可以使用创建存储库时注入的 DB。更新操作则通过 `bun.IDB` 参数显式接收当前请求的事务。

```go
// 存储库/user_repository.go
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}

func (r *UserRepository) Save(ctx context.Context, tx bun.IDB, user *entity.User) error {
    _, err := tx.NewInsert().
        Model(user).
        Exec(ctx)
    return err
}
```

### 从 `spine.Ctx` 获取事务

将 `spine.Ctx` 注入控制器，读取拦截器保存的事务，然后将 `bun.IDB` 显式传递给服务和存储库。

```go
// controller/user_controller.go
func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
    spineCtx spine.Ctx,
) (httpx.Response[dto.CreateUserResponse], error) {
    v, exists := spineCtx.Get("tx")
    if !exists {
        return httpx.Response[dto.CreateUserResponse]{},
            httperr.InternalServerError("事务不存在。")
    }

    tx, ok := v.(bun.IDB)
    if !ok {
        return httpx.Response[dto.CreateUserResponse]{},
            httperr.InternalServerError("事务类型不正确。")
    }

    user, err := c.userService.Create(ctx, tx, req.Name, req.Email)
    if err != nil {
        return httpx.Response[dto.CreateUserResponse]{}, err
    }
    return httpx.Response[dto.CreateUserResponse]{Body: user}, nil
}
```

## 使用多个存储库

在一个事务中使用多个存储库时就是这种情况。

### 服务示例

```go
// 服务/order_service.go
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
    // 1、用户查询
    user, err := s.userRepo.FindByID(ctx, userID)
    if err != nil {
        return err  // 已回滚
    }

    // 2. 创建订单
    order := &entity.Order{UserID: user.ID, Items: items}
    if err := s.orderRepo.Save(ctx, tx, order); err != nil {
        return err  // 已回滚
    }

    // 3、用户积分扣除
    user.Points -= calculateTotal(items)
    if err := s.userRepo.Update(ctx, tx, user); err != nil {
        return err  // 已回滚
    }

    return nil  // 全部成功 → 提交
}
```

同一个 `tx` 会传给每个更新方法，因此所有更新都在同一事务中运行。

## 交易选项

### 只读事务

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()

    // 只读事务
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

### 设置隔离级别

```go
import "database/sql"

tx, err := i.db.BeginTx(reqCtx, &sql.TxOptions{
    Isolation: sql.LevelSerializable,  // 可串行化
})
```

|隔离级别|常数|
|----------|------|
|阅读未提交 | `sql.LevelReadUncommitted` | `sql.LevelReadUncommitted`
|阅读提交 | `sql.LevelReadCommitted` | `sql.LevelReadCommitted`
|可重复读取| `sql.LevelRepeatableRead` | `sql.LevelRepeatableRead`
|可串行化| `sql.LevelSerializable` | `sql.LevelSerializable`

## 可选交易

并非所有请求都需要事务。

### 方法一：按方法名分隔

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    methodName := meta.Method.Name

    // 以 Get 开头的方法会跳过事务。
    if strings.HasPrefix(methodName, "Get") || strings.HasPrefix(methodName, "List") {
        return nil
    }

    // 开始事务
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
        return  // 没有事务时跳过
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

### 方法二：通过HTTP方式分隔

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // GET 请求跳过事务
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

## 错误记录

您可以在回滚事务时添加日志记录。

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

## 完整示例

```go
// 主程序
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
// 拦截器/tx_interceptor.go
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

## 主要摘要

|概念|描述 |
|------|------|
| **基于拦截器** |在 PreHandle 中开始，在 AfterCompletion 中结束 |
| **自动提交/回滚** |根据是否有错误自动处理|
| **bun.IDB** |接受 DB 和 Tx 的接口 |
| **上下文共享** | 用 `ctx.Set("tx", tx)` 保存，用 `spine.Ctx.Get("tx")` 获取 |
| **显式传递** | 将 `bun.IDB` 从控制器传给服务和存储库 |

## 后续步骤

- [教程：错误处理](/zh-Hans/learn/tutorial/7-error-handling) — 如何使用 httperr
- [参考：API](/zh-Hans/reference/api/spine-app) — Spine API 文档
