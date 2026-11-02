# core.ExecutionContext

`ExecutionContext` 是在攔截器與執行管線中讀取請求資訊，並在處理階段之間共用值的介面。HTTP 請求、事件與 WebSocket 訊息共用此介面，各傳輸方式則透過其他介面提供額外資訊。

```go
import "github.com/NARUBROWN/spine/core"
```

## 選擇介面

若要在 HTTP 控制器中讀取攔截器儲存的值，請將 `core.ControllerContext` 宣告為參數。在攔截器中則使用 `core.ExecutionContext`。HTTP 與事件的輸入解析分別使用 `HttpRequestContext` 與 `ConsumerRequestContext`。

| 介面 | 內嵌介面 | 提供的功能 |
| --- | --- | --- |
| `ContextCarrier` | 無 | Go 標準 `context.Context` |
| `EventBusCarrier` | 無 | 請求範圍的事件匯流排 |
| `ExecutionContext` | `ContextCarrier`、`EventBusCarrier` | 請求方法與路徑、標頭與參數、值的儲存與查詢 |
| `ControllerContext` | 無 | 查詢攔截器儲存的值 |
| `HttpRequestContext` | `ContextCarrier`、`EventBusCarrier` | 讀取 HTTP 輸入、繫結本文、多部分表單 |
| `ConsumerRequestContext` | `ContextCarrier`、`EventBusCarrier` | 事件名稱與原始本文 |
| `WebSocketContext` | `ExecutionContext` | 連線 ID、訊息型別與原始本文 |
| `WebSocketRequestContext` | `ContextCarrier` | 發起連線的 HTTP 請求資訊 |
| `WebSocketHandshakeContext` | `WebSocketRequestContext` | HTTP 升級前驗證與授權所需的請求資訊 |
| `WebSocketMessageContext` | `WebSocketContext`、`WebSocketRequestContext` | 訊息與原始連線請求資訊 |

`ControllerContext` 不內嵌 `ExecutionContext`，只提供 `Get`。`HttpRequestContext` 與 `ConsumerRequestContext` 也不內嵌 `ExecutionContext`。執行階段提供的實作會同時實作所需介面。

## 介面定義

### 基礎介面

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() EventBus
}
```

`EventBus()` 回傳 `core.EventBus`，提供收集事件的 `Publish(events ...publish.DomainEvent)`，以及取出已收集事件的 `Drain() []publish.DomainEvent`。

### ExecutionContext

```go
type ExecutionContext interface {
    ContextCarrier
    EventBusCarrier

    Method() string
    Path() string
    Params() map[string]string
    Header(name string) string
    PathKeys() []string
    SetRoute(params map[string]string, pathKeys []string)
    Queries() map[string][]string
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

### ControllerContext

專供 HTTP 控制器讀取值的介面。可透過 `Get()` 查詢攔截器使用 `Set()` 儲存的值。預設的消費者與 WebSocket 輸入解析器不會注入此型別。

```go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

### HttpRequestContext

讀取 HTTP 輸入的介面，內嵌 `ContextCarrier` 與 `EventBusCarrier`。

```go
type HttpRequestContext interface {
    ContextCarrier
    EventBusCarrier

    // 개별 접근
    Param(name string) string
    Query(name string) string
    Header(name string) string

    // 전체 뷰 접근
    Params() map[string]string
    Queries() map[string][]string
    Headers() map[string][]string

    // 요청 본문
    Bind(out any) error

    // 멀티파트
    MultipartForm() (*multipart.Form, error)
}
```

### HTTPResponseContext

```go
type HTTPResponseContext interface {
    ResponseWriter() ResponseWriter
    SetResponseWriter(ResponseWriter)
}
```

`HTTPResponseContext.ResponseWriter()` 回傳 HTTP 回應 writer。管線準備回應時將其替換為 staging writer，並在傳送前復原。控制器通常回傳 `httpx.Response[T]`、`httpx.Redirect` 或 `httpx.Binary`，而不是直接存取 writer。

### ConsumerRequestContext

讀取事件消費者輸入的介面，內嵌 `ContextCarrier` 與 `EventBusCarrier`。

```go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string
    Payload() []byte
}
```

### WebSocketContext

讀取 WebSocket 訊息的介面，內嵌 `ExecutionContext`。

```go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string
    MessageType() int
    Payload() []byte
}
```

### WebSocket 連線請求資訊 {#websocket-request-context}

v0.6.0 會複製並保留 HTTP 升級請求資訊。可透過以下介面查詢標頭、查詢參數、Cookie、遠端位址、主機與請求 URI。

```go
type WebSocketRequestContext interface {
    ContextCarrier
    Path() string
    Header(name string) string
    Headers() map[string][]string
    Query(name string) string
    Queries() map[string][]string
    Cookie(name string) (string, bool)
    Cookies() map[string]string
    RemoteAddr() string
    Host() string
    RequestURI() string
}

