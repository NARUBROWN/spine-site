# spine.App

::: warning v0.7.0 Preview 輸入 API 移轉
本頁既有 API 說明與範例以穩定版 `v0.6.5` 為基準。自 `v0.7.0-preview.1` 起，可依輸入來源使用獨立的 Path、Query 與 Header DTO。`query.Values`、`header.Values` 及其建構與讀取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均標記為 Deprecated。

新的 DTO 方式無法直接用於 `v0.6.5`。在 Preview 中，同一處理器混用新 DTO 與 Deprecated 輸入也會在啟動時遭到拒絕。既有本文 DTO 與情境仍可搭配任一方式使用。

適用版本與移轉範例請見 [Preview 處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)，規格選項請見 [執行階段 OpenAPI](/zh-Hant/reference/api/openapi)。
:::

可透過 `boot.HTTPOptions.OpenAPI.UI` 選擇 Swagger UI 與 ReDoc。請參閱 [Preview 功能與啟動選項](/zh-Hant/learn/migration/preview-features#boot)，了解執行範例、TLS 與 HTTP v3 變更。

`App` 是註冊建構函式、HTTP 路由、攔截器、事件消費者、WebSocket 處理器與自訂傳輸方式，並執行應用程式的入口。此參考涵蓋 Spine v0.6.5 的公開 API 與啟動選項。

```go
import (
    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
)
```

## 介面定義

```go
type App interface {
    Constructor(constructors ...any)
    Route(method string, path string, handler any, opts ...router.RouteOption)
    Interceptor(interceptors ...core.Interceptor)
    InterceptorFor(scope boot.InterceptorScope, interceptors ...core.Interceptor)
    RegisterTransport(t core.CustomTransport)
    Validate(opts boot.Options) error
    Prepare(ctx context.Context, opts boot.Options) (PreparedApplication, error)
    Run(opts boot.Options) error
    RunContext(ctx context.Context, opts boot.Options) error
    Consumers() *consumer.Registry
    WebSocket() *ws.Registry
}
```

在應用程式程式碼中，使用 `pkg/route` 的函式傳入 `Route` 選項。`Consumers()` 與 `WebSocket()` 的回傳型別雖位於內部套件，仍可直接串接呼叫方法，無須自行宣告型別。

## 建構函式

### New

```go
func New(options ...Option) App
```

將所需實作傳入 `spine.New(options ...Option)`。HTTP 應用程式使用 `spine.New(echoplatform.Option())`。沒有 HTTP 的 worker 省略 HTTP 選項並註冊所需的事件 factory。

建立新的 Spine 應用程式實例。

**回傳值**

- `App` - 應用程式實例

**範例**

```go
app := spine.New(echoplatform.Option())
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

## 實作選擇選項 {#platform-options}

HTTP 選擇 Echo，WebSocket 選擇獨立的 Gorilla 實作。註冊 WS 路由需要 HTTP 升級支援與 WS factory。啟用驗證時將 `playground.New()` 的結果傳給 `spine.WithValidator`。

| 選項 | 實作 |
| --- | --- |
| `spine.WithHTTPAdapter(factory)` | `echoplatform.Option()` / `contract/http` |
| `spine.WithWebSocketAdapter(factory)` | `gorillaplatform.Option()` / `contract/websocket` |
| `spine.WithEventAdapter(name, factory, options...)` | Kafka / RabbitMQ / `contract/event` |
| `spine.WithValidator(validator)` | playground / `contract/validator` |

[選擇平台與 DTO 驗證](/zh-Hant/learn/getting-started/platforms)

## 方法

### Constructor

```go
Constructor(constructors ...any)
```

將建構函式註冊到相依性注入容器。容器會依建構函式的參數型別，注入其他已註冊的物件。

**參數**

- `constructors` - 建構函式（可變參數）

**建構函式規則**

- 必須是函式
- 必須恰好有一個回傳值
- 也必須註冊提供參數型別的建構函式

**範例**

```go
// 無相依性的建構函式
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// 有相依性的建構函式
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

// 事件消費者建構函式
func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

app.Constructor(
    NewUserRepository,
    NewUserController,
    NewOrderConsumer,
)
```

### Route

```go
Route(method string, path string, handler any, opts ...router.RouteOption)
```

註冊 HTTP 路由。會移除 `method` 前後的空白，並轉為大寫。

**參數**

- `method` - HTTP 方法（如 `"GET"`、`"POST"`、`"PUT"`、`"DELETE"`），不區分大小寫
- `path` - URL 路徑模式，以 `:param` 格式定義路徑參數
- `handler` - 控制器方法運算式
- `opts` - 路由選項（選用）

**路徑模式**
- `/users` - 靜態路徑
- `/users/:id` - 單一參數
- `/users/:userId/posts/:postId` - 多個參數

**範例**

```go
// 基本路由
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// 巢狀路徑
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

#### 路由選項

使用 `route.WithInterceptors`，只在特定路由套用攔截器。

```go
import "github.com/NARUBROWN/spine/pkg/route"

// 套用路由層級攔截器
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// 透過具型別的 nil 指標從容器中尋找執行個體
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// 套用多個攔截器
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors(
        (*AuthInterceptor)(nil),
        &AdminRoleInterceptor{},
    ),
)
```

### Interceptor

```go
Interceptor(interceptors ...core.Interceptor)
```

為 HTTP 請求與 WebSocket 訊息註冊全域攔截器。`app.Interceptor(...)` 等同於 `app.InterceptorFor(boot.InterceptorAll, ...)`。`PreHandle` 依註冊順序執行，`PostHandle`、`BeforeResponse` 與 `AfterCompletion` 則依反向順序執行。

若將同一個指標實例註冊至多個範圍，會合併範圍並只執行一次。相同型別的不同實例會各自執行。若註冊 `(*AuthInterceptor)(nil)` 這類具有型別的 nil 指標，則會從容器取得共用實例。

**參數**

- `interceptors`：攔截器實例清單

**執行順序**

1. 依註冊順序執行全域攔截器的 `PreHandle`。
2. 路由比對後解析輸入值。
3. 依註冊順序執行路由攔截器的 `PreHandle`。
4. 執行控制器並準備回應，再呼叫執行後掛鉤。
5. 先執行路由攔截器，再執行全域攔截器的 `PostHandle`，兩者各自依註冊的反向順序執行。
6. 依相同的反向順序執行 `BeforeResponse`，再實際寫入回應。
7. 回應處理完成後，依相同的反向順序執行 `AfterCompletion`。

錯誤與中斷時的行為請參閱[攔截器參考](/zh-Hant/reference/api/interceptor)。

**範例**

```go
app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "OPTIONS"},
        AllowHeaders: []string{"Content-Type"},
    }),
    &LoggingInterceptor{},
)
```

### InterceptorFor

```go
InterceptorFor(scope boot.InterceptorScope, interceptors ...core.Interceptor)
```

選擇要套用全域攔截器的傳輸方式。不套用至事件消費者。

| 範圍 | 套用對象 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTP 請求 |
| `boot.InterceptorWebSocket` | WebSocket 訊息與支援的連線前處理 |
| `boot.InterceptorAll` | 以上兩個範圍 |

```go
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsAuthInterceptor)
app.InterceptorFor(boot.InterceptorAll, loggingInterceptor)
```

### WithEcho

```go
echoplatform.WithEcho(fn func(*echo.Echo)) echoplatform.EchoOption
```

建立平台時，透過具有明確型別的 `WithEcho` 選項註冊 Echo 擴充。以下列程式碼取代既有的 `app := spine.New(echoplatform.Option())`，保留後續的建構函式與路由註冊。Spine v0.6.0 已移除 `App.Transport`。

```go
import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/labstack/echo/v5"
    "github.com/labstack/echo/v5/middleware"
)

app := spine.New(echoplatform.Option(echoplatform.WithEcho(func(e *echo.Echo) {
    e.Use(middleware.RequestID())
    e.Static("/static", "public")
})))
```

透過平台選項新增的原生 Echo 路由不會經過 Spine HTTP 攔截器與回應 staging，也不包含在靜態 Spine 路由契約中。請另外檢查實際行為。

### RegisterTransport

```go
RegisterTransport(t core.CustomTransport)
```

註冊獨立於 HTTP 管線執行的傳輸方式。例如，將 gRPC 伺服器接入 Spine 的相依性注入及啟動與關閉流程。

**參數**

- `t` - `core.CustomTransport` 介面的實作

**CustomTransport 介面**
```go
// core/transport.go
type CustomTransport interface {
    // Init 在 DI 容器準備完成後呼叫。
    Init(container Container) error
    // Start 在 Init 之後於獨立的 goroutine 中呼叫。
    Start() error
    // Stop 在正常關閉時呼叫。
    Stop(ctx context.Context) error
}

type Container interface {
    Resolve(t reflect.Type) (any, error)
}
```

**範例**

```go
type GRPCTransport struct {
    server *grpc.Server
}

func (t *GRPCTransport) Init(container core.Container) error {
    // 從容器中取得服務
    svc, err := container.Resolve(reflect.TypeOf((*MyService)(nil)))
    if err != nil {
        return err
    }
    t.server = grpc.NewServer()
    RegisterMyServiceServer(t.server, svc.(*MyService))
    return nil
}

func (t *GRPCTransport) Start() error {
    lis, err := net.Listen("tcp", ":9090")
    if err != nil {
        return err
    }
    return t.server.Serve(lis)
}

func (t *GRPCTransport) Stop(ctx context.Context) error {
    t.server.GracefulStop()
    return nil
}

app.RegisterTransport(&GRPCTransport{})
```

### RunContext / Prepare

```go
RunContext(ctx context.Context, opts boot.Options) error
Prepare(ctx context.Context, opts boot.Options) (PreparedApplication, error)

type PreparedApplication interface {
    Handler() http.Handler
    Close(ctx context.Context) error
}
```

`RunContext` 在 context 取消時開始正常關閉。`Prepare` 不啟動監聽器即可準備應用程式，並回傳 `Handler()` 與 `Close(ctx)`。它不會啟動 consumer 或 custom transport，但依設定，broker readiness 與 custom Init 可能建立網路連線。呼叫方負責關閉準備結果與外部 HTTP 伺服器。

### Consumers

```go
Consumers() *consumer.Registry
```

回傳用於註冊事件消費者的登錄表。註冊要從 Kafka 或 RabbitMQ 接收的事件名稱與處理器。消費者的建構函式也必須透過 `Constructor` 註冊。

**回傳值**

- `*consumer.Registry` - 消費者登錄表

**範例**

```go
// 註冊事件消費者
app.Consumers().Register(
    "order.created",            // 主題/事件名稱
    (*OrderConsumer).OnCreated, // 處理器方法
)

app.Consumers().Register(
    "stock.created",
    (*StockConsumer).OnCreated,
)
```

#### 事件處理器

事件處理器可接收標準內容物件、事件名稱與事件 DTO 作為參數。

```go
type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

// 事件處理器
func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("이벤트 수신:", eventName)
    log.Println("주문 ID:", event.OrderID)
    return nil
}

// 事件 DTO
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}
```

### WebSocket

```go
WebSocket() *ws.Registry
```

回傳 WebSocket 登錄表，用來註冊 WebSocket 路徑與處理器。

**回傳值**

- `*ws.Registry` - WebSocket 登錄表

**範例**

```go
if err := app.WebSocket().Register("/ws/chat", (*ChatController).OnMessage); err != nil {
    log.Fatal(err)
}
```

#### WebSocket 處理器

WebSocket 處理器接收 `ws` 套件的連線 ID 與訊息 DTO 作為參數。以下範例儲存各連線的傳送物件，並將訊息傳送至所有連線。請透過 `Constructor` 註冊 `ChatController` 的建構函式。

```go
import "github.com/NARUBROWN/spine/pkg/ws"

type ChatController struct {
    mu      sync.RWMutex
    clients map[string]ws.Sender
}

func NewChatController() *ChatController {
    return &ChatController{clients: make(map[string]ws.Sender)}
}

type ChatMessage struct {
    Message string `json:"message"`
}

type ChatEvent struct {
    Type    string `json:"type"`
    From    string `json:"from"`
    Message string `json:"message"`
    At      string `json:"at"`
}

func (c *ChatController) OnMessage(
    ctx context.Context,
    connID ws.ConnectionID,
    msg ChatMessage,
) error {
    sender, ok := ctx.Value(ws.SenderKey).(ws.Sender)
    if ok && sender != nil {
        c.mu.Lock()
        c.clients[connID.Value] = sender
        c.mu.Unlock()
    }

    message := strings.TrimSpace(msg.Message)
    if message == "" {
        return nil
    }

    payload, err := json.Marshal(ChatEvent{
        Type:    "message",
        From:    connID.Value,
        Message: message,
        At:      time.Now().UTC().Format(time.RFC3339),
    })
    if err != nil {
        return err
    }

    c.mu.RLock()
    clients := make(map[string]ws.Sender, len(c.clients))
    for id, client := range c.clients {
        clients[id] = client
    }
    c.mu.RUnlock()

    var firstErr error
    for id, client := range clients {
        if err := client.Send(ws.TextMessage, payload); err != nil {
            if firstErr == nil {
                firstErr = err
            }
            c.mu.Lock()
            delete(c.clients, id)
            c.mu.Unlock()
        }
    }
    return firstErr
}
```

WebSocket 會將路徑註冊至與 HTTP 伺服器相同的 Echo 實例，因此需要 `boot.Options.HTTP`。來源、連線數與驗證設定請參閱[安全性設定](/zh-Hant/reference/security-configuration#websocket)。

### Validate

```go
Validate(opts boot.Options) error
```

在不連接網路的情況下檢查 HTTP/WebSocket 限制、事件 factory 契約與通用政策以及驗證器註冊。`Run` 也執行相同檢查。平台的 `NewFactory` 先檢查具體訊息代理 `Config`，因此也要檢查建立錯誤。

boot 選項錯誤透過 `*boot.ConfigError.Issues` 的 `Path`、`Code`、`Message`、`Hint` 檢查。也可能傳回事件、HTTP、WebSocket factory 或驗證器契約錯誤，使用 `errors.Is` 與 `errors.As` 檢查公開錯誤。有效設定傳回 `nil`。

`Validate` 不會建立建構函式的相依物件，也不會連線至訊息代理。因此，通過驗證不代表建構函式與路由適用、DI 組態正確，或已成功連線至實際基礎設施。

```go
options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

### Run

```go
Run(opts boot.Options) error
```

依註冊的組態與 `boot.Options` 啟動 HTTP 伺服器、WebSocket、事件消費者與自訂傳輸方式。執行期間等待關閉訊號或執行階段錯誤。若設定、初始化、執行或關閉失敗，會回傳錯誤。

```go
if err := app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
}); err != nil {
    log.Fatal(err)
}
```

## boot.Options

Preview 中新增的啟動選項請參閱[執行階段 OpenAPI 設定](/zh-Hant/reference/api/openapi#options)。JSON 規格從 `v0.7.0-preview.1` 起可用，透過 `HTTP.OpenAPI.UI` 註冊 Swagger UI 與 ReDoc 則從 `v0.7.0-preview.2` 起可用。[UI 註冊範例](/zh-Hant/reference/api/openapi#tools)包含 import 與設定。

`boot.Options` 設定 HTTP 執行與關閉政策。執行 HTTP 時設定 `HTTP`。事件連線與角色透過外部平台 `Config` 與 `spine.WithEventAdapter` 選擇。

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### 結構定義

```go
type Options struct {
    Address                string
    EnableGracefulShutdown bool
    ShutdownTimeout        time.Duration
    HTTP                   *HTTPOptions
}

