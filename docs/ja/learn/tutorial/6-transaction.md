# Transaction管理

Spine v0.5.1では、interceptorの`PreHandle`でtransactionを開始し、`BeforeResponse`でcommitまたはrollbackします。`AfterCompletion`は応答後のcleanupにのみ使用します。

```text
PreHandle: transaction開始
→ Controller → 戻り値の直列化・Cookie・status検証 → PostHandle
→ BeforeResponse: エラーならrollback、成功ならcommit
→ 実際のHTTP応答をflush
→ AfterCompletion: logging・cleanup
```

この順序により、Controllerが成功してもJSON直列化やCookie検証が失敗した場合はcommitされません。

## TxInterceptorの実装

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

commitまたはrollbackのエラーは必ず返してください。無視すると応答が成功として扱われる可能性があります。

## 登録scope

HTTP request transactionの場合はHTTP scopeを明示してください。`app.Interceptor(...)`はHTTPだけでなくWebSocket messageにも適用されます。

```go
app.Constructor(NewDB, NewTxInterceptor)
app.InterceptorFor(
    boot.InterceptorHTTP,
    (*TxInterceptor)(nil),
)
```

route単位のtransactionには`route.WithInterceptors((*TxInterceptor)(nil))`を使用します。typed-nilはcontainer singletonとしてresolveされます。

## Repositoryへのtransactionの受け渡し

`*bun.DB`と`bun.Tx`が共通に実装する`bun.IDB`を使用します。

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

Controllerは`ControllerContext`からtransactionを取得し、serviceとrepositoryへ明示的に渡します。

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

## 任意のtransaction

読み取りrequestを除外する場合は、`PreHandle`と`BeforeResponse`の両方でtransactionの有無を処理します。

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "GET" {
        return nil
    }
    // transactionを開始してctx.Set("tx", tx)
    return nil
}
```

## 原子性の境界

`BeforeResponse`でのDB commitは、実際のsocket writeやbroker publishと単一の原子的transactionにはなりません。event publish後のcommit失敗まで一貫した結果として保証する必要がある場合は、transactional outboxと冪等性キーを使用してください。

## まとめ

|段階|役割|
|---|---|
| `PreHandle` | transaction開始とcontextへの保存 |
| `BeforeResponse` |準備段階のエラーを含めてrollback/commitし、エラーを返す|
| `AfterCompletion` |応答後のloggingとcleanup|
| `bun.IDB` |DBとtransactionを同じ契約でrepositoryへ渡す|

- [Interceptor API](/ja/reference/api/interceptor)
- [現在のリリース](/ja/community/changelog)