type WebSocketHandshakeContext interface { WebSocketRequestContext }

type WebSocketMessageContext interface {
    WebSocketContext
    WebSocketRequestContext
}
```

`WebSocketHandshakeContext` 用於 `PreHandshake`。處理訊息時，將 `ExecutionContext` 型別斷言為 `WebSocketMessageContext`，即可讀取原始連線請求資訊。`Headers()`、`Queries()` 與 `Cookies()` 回傳複本，因此修改回傳的映射不會改變所保留的請求資訊。

## ExecutionContext 方法

### Context

```go
Context() context.Context
```

回傳 Go 標準函式庫的 `context.Context`。

**回傳值**

- `context.Context` - 請求範圍的內容物件

**範例**

```go
func (i *TimeoutInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    select {
    case <-ctx.Context().Done():
        return ctx.Context().Err()
    default:
        return nil
    }
}
```

### EventBus

```go
EventBus() core.EventBus
```

回傳請求範圍的事件匯流排，用於發布領域事件。

**回傳值**

- `core.EventBus` - 事件匯流排實例

發布事件的控制器接收 `context.Context` 參數，並呼叫 `publish.Event(ctx, event)`。執行階段會將事件匯流排關聯至標準內容物件。請參閱[事件發布範例](/zh-Hant/reference/api/spine-app#event-publishing)。

### Method

```go
Method() string
```

回傳請求方法。

**回傳值**

- HTTP：`"GET"`、`"POST"`、`"PUT"`、`"DELETE"` 等
- 事件消費者：`"EVENT"`
- WebSocket：`"WS"`

**範例**

```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // CORS 사전 요청 처리
    }
    return nil
}
```

### Path

```go
Path() string
```

回傳請求路徑。

**回傳值**

- HTTP：請求路徑（例如 `"/users/123"`）
- 事件消費者：事件名稱（例如 `"order.created"`）
- WebSocket：WebSocket 路徑（例如 `"/ws/chat"`）

**範例**

```go
log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
// HTTP:      [REQ] GET /users/123
// Consumer:  [REQ] EVENT order.created
// WebSocket: [REQ] WS /ws/chat
```

### Header

```go
Header(name string) string
```

回傳指定名稱的 HTTP 標頭值。

**參數**

- `name` - 標頭名稱（不區分大小寫）

**回傳值**

- `string` - 標頭值，若不存在則為空字串
- 事件消費者：空字串
- WebSocket：從 HTTP 升級請求保留的標頭值

**範例**

```go
origin := ctx.Header("Origin")
auth := ctx.Header("Authorization")
```

### Params

```go
Params() map[string]string
```

以映射回傳所有路徑參數。

**回傳值**

- `map[string]string` - 路徑參數映射
- 事件消費者：`nil`
- WebSocket：路由器解析的路徑參數，路由比對前為空映射

**範例**

```go
// Route: /users/:userId/posts/:postId
// Request: /users/123/posts/456

params := ctx.Params()  // {"userId": "123", "postId": "456"}
```

### PathKeys

```go
PathKeys() []string
```

依宣告順序回傳路徑參數的索引鍵。

**回傳值**

- `[]string` - 索引鍵切片
- 事件消費者：`nil`
- WebSocket：路由器解析的索引鍵順序，路由比對前為空切片

**範例**

```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```

### SetRoute

```go
SetRoute(params map[string]string, pathKeys []string)
```

儲存路由器找到的參數與鍵順序。實作需複製輸入，並與使用者 Set/Get 儲存空間分離。自行實作 ExecutionContext 時也必須提供此方法。

### Queries

```go
Queries() map[string][]string
```

以映射回傳所有查詢參數。

**回傳值**

- `map[string][]string` - 查詢參數映射
- 事件消費者：`nil`
- WebSocket：從 HTTP 升級請求保留的查詢參數

**範例**

```go
// Request: /users?status=active&tag=go&tag=web