type HTTPOptions struct {
    GlobalPrefix      string
    DisableRecover    bool
    ReadHeaderTimeout time.Duration
    ReadTimeout       time.Duration
    WriteTimeout      time.Duration
    IdleTimeout       time.Duration
    MaxHeaderBytes    int
    MaxBodyBytes      int64
    WebSocket         WebSocketOptions
}
```

| `Options` 欄位 | 意義與預設行為 |
| --- | --- |
| `Address` | HTTP 伺服器監聽的位址。例如 `":8080"` |
| `EnableGracefulShutdown` | 為 `true` 時，HTTP 伺服器收到 `SIGINT`、`SIGTERM` 後正常關閉。預設為 `false` |
| `ShutdownTimeout` | 關閉 HTTP 與自訂傳輸方式時的等待時間。`0` 表示 10 秒，不得為負數 |
| `HTTP` | HTTP 與 WebSocket 設定。`nil` 表示停用 HTTP 伺服器 |

| `HTTPOptions` 欄位 | 為 `0` 或省略時 | 限制 |
| --- | --- | --- |
| `GlobalPrefix` | 無前綴 | 套用下方的路徑規則 |
| `DisableRecover` | `false`，使用將 panic 轉為 HTTP 500 的復原中介軟體 | `true` 表示停用中介軟體 |
| `ReadHeaderTimeout` | 5 秒 | 不得為負數 |
| `ReadTimeout` | 30 秒 | 不得為負數 |
| `WriteTimeout` | 30 秒 | 不得為負數 |
| `IdleTimeout` | 120 秒 | 不得為負數 |
| `MaxHeaderBytes` | 1 MiB | 不得為負數 |
| `MaxBodyBytes` | 32 MiB | 負數表示停用本文大小限制 |
| `WebSocket` | [WebSocket 預設值](/zh-Hant/reference/security-configuration#websocket) | `boot.WebSocketOptions` |

### GlobalPrefix 驗證規則

若值不符合以下規則，`Validate` 與 `Run` 會回傳 `HTTP_GLOBAL_PREFIX_INVALID` 設定錯誤。空字串表示不套用前綴。

- 必須以 `"/"` 開頭
- 不得包含 `":"`（路徑參數）
- 不得包含 `"*"`（萬用字元）
- 結尾的 `"/"` 會自動移除

```go
// 有效前綴
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// Validate 與 Run 回傳設定錯誤
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // 未以 '/' 開頭
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // 包含路徑參數
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // 包含萬用字元
```

### 基本用法

```go
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

