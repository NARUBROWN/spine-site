# core.Interceptor

Controller実行の前後で、logging、認証、CORS、transactionなどの横断的関心事を処理するインターフェースです。Spine v0.5.1は4段階のlifecycleを使用します。

```go
import "github.com/NARUBROWN/spine/core"

type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

## Lifecycle

### PreHandle

Controller呼び出し前に登録順で実行されます。`nil`なら続行し、通常のエラーなら失敗、`core.ErrAbortPipeline`ならControllerを呼び出さず正常に中断します。グローバルinterceptorはrouting前に実行されるため、空の`HandlerMeta{}`を受け取ります。

```go
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("認証が必要です")
    }
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("無効なトークンです")
    }
    ctx.Set("auth.user", user)
    return nil
}
```

### PostHandle

戻り値の準備とpost-execution hookの後に逆順で実行されます。このメソッドはエラーを返さないため、loggingや成功後の観測処理に適しています。

```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s prepared", ctx.Method(), ctx.Path())
}
```

### BeforeResponse

応答を実際のHTTP writerへflushする前に逆順で実行されます。`executionErr`にはController、戻り値の準備、post-execution hookで発生した最終エラーが渡されます。このメソッドが返したエラーも最終エラーに結合されます。

request transactionのcommit/rollbackは`AfterCompletion`ではなく、この段階で処理してください。v0.5.1では直列化、Cookie、status検証の後に`BeforeResponse`が実行されるため、準備失敗を見てrollbackできます。

```go
func (i *TxInterceptor) BeforeResponse(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    executionErr error,
) error {
    tx, ok := transactionFrom(ctx)
    if !ok {
        return nil
    }
    if executionErr != nil {
        return tx.Rollback()
    }
    return tx.Commit()
}
```

### AfterCompletion

成功・失敗にかかわらず、応答処理後に逆順で呼び出されます。最終`err`を受け取り、logging、metric、resource cleanupに使用します。すでに応答が書き込まれた後なので、commit判断には使用しないでください。

```go
func (i *LoggingInterceptor) AfterCompletion(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    err error,
) {
    if err != nil {
        log.Printf("[ERR] %s %s: %v", ctx.Method(), ctx.Path(), err)
    }
}
```

## 登録とscope

`app.Interceptor`は`boot.InterceptorAll`の短縮形で、HTTPとWebSocket messageの両方に適用されます。特定のtransportだけを前提とする実装は`InterceptorFor`でscopeを指定してください。

```go
app.InterceptorFor(boot.InterceptorAll, auth)
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsRateLimiter)

app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

typed-nil pointerを登録するとcontainerからresolveされます。同じpointer instanceを複数scopeへ登録するとscopeを統合して1回実行します。同じ型の異なるpointerはそれぞれ実行し、同じ型のtyped-nil placeholderはcontainer singletonを共有します。値型も登録ごとに独立して実行します。

## WebSocket handshake

接続認証が必要なinterceptorは、任意の追加インターフェースも実装してください。

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

接続slotは`PreHandshake`より先に予約され、`PreHandshake`はHTTP upgradeより前に実行されます。そのため、未認証の待機中handshakeも`MaxConnections`に含まれます。従来の`PreHandle`は接続ごとではなくWebSocket messageごとに引き続き実行されます。

```go
func (i *AuthInterceptor) PreHandshake(
    ctx core.WebSocketHandshakeContext,
    meta core.HandlerMeta,
) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("missing credentials")
    }
    return i.verify(token)
}
```

## 実行順序

通常のHTTPフローは次のとおりです。

```text
Global.PreHandle → Router → ArgumentResolver → Route.PreHandle
→ Controller → 応答準備 → PostExecutionHook
→ Route.PostHandle → Global.PostHandle
→ Route.BeforeResponse → Global.BeforeResponse
→ 実際の応答をflush
→ Route.AfterCompletion → Global.AfterCompletion
```

各逆順段階では登録の逆順で呼び出します。`PreHandle`に成功したinterceptorだけが`BeforeResponse`の対象で、`AfterCompletion`はその要求に登録されたinterceptorのcleanupを常に実行します。

## 関連項目

- [実行pipeline](/ja/learn/core-concepts/pipeline)
- [transaction管理](/ja/learn/tutorial/6-transaction)
- [現在のリリース](/ja/community/changelog)