queries := ctx.Queries()
// {"status": ["active"], "tag": ["go", "web"]}
```

### Set

```go
Set(key string, value any)
```

將值存入內部儲存空間。

**參數**

- `key` - 要儲存的索引鍵
- `value` - 要儲存的值

**範例**

```go
ctx.Set("auth.user", authenticatedUser)
ctx.Set("request.startTime", time.Now())
```

### Get

```go
Get(key string) (any, bool)
```

從內部儲存空間查詢值。

**參數**

- `key` - 要查詢的索引鍵

**回傳值**

- `any` - 儲存的值
- `bool` - 索引鍵是否存在

**範例**

```go
value, exists := ctx.Get("auth.user")
```

## ControllerContext

讓控制器讀取攔截器儲存值的介面。

### Get

```go
Get(key string) (any, bool)
```

委派給 `ExecutionContext.Get()`，不提供 `Set()` 方法。

以下程式碼是擴充 [CLI 專案](/zh-Hant/learn/tutorial/1-project-structure)中 `src/user/user_controller.go` 的範例。`User`、`AuthUser` 與儲存庫欄位由應用程式定義。保留產生的 `user.Register(app)` 與根目錄的 `main.go`。

```go
func (c *UserController) GetUser(ctx core.ControllerContext, userId path.Int) (httpx.Response[User], error) {
    // 인터셉터가 Set("auth.user", ...)으로 저장한 값 조회
    if authUser, ok := ctx.Get("auth.user"); ok {
        _ = authUser.(*AuthUser)
        // ...
    }
    user, err := c.repo.FindByID(userId.Value)
    if err != nil {
        return httpx.Response[User]{}, err
    }
    return httpx.Response[User]{Body: user}, nil
}
```

## HttpRequestContext 方法

解析 HTTP 輸入時使用的額外方法。

### Param

```go
Param(name string) string
```

回傳特定路徑參數的值。

**範例**

```go
userId := ctx.Param("id")  // "123"
```

### Query

```go
Query(name string) string
```

回傳特定查詢參數的第一個值。

**範例**

```go
page := ctx.Query("page")  // "1"
```

### Headers

```go
Headers() map[string][]string
```

以映射回傳所有 HTTP 標頭。

**範例**

```go
headers := ctx.Headers()
// {"Content-Type": ["application/json"], "Accept": ["text/html", "application/json"]}
```

### Bind

```go
Bind(out any) error
```

將 HTTP 請求本文繫結至結構。

**範例**

```go
var req CreateUserRequest
if err := ctx.Bind(&req); err != nil {
    return err
}
```

### MultipartForm

```go
MultipartForm() (*multipart.Form, error)
```

存取多部分表單資料。

**範例**

```go
form, err := ctx.MultipartForm()
if err != nil {
    return err
}
for _, file := range form.File["upload"] {
    // 파일 처리
}
```

## ConsumerRequestContext 方法

解析事件輸入時使用的方法。

### EventName

```go
EventName() string
```

回傳接收到的事件名稱。

**範例**

```go
name := ctx.EventName()  // "order.created"
```

### Payload

```go
Payload() []byte
```

回傳事件的原始承載資料。

**範例**

```go
payload := ctx.Payload()  // []byte (JSON)
var event OrderCreated
json.Unmarshal(payload, &event)
```

## WebSocketContext 方法

解析 WebSocket 輸入時使用的方法。

### ConnID

```go
ConnID() string
```

回傳 WebSocket 連線的唯一識別碼。

**範例**

```go
connID := ctx.ConnID()  // "a1b2c3d4-..."
```

### MessageType

```go
MessageType() int
```

回傳 WebSocket 訊息型別。

**回傳值**

- `1` - TextMessage
- `2` - BinaryMessage

**範例**

```go
if ctx.MessageType() == ws.TextMessage {
    // 텍스트 메시지 처리
}
```

### Payload

```go
Payload() []byte
```

回傳 WebSocket 訊息的原始承載資料。

**範例**

```go
payload := ctx.Payload()  // []byte
var msg ChatMessage
json.Unmarshal(payload, &msg)
```

## 路由與回應契約

路由狀態與 HTTP 回應 writer 使用具有明確型別的契約，與使用者 Set/Get 儲存空間分離。路由器透過 `SetRoute` 儲存路徑值，HTTP 管線透過 `HTTPResponseContext` 選擇 writer。

| API | 型別 | 說明 |
|----|------|------|
| `HTTPResponseContext.ResponseWriter()` | `core.ResponseWriter` | 回應輸出介面 |
| `Params()` | `map[string]string` | 路徑參數 |
| `PathKeys()` | `[]string` | 路徑參數的索引鍵順序 |

## 在攔截器中使用

`ExecutionContext` 會以第一個引數傳入攔截器的所有方法。

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### 記錄日誌範例

```go
type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

### CORS 範例

