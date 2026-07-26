# core.Interceptor

## 介面

Spine v0.5.1 的所有攔截器都必須實作四個方法：

```go
type Interceptor interface {
	PreHandle(ctx ExecutionContext, meta HandlerMeta) error
	PostHandle(ctx ExecutionContext, meta HandlerMeta)
	BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
	AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| 階段 | 語意 |
|---|---|
| `PreHandle` | 控制器前執行；回傳錯誤會中止後續執行 |
| `PostHandle` | 回傳值準備成功後執行；不回傳錯誤 |
| `BeforeResponse` | 回應寫出前執行；可提交/回滾交易，回傳錯誤會阻止成功回應 |
| `AfterCompletion` | 最後執行；只用於觀察和清理 |

只會為成功完成 `PreHandle` 的攔截器呼叫後續階段。路由與全域攔截器的完成階段以反向順序執行。v0.5.1 會在 `BeforeResponse` 之前完成 JSON 序列化、Cookie/狀態驗證和 `PostHandle`，因此準備錯誤也能觸發回滾。

## 交易模式

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, _ core.HandlerMeta) error {
	tx, err := i.db.BeginTx(ctx.Context(), nil)
	if err != nil {
		return err
	}
	ctx.Set("tx", tx)
	return nil
}

func (i *TxInterceptor) PostHandle(core.ExecutionContext, core.HandlerMeta) {}

func (i *TxInterceptor) BeforeResponse(
	ctx core.ExecutionContext,
	_ core.HandlerMeta,
	executionErr error,
) error {
	tx := mustTransaction(ctx)
	if executionErr != nil {
		return tx.Rollback()
	}
	return tx.Commit()
}

func (i *TxInterceptor) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error) {}
```

實體 socket 寫入或訊息發布無法與資料庫提交成為原子操作。跨系統一致性應使用 transactional outbox 與冪等鍵。

## 註冊與 WebSocket 握手

`app.Interceptor(...)` 預設作用於 HTTP 和 WebSocket；`app.InterceptorFor(...)` 可選擇範圍。保護 WebSocket 連線時，還應實作：

```go
type WebSocketHandshakeInterceptor interface {
	PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

連線容量槽位會先保留，`PreHandshake` 接著在 HTTP upgrade 前執行，因此待驗證握手也會計入容量。訊息級 `PreHandle` 仍會對每則訊息執行。

網站中的所有範例都以這四個方法作為完整介面。