### 正常關閉

```go
app.Run(boot.Options{
    Address:                ":8080",
    EnableGracefulShutdown: true,
    ShutdownTimeout:        10 * time.Second,
    HTTP: &boot.HTTPOptions{
        GlobalPrefix: "/api/v1",
    },
})
```

啟用 HTTP 正常關閉後，收到 `SIGINT`、`SIGTERM` 時會停止接收新請求，並等待正在處理的請求完成。接著關閉 WebSocket 連線、停止事件消費者，再呼叫自訂傳輸方式的 `Stop(ctx)`。

`ShutdownTimeout` 套用至 HTTP 關閉與自訂傳輸方式的關閉內容物件。消費者的 `Stop` 會等待工作、ACK/NACK 與讀取器結束，因此請勿將此值解讀為整個程序的強制終止期限。只執行消費者或自訂傳輸方式而不使用 HTTP 時，也會處理關閉訊號。

### Recover 中介軟體

預設啟用將 panic 轉為 HTTP 500 回應的復原中介軟體。

```go
// 停用 Recover
HTTP: &boot.HTTPOptions{
    DisableRecover: true,
}
```

## Kafka 設定

### 建立並註冊 factory

匯入 `kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"`。透過 `Config.Consume` 與 `Config.Publish` 選擇角色並設定 `Brokers`。消費者還需要 `GroupID`。以下程式碼用於 `BuildApplication` 內，同時匯入 `echoplatform`、`spine`、`boot` 與 `time`。