以下示範如何存取回應輸出介面。`Config` 與 `isAllowedOrigin` 由應用程式定義。如需完整的 CORS 設定，請使用[可驗證的內建攔截器](/zh-Hant/reference/security-configuration#cors-cookies)。

```go
type CORSInterceptor struct {
    config Config
}

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    httpCtx, ok := ctx.(core.HTTPResponseContext)
    if !ok || httpCtx.ResponseWriter() == nil {
        return nil
    }
    rw := httpCtx.ResponseWriter()

    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
        rw.SetHeader("Vary", "Origin")
    }

    if ctx.Method() == "OPTIONS" {
        if err := rw.WriteStatus(204); err != nil {
            return err
        }
        return core.ErrAbortPipeline
    }

    return nil
}
```

## 在輸入解析中使用

輸入解析元件會接收 `core.ExecutionContext`，並型別斷言為對應傳輸方式的介面。例如，讀取 HTTP 路徑參數需要 `core.HttpRequestContext`，讀取事件名稱需要 `core.ConsumerRequestContext`，讀取 WebSocket 連線 ID 則需要 `core.WebSocketContext`。若內容物件未實作對應介面，型別斷言就會失敗。

HTTP 控制器的 `context.Context` 參數會收到標準內容物件與請求範圍的事件匯流排；`core.ControllerContext` 參數則會收到只提供 `Get()` 的檢視。消費者與 WebSocket 的預設輸入解析器不提供 `ControllerContext` 注入功能。執行階段的輸入解析程式碼可在以下原始碼中查看。

- [HTTP 路徑參數解析](https://github.com/NARUBROWN/spine/blob/v0.6.0/internal/resolver/path_int_resolver.go)
- [傳遞標準內容物件](https://github.com/NARUBROWN/spine/blob/v0.6.0/internal/resolver/std_context_resolver.go)
- [傳遞控制器查詢內容物件](https://github.com/NARUBROWN/spine/blob/v0.6.0/internal/resolver/controller_context_resolver.go)
- [事件輸入解析](https://github.com/NARUBROWN/spine/tree/v0.6.0/internal/event/consumer/resolver)
- [WebSocket 輸入解析](https://github.com/NARUBROWN/spine/tree/v0.6.0/internal/ws/resolver)

## 各通訊協定的行為差異

| 方法 | HTTP | 事件消費者 | WebSocket |
|--------|------|----------|-----------|
| `Method()` | `"GET"`、`"POST"` 等 | `"EVENT"` | `"WS"` |
| `Path()` | `/users/123` | `order.created` | `/ws/chat` |
| `Header()` | 標頭值 | 空字串 | 連線請求的標頭值 |
| `Params()` | 路徑參數 | `nil` | 路由器解析的路徑參數 |
| `PathKeys()` | 路徑參數的索引鍵順序 | `nil` | 路徑參數的索引鍵順序 |
| `Queries()` | 查詢參數 | `nil` | 連線請求的查詢參數 |
| `EventBus()` | EventBus | EventBus | EventBus |
| `Context()` | 請求內容 | 事件處理內容 | 訊息處理內容 |

## 實作

| 實作 | 介面 | 位置 |
|--------|-----------|------|
| `echoContext` | `ExecutionContext` + `HttpRequestContext` | `internal/adapter/echo/context_impl.go` |
| `ConsumerRequestContextImpl` | `ExecutionContext` + `ConsumerRequestContext` | `internal/event/consumer/request_context_impl.go` |
| `WSExecutionContext` | `WebSocketMessageContext` | `internal/ws/context_impl.go` |
| `controllerCtxView` | `ControllerContext` | `internal/runtime/controller_ctx.go` |

## 限制與錯誤

- 全域攔截器的 `PreHandle` 在路由比對前執行。此時 `HandlerMeta{}` 為空，請勿直接存取控制器型別或方法。路徑參數也須在路由比對後讀取。
- 若索引鍵不存在，`Get` 會回傳 `(nil, false)`。使用前請先確認儲存值的型別。`ControllerContext` 不會阻止修改所儲存物件本身。
- 若值不存在，`Header` 與 `Query` 會回傳空字串。WebSocket 的 `Cookie` 會同時回傳值與是否存在。
- `Bind` 與 `MultipartForm` 解析本文失敗時會回傳錯誤。請將錯誤傳回呼叫端並中止處理。
- 以 `spine.` 開頭的保留索引鍵由執行階段使用。應用程式共用的值請使用 `auth.user` 等其他名稱。

## 參考

- [攔截器](/zh-Hant/reference/api/interceptor)：驗證、記錄日誌等共通處理
- [執行內容概念](/zh-Hant/learn/core-concepts/execution-context) - 詳細說明
