# core.Interceptor

用于在控制器执行前后添加认证、日志、CORS 和事务处理的接口。在 Spine v0.5.1 中，分别实现前置处理、成功后处理、响应前处理和最终清理。

## 接口

```go
import "github.com/NARUBROWN/spine/core"

type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| 方法 | 调用时机 | 返回值 |
| --- | --- | --- |
| `PreHandle` | 控制器执行前。按注册顺序 | 返回 `nil` 时继续，返回错误时中断 |
| `PostHandle` | 控制器、响应准备和执行后钩子成功后。按注册的相反顺序 | 无 |
| `BeforeResponse` | 实际写入响应前。按相反顺序执行 `PreHandle` 成功的拦截器 | 错误会纳入最终执行错误 |
| `AfterCompletion` | 响应处理后。无论成功或失败，都按注册的相反顺序执行 | 无 |

## 生命周期和实现示例

以下示例中的 `auth`、`transactionFrom` 和事务实现由应用提供。必须实现全部四个方法的签名，才能注册为 `core.Interceptor`。

### PreHandle

在调用控制器前，按注册顺序执行。返回 `nil` 时进入下一阶段，返回一般错误时失败。返回 `core.ErrAbortPipeline` 时，不调用控制器并正常中止。

全局拦截器在路由前执行，因此收到空的 `HandlerMeta{}`。路由拦截器在路由和输入值解析后执行，并收到相应处理器的信息。

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

将控制器返回值准备为响应，且执行后钩子也成功后，按相反顺序执行。由于不能返回错误，适用于成功日志或观测处理。

```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s prepared", ctx.Method(), ctx.Path())
}
```

### BeforeResponse

在将响应写入实际传输层之前，按相反顺序执行。`executionErr` 包含前置处理、路由、输入值解析、控制器、响应准备和执行后钩子截至此时发生的错误。此前执行的 `BeforeResponse` 返回的错误也会合并并传递给下一个拦截器。

请在此阶段提交或回滚请求范围的事务。v0.5.1 会先进行响应序列化、Cookie 和状态码验证，因此响应准备失败时可以回滚。

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

无论成功或失败，都在响应处理后按相反顺序调用。接收最终的 `err`，用于记录日志、收集指标和清理资源。此阶段也可以检查响应发送结果。是否提交事务应在前一阶段就已决定。

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

## 注册和范围

`app.Interceptor` 等同于 `app.InterceptorFor(boot.InterceptorAll, ...)`。同时应用于 HTTP 请求和 WebSocket 消息，不应用于事件消费者。如果依赖特定传输方式，例如处理 HTTP 响应的 CORS，请指定范围。

| 范围 | 适用对象 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP 请求 |
| `boot.InterceptorWebSocket` | WebSocket 消息和可选的连接前处理 |
| `boot.InterceptorAll` | 两种范围 |

```go
app.InterceptorFor(boot.InterceptorAll, auth)
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsRateLimiter)

app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```

注册 `(*AuthInterceptor)(nil)` 这样的有类型 nil 指针时，会从容器中查找并使用该类型的实例。同一类型的 nil 指针使用容器中的共享实例。

将同一个指针作为全局拦截器注册到多个范围时，会合并范围并仅执行一次。同一类型的不同指针会分别执行。值类型也会按各个注册项分别执行。

## WebSocket 连接前处理

需要连接认证的拦截器除实现 `core.Interceptor` 外，还需实现以下可选接口。

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

先预留连接名额，再于 HTTP 升级前执行 `PreHandshake`。因此，等待认证的连接请求也计入 `MaxConnections`。`PreHandle` 持续针对每条 WebSocket 消息执行，而不是每个连接执行一次。请求头、查询参数和 Cookie 等通过 [`WebSocketHandshakeContext`](/zh-Hans/reference/api/execution-context#websocket-request-context) 读取。

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

## 执行顺序

正常的 HTTP 流程如下。

```text
Global.PreHandle → Router → ArgumentResolver → Route.PreHandle
→ 控制器 → 响应准备 → 执行后钩子
→ Route.PostHandle → Global.PostHandle
→ Route.BeforeResponse → Global.BeforeResponse
→ 实际写入响应
→ Route.AfterCompletion → Global.AfterCompletion
```

每个逆序阶段先执行路由拦截器，再执行全局拦截器。路由完成后的调用会收到解析出的 `HandlerMeta`。

## 约束和错误

- `BeforeResponse` 仅调用 `PreHandle` 返回 `nil` 的拦截器。返回错误或 `core.ErrAbortPipeline` 的拦截器不在此范围内。
- `AfterCompletion` 对全局拦截器和通过路由确定的路由拦截器执行。即使相应拦截器的 `PreHandle` 没有执行，也可能调用此方法，因此请在清理前检查资源是否存在。
- 路由拦截器的认证在输入值解析之后执行。如果需要在输入值解析前认证，请使用全局拦截器。
- 通过 `core.ErrAbortPipeline` 中止时，拦截器必须准备所需响应。控制器和后续成功处理阶段不会执行。
- 数据库提交后，实际响应发送仍可能失败。`BeforeResponse` 无法将数据库与网络传输合并为原子操作。

有关具体的提前终止和错误传播，请参阅 [v0.5.1 流水线实现](https://github.com/NARUBROWN/spine/blob/v0.5.1/internal/pipeline/pipeline.go)；有关连接前处理顺序，请参阅 [WebSocket 运行时实现](https://github.com/NARUBROWN/spine/blob/v0.5.1/internal/ws/runtime.go)。

## 参考

- [执行流水线](/zh-Hans/learn/core-concepts/pipeline)
- [事务管理](/zh-Hans/learn/tutorial/6-transaction)
- [当前版本](/zh-Hans/community/changelog)
