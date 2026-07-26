# 交易管理

在 Spine v0.5.1 中，交易應在 `PreHandle` 開始，在 `BeforeResponse` 提交或回滾。不要在 `AfterCompletion` 提交：該階段發生在回應處理之後，只適合清理和觀察。

## 生命週期

```text
PreHandle          開始交易
Controller         執行業務邏輯
Prepare response   序列化並驗證 Cookie/狀態
PostHandle         成功後處理
BeforeResponse     依 executionErr 提交或回滾
Flush response     寫入真實 HTTP writer
AfterCompletion    日誌與清理
```

v0.5.1 會在 `BeforeResponse` 前完成回應準備，因此 JSON 序列化、非法 Cookie 或狀態碼錯誤都能使交易回滾。

## 實作 `TxInterceptor`

```go
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
	tx, err := i.db.BeginTx(ctx.Context(), nil)
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
		return errors.New("transaction type is invalid")
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
) {}
```

## 相依性注入與註冊

```go
app.Constructor(NewDB, interceptor.NewTxInterceptor)
app.InterceptorFor(
	boot.InterceptorHTTP,
	(*interceptor.TxInterceptor)(nil),
)
```

交易攔截器通常只應作用於 HTTP。`app.Interceptor` 同時涵蓋 WebSocket 訊息，可能錯誤地為每則訊息開啟資料庫交易，因此這裡明確使用 `InterceptorHTTP`。

## 在控制器中讀取交易

```go
func (c *UserController) Create(
	ctx context.Context,
	controllerCtx core.ControllerContext,
	req *CreateUserRequest,
) (httpx.Response[User], error) {
	value, ok := controllerCtx.Get("tx")
	if !ok {
		return httpx.Response[User]{}, errors.New("transaction is missing")
	}
	tx, ok := value.(bun.IDB)
	if !ok {
		return httpx.Response[User]{}, errors.New("transaction type is invalid")
	}

	user, err := c.service.Create(ctx, tx, req)
	return httpx.Response[User]{Body: user}, err
}
```

儲存庫參數使用 `bun.IDB`，即可接受 `*bun.DB` 或 `bun.Tx`。查詢和更新應明確使用同一個請求交易。

## 外部事件

Spine 會在回應可序列化且 Cookie/狀態有效後執行領域事件後處理，但訊息發布、資料庫提交和最終 socket 寫入仍不能原子完成。必須可靠地綁定資料庫變更與外部事件時，請採用 transactional outbox；消費者還應使用冪等鍵。

`AfterCompletion` 僅用於清理和觀察；交易提交或回滾必須在 `BeforeResponse` 中完成。