```go
factory, err := kafkaplatform.NewFactory(kafkaplatform.Config{
    Brokers: []string{"kafka.example.com:9093"},
    Consume: true,
    Publish: true,
    GroupID: "orders",
    TopicPrefix: "prod.",
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory,
    spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{MaxAttempts: 5}),
    spine.WithEventSettlementTimeout(5 * time.Second),
))
```

### 政策與限制

Kafka 平台預設使用 TLS 1.2 以上。使用 `TLS`、`Dialer`、`Transport` 設定 CA、mTLS 與 SASL。`AllowInsecureTransport: true` 僅用於隔離的本地明文連線，不能與明確指定的 TLS 同時使用。`NewFactory` 僅檢查設定。`Prepare` 與 `Run` 在準備已註冊消費者的 reader 時檢查訊息代理與主題。Kafka 僅發布應用程式可以在未連接訊息代理時啟動，因此需要實際發布來另外驗證連線與傳遞。

`Config.TopicPrefix` 同時為發布名稱與消費者訂閱加入前綴。兩端 factory 都設定 `prod.` 時，應用程式中註冊 `order.created`，在訊息代理中準備 `prod.order.created`。前綴需要自行包含分隔符。

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})` 控制 reader 與 ACK/NACK 失敗後的重新連線。預設初始延遲 100ms、最大 5s、倍率 2、抖動 0.2，`MaxAttempts: 0` 表示無限次傳輸重試。它不設定處理器重試次數或 DLQ 政策。`WithEventSettlementTimeout` 的預設 ACK/NACK 限制為 5s。Kafka 不會透過後續 offset 提交跳過失敗記錄，無法處理的訊息可能阻塞分區。

## RabbitMQ 設定

### 建立並註冊 factory

匯入 `rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"`。設定共用的 `Config.Exchange` 並選擇 `Consume`、`Publish`。預設要求 `amqps://`，本地 `amqp://` 需要明確設定 `AllowInsecureTransport: true`。以下程式碼用於 `BuildApplication` 內。

