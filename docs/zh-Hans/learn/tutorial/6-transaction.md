# 事务管理

在 Spine v0.5.1 中，事务应在 `PreHandle` 开始，在 `BeforeResponse` 提交或回滚。不要在 `AfterCompletion` 提交：该阶段发生在响应处理之后，只适合清理和观察。

## 生命周期

```text
PreHandle          开始事务
Controller         执行业务逻辑
Prepare response   序列化并校验 Cookie/状态
PostHandle         成功后处理
BeforeResponse     根据 executionErr 提交或回滚
Flush response     写入真实 HTTP writer
AfterCompletion    日志与清理
```

v0.5.1 会在 `BeforeResponse` 前完成响应准备，因此 JSON 序列化、非法 Cookie 或状态码错误都能使事务回滚。

## 实现 `TxInterceptor`

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

## 依赖注入与注册

```go
app.Constructor(NewDB, interceptor.NewTxInterceptor)
app.InterceptorFor(
	boot.InterceptorHTTP,
	(*interceptor.TxInterceptor)(nil),
)
```

事务拦截器通常只应作用于 HTTP。`app.Interceptor` 同时覆盖 WebSocket 消息，可能错误地为每条消息开启数据库事务，因此这里显式使用 `InterceptorHTTP`。

## 在控制器中读取事务

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

存储库参数使用 `bun.IDB`，即可接受 `*bun.DB` 或 `bun.Tx`。查询和更新应显式使用同一个请求事务。

## 外部事件

Spine 会在响应可序列化且 Cookie/状态有效后运行领域事件后处理，但消息发布、数据库提交和最终 socket 写入仍不能原子完成。必须可靠地把数据库变更与外部事件绑定时，请采用 transactional outbox；消费者还应使用幂等键。

`AfterCompletion` 仅用于清理和观察；事务提交或回滚必须在 `BeforeResponse` 中完成。
