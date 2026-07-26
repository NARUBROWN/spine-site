# core 執行上下文

Spine 依協定和使用位置拆分上下文介面。不要把所有傳輸都視為 `ExecutionContext`：此介面是 HTTP 管線與路由使用的可變上下文；消費者和 WebSocket 還提供各自的專用檢視。

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

攔截器和內部解析器可以讀寫執行範圍值。控制器若要讀取攔截器儲存的資料，應依賴唯讀的 `core.ControllerContext`，而不是依賴整個 `ExecutionContext`。

## 協定專用介面

- `HttpRequestContext`：header、path/query 參數、本文繫結和 multipart 表單。
- `ConsumerRequestContext`：事件名稱與二進位 payload。
- `WebSocketContext`：連線 ID、訊息型別與 payload，並擴充 `ExecutionContext`。
- `WebSocketRequestContext`：upgrade 請求中保存的不可變 path、header、query、cookie、遠端位址、host 與 request URI。
- `WebSocketHandshakeContext`：`PreHandshake` 使用的 upgrade 前請求檢視。
- `WebSocketMessageContext`：同時組合訊息上下文與原始握手請求快照。

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

握手快照不可變，適合在連線建立前驗證，也可在訊息處理階段透過 `WebSocketMessageContext` 讀取。`PreHandshake` 在連線槽位保留之後、HTTP upgrade 之前執行。

## 型別安全

解析器應先檢查所需的專用介面，不支援時回傳錯誤，不要假定每種協定都具備 HTTP 方法。v0.5.1 對具名 `string`/`[]byte` 和擴充的 `ControllerContext` 型別使用安全的 assignability/convertibility 規則，避免反射 panic。
