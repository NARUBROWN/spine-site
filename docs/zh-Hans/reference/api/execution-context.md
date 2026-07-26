# core 执行上下文

Spine 按协议和使用位置拆分上下文接口。不要把所有传输都视为 `ExecutionContext`：该接口是 HTTP 管道与路由使用的可变上下文；消费者和 WebSocket 还提供各自的专用视图。

## `ExecutionContext`

```go
type ExecutionContext interface {
	Context() context.Context
	EventBus() EventBus
	Method() string
	Path() string
	Params() map[string]string
	Header(name string) string
	PathKeys() []string
	Queries() map[string][]string
	Set(key string, value any)
	Get(key string) (any, bool)
}
```

拦截器和内部解析器可以读写执行范围值。控制器如需读取拦截器保存的数据，应依赖只读的 `core.ControllerContext`，而不是依赖整个 `ExecutionContext`。

## 协议专用接口

- `HttpRequestContext`：header、path/query 参数、正文绑定和 multipart 表单。
- `ConsumerRequestContext`：事件名称与二进制 payload。
- `WebSocketContext`：连接 ID、消息类型与 payload，并扩展 `ExecutionContext`。
- `WebSocketRequestContext`：upgrade 请求中保存的不可变 path、header、query、cookie、远端地址、host 与 request URI。
- `WebSocketHandshakeContext`：`PreHandshake` 使用的 upgrade 前请求视图。
- `WebSocketMessageContext`：同时组合消息上下文与原始握手请求快照。

```go
func (i *AuthInterceptor) PreHandshake(
	ctx core.WebSocketHandshakeContext,
	_ core.HandlerMeta,
) error {
	token := ctx.Header("Authorization")
	if token == "" {
		return httperr.Unauthorized("missing credentials")
	}
	return nil
}
```

握手快照不可变，适合在连接建立前认证，也可在消息处理阶段通过 `WebSocketMessageContext` 读取。`PreHandshake` 在连接槽位保留之后、HTTP upgrade 之前执行。

## 类型安全

解析器应先检查所需的专用接口，不支持时返回错误，不要假定每种协议都具备 HTTP 方法。v0.5.1 对命名 `string`/`[]byte` 和扩展的 `ControllerContext` 类型使用安全的 assignability/convertibility 规则，避免反射 panic。