```go
factory, err := rabbitmqplatform.NewFactory(rabbitmqplatform.Config{
    URL: "amqps://user:pass@rabbit.example.com/vhost",
    Exchange: "events",
    Consume: true,
    Publish: true,
    PrefetchCount: 16,
    FailurePolicy: rabbitmqplatform.FailureReject,
    DeadLetter: &rabbitmqplatform.DeadLetter{
        Exchange: "events.dlx",
        RoutingKey: "events.failed",
    },
    OperationTimeout: 5 * time.Second,
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory))
```

### 政策與限制

省略 `PrefetchCount` 時每個消費者允許一則未確認訊息。預設政策為 `rabbitmqplatform.FailureReject`，`FailureRequeue` 可能無限次重新傳遞無法處理的訊息。使用前先準備 `DeadLetter` 交換器。`TopicPrefix` 套用於發布路由鍵與訂閱綁定，`QueuePrefix` 套用於佇列名稱。

發布器使用持久化訊息、mandatory 路由與 publisher confirm。`OperationTimeout` 預設為 5s。沒有自動重新發布失敗訊息的 `PublisherRetry` 選項。確認遺失後應用程式重試可能造成重複，因此消費者必須具冪等性。

## 事件發布 {#event-publishing}

可在控制器收集領域事件，並傳送至已註冊的 Kafka 或 RabbitMQ 發布器。

