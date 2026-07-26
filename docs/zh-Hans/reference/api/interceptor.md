# core.Interceptor

## 接口

Spine v0.5.1 的所有拦截器都必须实现四个方法：

```go
type Interceptor interface {
	PreHandle(ctx ExecutionContext, meta HandlerMeta) error
	PostHandle(ctx ExecutionContext, meta HandlerMeta)
	BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
	AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| 阶段 | 语义 |
|---|---|
| `PreHandle` | 控制器前执行；返回错误会中止后续执行 |
| `PostHandle` | 返回值准备成功后执行；无返回错误 |
| `BeforeResponse` | 响应写出前执行；可提交/回滚事务，返回错误会阻止成功响应 |
| `AfterCompletion` | 最后执行；只用于观察和清理 |

只会为成功完成 `PreHandle` 的拦截器调用后续阶段。路由与全局拦截器的完成阶段按逆序执行。v0.5.1 会在 `BeforeResponse` 之前完成 JSON 序列化、Cookie/状态校验和 `PostHandle`，因此准备错误也能触发回滚。

## 事务模式

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

物理套接字写入或消息发布无法与数据库提交成为原子操作。跨系统一致性应使用 transactional outbox 与幂等键。

## 注册与 WebSocket 握手

`app.Interceptor(...)` 默认作用于 HTTP 和 WebSocket；`app.InterceptorFor(...)` 可选择范围。保护 WebSocket 连接时，还应实现：

```go
type WebSocketHandshakeInterceptor interface {
	PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

连接容量槽位先被保留，`PreHandshake` 随后在 HTTP upgrade 前执行，所以待认证握手也会计入容量。消息级 `PreHandle` 仍会对每条消息运行。

站点中的所有示例均以这四个方法为完整接口。
