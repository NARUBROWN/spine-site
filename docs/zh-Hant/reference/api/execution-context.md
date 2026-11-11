# spine.Ctx API

::: info 0.7.5
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

## 共用入口 {#public-context}

處理器與攔截器接收 `github.com/NARUBROWN/spine/pkg/spine.Ctx`。與根應用套件一起匯入時使用 `spinectx` 別名。向服務與儲存庫傳遞 `ctx.ExecutionContext().Context()` 回傳的標準 Go context。仍相容直接注入 context.Context 的舊處理器。

```go
import spinectx "github.com/NARUBROWN/spine/pkg/spine"

func readRequest(ctx spinectx.Ctx) {
	execution := ctx.ExecutionContext()
	execution.Set("userID", "alice")
	value, exists := execution.Get("userID")
	goContext := execution.Context()
	request, supported := ctx.HTTPRequestContext()
	if supported {
		_ = request.Header("Authorization")
	}
	_, _, _ = value, exists, goContext
}
```

## 公開契約 {#contract}

```go
type Ctx interface {
	ExecutionContext() ExecutionContextView
	HTTPRequestContext() (HTTPRequestView, bool)
	HTTPResponseContext() (HTTPResponseView, bool)
	WebSocket() (WebSocketView, bool)
	Get(key string) (any, bool) // Deprecated
}
type ExecutionContextView interface {
	Context() context.Context
	Get(key string) (any, bool)
	Set(key string, value any)
}
```

## 傳輸檢視 {#views}

| getter | 可用操作 |
| --- | --- |
| `ExecutionContext()` | Go context 與每次執行的 Get/Set |
| `HTTPRequestContext()` | Method, Path, Param, Query, Header, MultipartForm |
| `HTTPResponseContext()` | SetHeader, AddHeader, IsCommitted, WriteStatus/JSON/String/Bytes |
| `WebSocket()` | handshake 請求、ConnID、MessageType、Payload |

不支援的 getter 回傳 nil, false。HTTP 執行提供請求與回應檢視；WS handshake 與訊息提供 WS 檢視。事件執行不保證提供 HTTP/WS 檢視。Payload 與 multipart 標頭均為副本。

## 生命週期與遷移 {#lifetime}

儲存區按請求或訊息隔離，由該次執行的鉤子與處理器共用。所有 AfterCompletion 結束後釋放參照；此後 Get 回傳 nil, false，Set 不執行操作。執行結束本身不會取消 Go context。WS handshake 與後續訊息不共用儲存區。內部 writer 替換、Bind、SetRoute、EventBus 與 SenderKey 不屬於公開契約。事件發布使用 `publish.Event(ctx.ExecutionContext().Context(), event)`；傳送使用 `ws.Send(ctx.ExecutionContext().Context(), ws.TextMessage, data)`。預設 HTTP DTO 輸入使用輸入包裝型別。

[輸入與 DTO](/zh-Hant/learn/tutorial/2-controller) | [攔截器](/zh-Hant/learn/tutorial/4-interceptor)

## WebSocket 請求檢視 {#websocket-request-context}

握手 PreHandshake 與訊息掛鉤均接收 spine.Ctx。先檢查 request, ok := ctx.WebSocket()，再讀取 Header 或 Cookie。握手時 ConnID 為空，尚無訊息型別或 payload，請勿假定存在 HTTPRequestContext()。握手與每則訊息使用獨立 Set/Get 儲存。

```go
type WebSocketRequestView interface {
	Context() context.Context
	Path() string
	Header(string) string
	Headers() map[string][]string
	Query(string) string
	Queries() map[string][]string
	Cookie(string) (string, bool)
	Cookies() map[string]string
	RemoteAddr() string
	Host() string
	RequestURI() string
}
type WebSocketView interface {
	WebSocketRequestView
	ConnID() string
	MessageType() int
	Payload() []byte
}
```