### DomainEvent 介面

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

type DomainEvent interface {
    Name() string
    OccurredAt() time.Time
}
```

### 定義事件

```go
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}

func (e OrderCreated) Name() string {
    return "order.created"
}

func (e OrderCreated) OccurredAt() time.Time {
    return e.At
}
```

### 在控制器發布

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

func (c *OrderController) Create(ctx context.Context, req *CreateOrderRequest) httpx.Response[Order] {
    order := c.repo.Save(req)

    // 發布事件
    publish.Event(ctx, OrderCreated{
        OrderID: order.ID,
        At:      time.Now(),
    })

    return httpx.Response[Order]{Body: order}
}
```

`publish.Event()` 將事件收集至與 `context.Context` 關聯的事件匯流排。控制器執行與回應準備成功後，會在執行後掛鉤中，批次傳送至已註冊的 Kafka 或 RabbitMQ 發布器。此傳送發生在 `BeforeResponse` 之前，因此不會與 DB 交易提交構成原子操作。如需原子處理，請設定交易式寄件匣。

## 在 CLI 專案中使用

[建立第一個應用程式](/zh-Hant/learn/getting-started/first-app)產生的專案，會在 `internal/application/application.go` 的 `BuildApplication` 中設定應用程式，並在根目錄的 `main.go` 中確認 `Validate` 錯誤後呼叫 `Run`。可使用以下命令檢查專案。

