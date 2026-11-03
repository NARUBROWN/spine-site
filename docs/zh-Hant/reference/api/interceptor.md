# core.Interceptor

在控制器執行前後加入驗證、日誌記錄、CORS 與交易處理的介面。在 Spine v0.6.5 中，分別實作前置處理、成功後處理、回應前處理與最終清理。

## 介面

```go
import "github.com/NARUBROWN/spine/core"

type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| 方法 | 呼叫時機 | 回傳值 |
| --- | --- | --- |
| `PreHandle` | 控制器執行前，依註冊順序 | `nil` 表示繼續，錯誤則中止 |
| `PostHandle` | 控制器、回應準備與執行後掛鉤皆成功後，依註冊的反向順序 | 無 |
| `BeforeResponse` | 實際寫入回應前，反向執行 `PreHandle` 成功的攔截器 | 若有錯誤，會納入最終執行錯誤 |
| `AfterCompletion` | 回應處理後，無論成功或失敗皆依註冊的反向順序 | 無 |

## 生命週期與實作範例

以下範例中的 `auth`、`transactionFrom` 與交易實作由應用程式提供。必須實作全部四個方法的簽章，才能註冊為 `core.Interceptor`。

### PreHandle

在呼叫控制器前，依註冊順序執行。回傳 `nil` 時繼續下一階段，回傳一般錯誤時則失敗。若回傳 `core.ErrAbortPipeline`，會正常中止，不呼叫控制器。

全域攔截器在路由比對前執行，因此收到空的 `HandlerMeta{}`。路由攔截器在路由比對與輸入值解析後執行，會收到對應處理器的資訊。

```go
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("인증이 필요합니다")
    }
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("유효하지 않은 토큰입니다")
    }
    ctx.Set("auth.user", user)
    return nil
}
```

### PostHandle

將控制器的回傳值準備為回應，且執行後掛鉤也成功後，依反向順序執行。此方法無法回傳錯誤，適合用於成功日誌或觀測處理。

```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s prepared", ctx.Method(), ctx.Path())
}
```

### BeforeResponse

在將回應寫入實際傳輸層前，依反向順序執行。`executionErr` 會收到前置處理、路由比對、輸入值解析、控制器、回應準備與執行後掛鉤截至此時發生的錯誤。先前執行的 `BeforeResponse` 所回傳的錯誤也會合併，並傳給下一個攔截器。

請在此階段提交或回滾請求範圍的交易。v0.6.5 會先進行回應序列化、Cookie 與狀態碼驗證，因此回應準備失敗時可以回滾。

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

無論成功或失敗，皆在回應處理後依反向順序呼叫。接收最終的 `err`，用於記錄日誌、收集指標與清理資源。也可在此階段確認回應傳送結果。是否提交交易應已在前一階段決定。

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

## 註冊與範圍

`app.Interceptor` 等同於 `app.InterceptorFor(boot.InterceptorAll, ...)`。同時套用至 HTTP 請求與 WebSocket 訊息，不套用至事件消費者。若像處理 HTTP 回應的 CORS 一樣依賴特定傳輸方式，請指定範圍。

| 範圍 | 套用對象 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP 請求 |
| `boot.InterceptorWebSocket` | WebSocket 訊息與選用的連線前處理 |
| `boot.InterceptorAll` | 以上兩個範圍 |

```go
app.InterceptorFor(boot.InterceptorAll, auth)
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsRateLimiter)

app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

若註冊 `(*AuthInterceptor)(nil)` 這類具有型別的 nil 指標，會從容器取得該型別的實例。相同型別的 nil 指標會使用容器的共用實例。

若在全域攔截器中，將同一個指標註冊至多個範圍，會合併範圍並只執行一次。相同型別的不同指標會各自執行。值型別也會依每個註冊項目各自執行。

## WebSocket 連線前處理

需要連線驗證的攔截器，除了 `core.Interceptor`，還須實作以下選用介面。

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

先預留連線名額，再於 HTTP 升級前執行 `PreHandshake`。因此，等待驗證的連線請求也計入 `MaxConnections`。`PreHandle` 仍會在每則 WebSocket 訊息執行，而非只在各連線執行。請求的標頭、查詢參數與 Cookie 等資訊，可透過 [`WebSocketHandshakeContext`](/zh-Hant/reference/api/execution-context#websocket-request-context) 讀取。

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

## 執行順序

正常的 HTTP 流程如下。

```text
Global.PreHandle → Router → ArgumentResolver → Route.PreHandle
→ 控制器 → 回應準備 → 執行後掛鉤
→ Route.PostHandle → Global.PostHandle
→ Route.BeforeResponse → Global.BeforeResponse
→ 實際寫入回應
→ Route.AfterCompletion → Global.AfterCompletion
```

每個反向階段都先執行路由攔截器，再執行全域攔截器。路由比對完成後的呼叫會收到解析後的 `HandlerMeta`。

## 限制與錯誤

- `BeforeResponse` 只會呼叫 `PreHandle` 回傳 `nil` 的攔截器。不包含回傳錯誤或 `core.ErrAbortPipeline` 的攔截器。
- `AfterCompletion` 會對全域攔截器及路由比對確認的路由攔截器執行。即使該攔截器的 `PreHandle` 未執行，也可能被呼叫，因此請先確認資源存在再清理。
- 路由攔截器的驗證在輸入值解析後執行。若須在解析輸入值前驗證，請使用全域攔截器。
- 透過 `core.ErrAbortPipeline` 中止時，攔截器必須準備所需的回應。控制器與後續的成功處理階段不會執行。
- DB 提交後，實際回應傳送仍可能失敗。`BeforeResponse` 不會將 DB 與網路傳輸結合為原子操作。

具體的提早結束與錯誤傳遞行為，請參閱 [v0.6.5 管線實作](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/pipeline/pipeline.go)；連線前處理順序請參閱 [WebSocket 執行階段實作](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/ws/runtime.go)。

## 參考

- [執行管線](/zh-Hant/learn/core-concepts/pipeline)
- [交易管理](/zh-Hant/learn/tutorial/6-transaction)
- [目前版本](/zh-Hant/community/changelog)
