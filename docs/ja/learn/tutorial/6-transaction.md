# トランザクション管理
Spineでトランザクションを処理します。
## 概要
Spineは**インターセプタベース**でトランザクションを管理します。
```
Request
   │
   ├─→ TxInterceptor.PreHandle      // トランザクション開始
   │
   ├─→ Controller → Service → Repository
   │
   └─→ TxInterceptor.AfterCompletion // コミットまたはロールバック
   
Response
```

- 成功時→自動コミット
- エラー時→自動ロールバック
## TxInterceptorの実装

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

// コンストラクタ — DB 依存性注入
func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

// PreHandle — トランザクション開始
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    if reqCtx == nil {
        return errors.New("execution context has no request context")
    }

    // トランザクション開始
    tx, err := i.db.BeginTx(reqCtx, nil)
    if err != nil {
        return err
    }

    // ExecutionContextに保存
    ctx.Set("tx", tx)
    return nil
}

// PostHandle — 何もしない
func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

// AfterCompletion — コミットまたはロールバック
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }

    // エラーに応じてロールバックまたはコミット
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

## 登録

```go
// main.go
func main() {
    app := spine.New()

    // 1. コンストラクタ登録
    app.Constructor(
        NewDB,
        interceptor.NewTxInterceptor,
        repository.NewUserRepository,
        service.NewUserService,
        controller.NewUserController,
    )

    // 2. インターセプタを登録（型参照）
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

## bun.IDBインタフェース
トランザクションをリポジトリで使用するには、`bun.IDB`インターフェースが重要です。
### 問題

```go
// ❌ *bun.DBだけを受け取るとトランザクションを使用できない
type UserRepository struct {
    db *bun.DB
}
```

### 解決

```go
// ✅ bun.IDBは*bun.DBと*bun.Txの両方が実装
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### bun.IDBとは？
| タイプ | bun.IDBの実装 |
|--------|----------------|
| `*bun.DB` | ✅ |
| `*bun.Tx` | ✅ |

同じメソッド（`NewSelect`、`NewInsert`など）を使用できます。

## トランザクションフロー
### 成功時
```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ Service.Create
       └─→ Repository.Save  // txを使用
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
       └─→ Repository.Save  // txを使用
   └─→ return error  ✗

3. TxInterceptor.AfterCompletion
   └─→ err != nil
   └─→ tx.Rollback()  ✓
```

## Repositoryでトランザクションを使用する
現在の構造では、リポジトリは生成時に`bun.IDB`を注入されます。

```go
// repository/user_repository.go
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

### トランザクションコンテキストでの使用
インターセプタによって保存されたトランザクションを取得して使用するヘルパー関数を作成できます。

```go
// db/context.go
package db

import (
    "context"
    
    "github.com/uptrace/bun"
)

type ctxKey string

const txKey ctxKey = "tx"

// コンテキストからトランザクションを取得
func GetTx(ctx context.Context) bun.IDB {
    if tx, ok := ctx.Value(txKey).(bun.IDB); ok {
        return tx
    }
    return nil
}

// コンテキストにトランザクションを保存
func WithTx(ctx context.Context, tx bun.IDB) context.Context {
    return context.WithValue(ctx, txKey, tx)
}
```

## 複数のリポジトリを使用
1つのトランザクションで複数のリポジトリを使用する場合。
### Serviceの例

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

func (s *OrderService) CreateOrder(ctx context.Context, userID int, items []Item) error {
    // 1. ユーザー 参照
    user, err := s.userRepo.FindByID(ctx, userID)
    if err != nil {
        return err  // ロールバック
    }

    // 2. 注文を作成
    order := &entity.Order{UserID: user.ID, Items: items}
    if err := s.orderRepo.Save(ctx, order); err != nil {
        return err  // ロールバック
    }

    // 3. ユーザーのポイントを減算
    user.Points -= calculateTotal(items)
    if err := s.userRepo.Update(ctx, user); err != nil {
        return err  // ロールバック
    }

    return nil  // すべて成功 → コミット
}
```

すべてのジョブが同じトランザクション内で実行されます。
## トランザクションオプション
### 読み取り専用トランザクション

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    
    // 読み取り専用トランザクション
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

### 分離レベルの設定

```go
import "database/sql"

tx, err := i.db.BeginTx(reqCtx, &sql.TxOptions{
    Isolation: sql.LevelSerializable,  // シリアライズ可能
})
```

| 分離レベル | 定数 |
|------------|------|
| Read Uncommitted | `sql.LevelReadUncommitted` |
| Read Committed | `sql.LevelReadCommitted` |
| Repeatable Read | `sql.LevelRepeatableRead` |
| Serializable | `sql.LevelSerializable` |


## オプションのトランザクション
すべての要求にトランザクションが必要ない場合があります。
### 方法 1: メソッド名で区切る

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    methodName := meta.Method.Name
    
    // Getで始まるメソッドはトランザクションをスキップ
    if strings.HasPrefix(methodName, "Get") || strings.HasPrefix(methodName, "List") {
        return nil
    }
    
    // トランザクション開始
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
        return  // トランザクションがなければスキップ
    }
    
    tx := v.(*bun.Tx)
    if err != nil {
        tx.Rollback()
    } else {
        tx.Commit()
    }
}
```

### 方法 2: HTTP メソッドで区切る

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // GETリクエストはトランザクションをスキップ
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

## エラーロギング
トランザクションのロールバック時にロギングを追加できます。

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

## 完全な例

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
    
    tx := v.(*bun.Tx)
    if err != nil {
        tx.Rollback()
    } else {
        tx.Commit()
    }
}
```

## コアクリーンアップ
| コンセプト | 説明 |
|------------|------|
| **インターセプターベース** | PreHandleで開始、AfterCompletionで終了|
| **自動コミット/ロールバック** |エラーかどうかに応じて自動処理
| **bun.IDB** | DBとTxの両方に対応するインターフェース|
| **コンテキスト共有** | `ctx.Set("tx", tx)`に転送|

## 次のステップ
- [チュートリアル: エラー処理](/ja/learn/tutorial/7-error-handling) — httperr の使い方
- [リファレンス: API](/ja/reference/api/spine-app) — Spine API ドキュメント