```sh
spine doctor
spine contract check
spine verify
```

以下是產生的 `BuildApplication` 基本形式。

```go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"os"

	"github.com/NARUBROWN/spine"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
	return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

// BuildApplication 是伺服器執行、契約檢查與離線驗證共用的應用程式組態函式。
func BuildApplication() (spine.App, boot.Options, error) {
	app := spine.New(echoplatform.Option())
	app.Constructor(NewHealthController)
	app.Route("GET", "/health", (*HealthController).Get)

	address := ":8080"
	if port := os.Getenv("SPINE_PORT"); port != "" {
		address = ":" + port
	}
	return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## 啟動與關閉順序

`Run` 會在選項預先驗證後，設定相依性注入容器與事件發布器。接著呼叫自訂傳輸方式的 `Init`，解析 HTTP 與 WebSocket 的路由和攔截器，並預先建立所需的控制器。若有已註冊的消費者，也會驗證訊息代理執行環境。

完成準備後，在各自的 goroutine 中執行消費者與自訂傳輸方式的 `Start`，最後啟動 HTTP 伺服器。若同一個 HTTP 方法的路由路徑存在模糊重疊，啟動會失敗。例如，`/users/:id` 與 `/users/me` 會被判定為重疊路徑。

關閉時，先停止接收 WebSocket 與 HTTP 請求，等待消費者停止後，再依初始化的反向順序呼叫自訂傳輸方式的 `Stop`。最後清理事件發布器的資源。具體實作請參閱 [v0.6.5 啟動與關閉程式碼](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/bootstrap/bootstrap.go)。

## 限制與錯誤

- 建構函式必須恰好有一個回傳值，無法註冊回傳 `(T, error)` 的建構函式。
- HTTP 輸入 DTO 以指標接收，成功回應則以 `httpx.Response[T]` 等支援的回應型別回傳。請參閱[撰寫控制器](/zh-Hant/learn/tutorial/2-controller)。
- 即使 `Validate` 成功，`Run` 仍可能發生建構函式、相依性、路由或訊息代理連線錯誤。請檢查兩個方法回傳的錯誤。
- 若註冊 WebSocket 路徑卻省略 `HTTP`，會發生 `WEBSOCKET_HTTP_REQUIRED` 設定錯誤。
- `InterceptorFor` 的範圍須使用 `InterceptorHTTP`、`InterceptorWebSocket` 或 `InterceptorAll`。若為 `0` 或包含不支援的位元，會發生 `INTERCEPTOR_SCOPE_INVALID` 設定錯誤。
- 網路傳輸、事件發布與 DB 提交不是單一原子操作。應用程式必須決定是否需要重試與重複處理機制。

## 參考

- [攔截器](/zh-Hant/reference/api/interceptor)：公開介面與執行順序
- [執行管線](/zh-Hant/learn/core-concepts/pipeline) - 請求處理流程
- [Spine 簡介](/zh-Hant/learn/getting-started/intro)：相依性注入與主要概念
