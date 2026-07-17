# 交易管理

在 Spine 中處理事務。

＃＃ 大綱

Spine 在基於攔截器的基礎上管理事務。

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

- 成功後→自動提交
- 如果發生錯誤→自動回滾

## TxInterceptor 實現

```go
// 攔截器/tx_interceptor.go
package interceptor

import (
    "errors"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct {
    db *bun.DB
}

// 建構函式——DB依賴注入
func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

// PreHandle — 開始交易
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    if reqCtx == nil {
        return errors.New("execution context has no request context")
    }

    // 開始交易
    tx, err := i.db.BeginTx(reqCtx, nil)
    if err != nil {
        return err
    }

    // 儲存到執行上下文
    ctx.Set("tx", tx)
    return nil
}

// PostHandle — 不執行任何操作
func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

// AfterCompletion — 提交或回滾
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }

    // 根據錯誤回滾/提交
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

＃＃ 登記

```go
// 主機程式
func main() {
    app := spine.New()

    // 1. 註冊一個建構函數
    app.Constructor(
        NewDB,
        interceptor.NewTxInterceptor,
        repository.NewUserRepository,
        service.NewUserService,
        controller.NewUserController,
    )

    // 2.註冊攔截器（見類型）
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

## bun.IDB 介面

`bun.IDB` 介面是在儲存庫中使用交易的關鍵。

＃＃＃ 問題

```go
// ❌ 如果只收到*bun.DB，則無法使用交易。
type UserRepository struct {
    db *bun.DB
}
```

＃＃＃ 解決

```go
// ✅ Bun.IDB 實作了 *bun.DB 和 *bun.Tx
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 包子.IDB 是什麼？

|類型 |實作|bun.IDB
|------|-------------|
| `*bun.DB` | `*bun.DB` ✅ |
| `*bun.Tx` | `*bun.Tx` ✅ |

您可以使用相同的方法（`NewSelect`、`NewInsert` 等）。

## 交易流程

### 關於成功

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ Service.Create
       └─→ Repository.Save  // 使用 tx
   └─→ return user, nil  ✓

3. TxInterceptor.AfterCompletion
   └─→ err == nil
   └─→ tx.Commit()  ✓
```

### 失敗時

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ Service.Create
       └─→ Repository.Save  // 使用 tx
   └─→ return error  ✗

3. TxInterceptor.AfterCompletion
   └─→ err != nil
   └─→ tx.Rollback()  ✓
```

## 使用儲存庫中的事務

在目前結構中，儲存庫在建立時注入 `bun.IDB` 。

```go
// 儲存庫/user_repository.go
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}

func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)
    return err
}
```

### 在交易上下文中使用

您可以建立一個輔助函數來檢索並使用攔截器儲存的交易。

```go
// db/context.go
package db

import (
    "context"
    
    "github.com/uptrace/bun"
)

type ctxKey string

const txKey ctxKey = "tx"

// 從上下文中取得交易
func GetTx(ctx context.Context) bun.IDB {
    if tx, ok := ctx.Value(txKey).(bun.IDB); ok {
        return tx
    }
    return nil
}

// 在上下文中保存事務
func WithTx(ctx context.Context, tx bun.IDB) context.Context {
    return context.WithValue(ctx, txKey, tx)
}
```

## 使用多個儲存庫

在一個事務中使用多個儲存庫時就是這種情況。

### 服務範例

```go
// 服務/order_service.go
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

func (s *OrderService) CreateOrder(ctx context.Context, userID int, items []Item) error {
    // 1、用戶查詢
    user, err := s.userRepo.FindByID(ctx, userID)
    if err != nil {
        return err  // 已回滚
    }

    // 2. 建立訂單
    order := &entity.Order{UserID: user.ID, Items: items}
    if err := s.orderRepo.Save(ctx, order); err != nil {
        return err  // 已回滚
    }

    // 3.用戶積分扣除
    user.Points -= calculateTotal(items)
    if err := s.userRepo.Update(ctx, user); err != nil {
        return err  // 已回滚
    }

    return nil  // 全部成功 → 提交
}
```

所有操作都在同一筆交易中運作。

## 交易選項

### 只讀事務

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    
    // 只讀事務
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

### 設定隔離級別

```go
import "database/sql"

tx, err := i.db.BeginTx(reqCtx, &sql.TxOptions{
    Isolation: sql.LevelSerializable,  // 可串行化
})
```

|隔離等級|常數|
|----------|------|
|已閱讀未提交 | `sql.LevelReadUncommitted` | `sql.LevelReadUncommitted`
|閱讀提交 | `sql.LevelReadCommitted` | `sql.LevelReadCommitted`
|可重複讀取| `sql.LevelRepeatableRead` | `sql.LevelRepeatableRead`
|可串列化| `sql.LevelSerializable` | `sql.LevelSerializable`

## 可選交易

並非所有請求都需要事務。

### 方法一：以方法名稱分隔

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    methodName := meta.Method.Name
    
    // 以 Get 開頭的方法會跳過交易。
    if strings.HasPrefix(methodName, "Get") || strings.HasPrefix(methodName, "List") {
        return nil
    }
    
    // 開始交易
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
    
    tx := v.(*bun.Tx)
    if err != nil {
        tx.Rollback()
    } else {
        tx.Commit()
    }
}
```

### 方法二：透過HTTP方式分隔

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // GET 請求跳過事務
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

## 錯誤記錄

您可以在回滾交易時新增日誌記錄。

```go
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx := v.(*bun.Tx)
    
    if err != nil {
        log.Printf("[TX] Rollback: %s %s - %v", ctx.Method(), ctx.Path(), err)
        _ = tx.Rollback()
    } else {
        log.Printf("[TX] Commit: %s %s", ctx.Method(), ctx.Path())
        _ = tx.Commit()
    }
}
```

## 完整範例

```go
// 主機程式
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
// 攔截器/tx_interceptor.go
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
    
    tx := v.(*bun.Tx)
    if err != nil {
        tx.Rollback()
    } else {
        tx.Commit()
    }
}
```

## 主要摘要

|概念|描述 |
|------|------|
| **基於攔截器** |在 PreHandle 中開始，在 AfterCompletion 中結束 |
| **自動提交/回滾** |根據是否有錯誤自動處理|
| **bun.IDB** |接受 DB 和 Tx 的介面 |
| **上下文共享** |傳遞到 `ctx.Set("tx", tx)` |

## 後續步驟

- [教學：錯誤處理](/zh-Hant/learn/tutorial/7-error-handling) — 如何使用 httperr
- [參考：API](/zh-Hant/reference/api/spine-app) — Spine API 文檔
