# spine.App

メインアプリケーションインターフェイスへのAPIリファレンス。
## 概要
`App`はSpineアプリケーションのエントリポイントです。コンストラクタの登録、ルート定義、Interceptorの設定、イベントコンシューマの登録、WebSocketハンドラの登録、Custom Transportの登録、サーバーの実行を担当します。

```go
import "github.com/NARUBROWN/spine"
```

## インタフェース定義

```go
type App interface {
    // コンストラクタの宣言
    Constructor(constructors ...any)
    // ルートの宣言
    Route(method string, path string, handler any, opts ...router.RouteOption)
    // インターセプタの宣言
    Interceptor(interceptors ...core.Interceptor)
    // HTTP Transport の拡張（Echo など）
    Transport(fn func(any))
    // 独立して実行される Custom Transport の登録
    RegisterTransport(t core.CustomTransport)
    // 実行
    Run(opts boot.Options) error
    // イベントコンシューマのレジストリを返す
    Consumers() *consumer.Registry
    // WebSocket レジストリを返す
    WebSocket() *ws.Registry
}
```

## コンストラクタ
### New


```go
func New() App
```

新しいSpineアプリケーションインスタンスを作成します。
**戻り値**
- `App` - アプリケーションインスタンス
**例**
```go
app := spine.New()
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```


## メソッド
### Constructor


```go
Constructor(constructors ...any)
```

IoC Container にコンストラクタ関数を登録します。登録されたコンストラクタは依存性注入に使用されます。
**パラメータ**
- `constructors` - コンストラクタ関数(可変引数)
**作成者ルール**
- 関数でなければなりません
- 戻り値は正確に1つでなければなりません
- パラメータは他の登録されたタイプでなければなりません（依存性）
**例**
```go
// 依存性のないコンストラクタ
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// 依存性のあるコンストラクタ
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

// イベントコンシューマのコンストラクタ
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

HTTPルートを登録します。 HTTP メソッドは大文字に自動的に変換されます。
**パラメータ**
- `method` - HTTPメソッド（`"GET"`、`"POST"`、`"PUT"`、`"DELETE"`など）。大文字と小文字を無視
- `path` - URLパスパターン。 `:param`形式でパスパラメータを定義する
- `handler` - Controller メソッド式
- `opts` - ルートオプション(オプション)
**パスパターン**
- `/users` - 静的パス
- `/users/:id` - 単一パラメータ
- `/users/:userId/posts/:postId` - マルチパラメータ
**例**
```go
//デフォルトルート
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

//ネストしたパス
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

#### ルートオプション
`route.WithInterceptors`を使用して、特定のルートにのみInterceptorを適用できます。

```go
import "github.com/NARUBROWN/spine/pkg/route"

// ルート別インターセプタの適用
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// nilポインタ→ContainerからResolve
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

//複数のInterceptorを適用する
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

グローバルインターセプターを登録します。グローバルインターセプタは**ルーティング前**で実行されます。登録順に`PreHandle`を実行し、逆順に`PostHandle`と`AfterCompletion`を実行します。
同じタイプが複数回登録されると、最初の登録のみが維持されます。 nilポインタとして登録すると、ContainerでResolveされます。
**パラメータ**
- `interceptors` - Interceptor インスタンス(可変引数)
**実行順序**
1. グローバル Interceptor PreHandle (登録順序)2. Router
3. ルート Interceptor PreHandle (登録順序)
4. Controllerの実行
5. ルートインターセプター PostHandle (逆順)
6. グローバル Interceptor PostHandle (逆順)
**例**
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

### Transport


```go
Transport(fn func(any))
```

HTTP Transport（Echo）拡張フックを登録します。 Echoインスタンスに直接アクセスして、ミドルウェアや設定を追加できます。
**パラメータ**
- `fn` - Echo インスタンスを受け取るコールバック関数
**例**
```go
import "github.com/labstack/echo/v4"
import "github.com/labstack/echo/v4/middleware"

app.Transport(func(e any) {
    echo := e.(*echo.Echo)
    
// Echoミドルウェアの追加
    echo.Use(middleware.RequestID())
    
//静的ファイルサービス
    echo.Static("/static", "public")
})
```

### RegisterTransport


```go
RegisterTransport(t core.CustomTransport)
```

Spine HTTPパイプラインの外部で独立して実行されるカスタムトランスポートを登録します。 gRPC、GraphQLなどの別々のプロトコルをSpineアプリケーションに統合するために使用します。
**パラメータ**
- `t` - `core.CustomTransport` インタフェース実装
**CustomTransport インターフェイス**
```go
// core/transport.go
type CustomTransport interface {
    // Init は DI Container の準備後に呼び出されます。
    Init(container Container) error
    // Start は Init の後、別 goroutine で呼び出されます。
    Start() error
    // Stop は Graceful Shutdown 時に呼び出されます。
    Stop(ctx context.Context) error
}

type Container interface {
    Resolve(t reflect.Type) (any, error)
}
```

**例**
```go
type GRPCTransport struct {
    server *grpc.Server
}

func (t *GRPCTransport) Init(container core.Container) error {
// Container でのサービス Resolve
    svc, err := container.Resolve(reflect.TypeOf((*MyService)(nil)))
    if err != nil {
        return err
    }
    t.server = grpc.NewServer()
    RegisterMyServiceServer(t.server, svc.(*MyService))
    return nil
}

func (t *GRPCTransport) Start() error {
    lis, _ := net.Listen("tcp", ":9090")
    return t.server.Serve(lis)
}

func (t *GRPCTransport) Stop(ctx context.Context) error {
    t.server.GracefulStop()
    return nil
}

app.RegisterTransport(&GRPCTransport{})
```

### Consumers


```go
Consumers() *consumer.Registry
```

イベントコンシューマレジストリを返します。 Kafka、RabbitMQなどのメッセージブローカーからイベントを受信するハンドラーを登録します。
**戻り値**
- `*consumer.Registry` - コンシューマーレジストリ
**例**
```go
// イベントコンシューマの登録
app.Consumers().Register(
    "order.created",            // トピック/イベント名
    (*OrderConsumer).OnCreated, // ハンドラーメソッド
)

app.Consumers().Register(
    "stock.created",
    (*StockConsumer).OnCreated,
)
```

#### コンシューマハンドラ
コンシューマハンドラはHTTPコントローラと同様のシグネチャを持ちます。

```go
type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

// イベントハンドラ
func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("イベント受信:", eventName)
    log.Println("注文ID:", event.OrderID)
    return nil
}

// イベント DTO
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}
```

### WebSocket


```go
WebSocket() *ws.Registry
```

WebSocket レジストリを返します。 WebSocketパスとハンドラを登録します。
**戻り値**
- `*ws.Registry` - WebSocketレジストリ
**例**
```go
if err := app.WebSocket().Register("/ws/chat", (*ChatController).OnMessage); err != nil {
    log.Fatal(err)
}
```

#### WebSocketハンドラ
WebSocketハンドラにはHTTPコントローラと同様のシグネチャがあります。 `ws` パッケージのタイプをパラメータとして使用します。

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

WebSocketはHTTPサーバーなどのEchoインスタンスを共有し、ブートストラップ時にTransport Hookを介してEchoに自動的にマウントされます。
### Run


```go
Run(opts boot.Options) error
```

アプリケーションを起動します。 HTTPサーバー、WebSocketランタイム、イベントコンシューマーランタイム、カスタムトランスポートを一緒に駆動します。
**パラメータ**
- `opts` - ブートオプション(`boot.Options`)
**戻り値**
- `error` - サーバーの起動に失敗したときのエラー
**例**
```go
if err := app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
}); err != nil {
    log.Fatal(err)
}
```


## boot.Options

アプリケーションのブートストラップオプションです。

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### 構造体の定義

```go
type Options struct {
    // サーバーがバインドするアドレス（例: ":8080"）
    Address string

    // Graceful Shutdown を有効にするかどうか
    EnableGracefulShutdown bool

    // Graceful Shutdown 時の最大待機時間
    ShutdownTimeout time.Duration

    // Kafka イベントインフラの設定
    // nil の場合、Kafka は構成されません
    Kafka *KafkaOptions

    // RabbitMQ イベントインフラの設定
    // nil の場合、RabbitMQ は構成されません
    RabbitMQ *RabbitMqOptions

    // HTTP Runtime 専用の設定
    // nil の場合、HTTP サーバーは実行されません
    HTTP *HTTPOptions
}

type HTTPOptions struct {
    // HTTP API のグローバル Prefix（例: "/api/v1"）
    // 空の場合、Prefix は適用されません。
    GlobalPrefix string

    // Recover ミドルウェアを無効にするか（デフォルト: false = 有効）
    DisableRecover bool
}
```

### GlobalPrefix検証ルール
ブートストラップ時に`GlobalPrefix`の検証が行われます。
- `"/"`で始める必要があります
- `":"`（Pathパラメータ）を含めることはできません
- `"*"`（ワイルドカード）を含めることはできません
- 最後の`"/"`は自動的に削除されます

```go
// ✓ 有効
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// ✗ panic が発生
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // '/' で始まらない
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // パスパラメータを含む
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // ワイルドカードを含む
```

### デフォルトの使用

```go
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

### Graceful Shutdown


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

Graceful Shutdownが有効な場合：
- `SIGINT`、`SIGTERM`シグナルを受信します
- 進行中の要求が完了するのを待ちます。
- WebSocket接続にCloseメッセージを送信する
- Custom Transportの`Stop()`を呼び出します
- `ShutdownTimeout`後に強制終了します（デフォルト：10秒）
### Recoverミドルウェア
デフォルトでは、Echoのpanic recoverミドルウェアが有効になっています。パニック発生時に500の応答に変換します。

```go
// Recover を無効化
HTTP: &boot.HTTPOptions{
    DisableRecover: true,
}
```


## Kafkaの設定
### KafkaOptions


```go
type KafkaOptions struct {
    // Kafka ブローカーのアドレス一覧
    Brokers []string

    // イベント消費（Consumer）の設定
    // nil の場合、Kafka Consumer は有効になりません
    Read *KafkaReadOptions

    // イベント 発行(Producer) 設定
    // nil の場合、Kafka にイベントを発行しません
    Write *KafkaWriteOptions
}

type KafkaReadOptions struct {
    // Kafka Consumer Group ID
    GroupID string
}

type KafkaWriteOptions struct {
    // イベント名の前に付ける Topic Prefix
    TopicPrefix string
}
```

### 例

```go
app.Run(boot.Options{
    Address: ":8080",
    Kafka: &boot.KafkaOptions{
        Brokers: []string{"localhost:9092"},
        Read: &boot.KafkaReadOptions{
            GroupID: "my-consumer-group",
        },
        Write: &boot.KafkaWriteOptions{
            TopicPrefix: "myapp.",
        },
    },
    HTTP: &boot.HTTPOptions{},
})
```


## RabbitMQの設定
### RabbitMqOptions


```go
type RabbitMqOptions struct {
    // RabbitMQ AMQP 接続文字列
    // 例: amqp://guest:guest@localhost:5672/
    URL string

    // イベント消費（Consumer）の設定
    // nil の場合、RabbitMQ Consumer は有効になりません
    Read *RabbitMqReadOptions

    // イベント 発行(Publisher) 設定
    // nil の場合、RabbitMQ にイベントを発行しません
    Write *RabbitMqWriteOptions
}

type RabbitMqReadOptions struct {
    // キューがバインドされる Exchange 名
    Exchange string
}

type RabbitMqWriteOptions struct {
    // イベントを発行する Exchange 名
    Exchange string
}
```

### 例

```go
app.Run(boot.Options{
    Address: ":8080",
    RabbitMQ: &boot.RabbitMqOptions{
        URL: "amqp://guest:guest@localhost:5672/",
        Read: &boot.RabbitMqReadOptions{
            Exchange: "stock-exchange",
        },
        Write: &boot.RabbitMqWriteOptions{
            Exchange: "stock-exchange",
        },
    },
    HTTP: &boot.HTTPOptions{},
})
```


## イベント発行
Controllerでドメインイベントを発行できます。
### DomainEvent インターフェイス

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

type DomainEvent interface {
    Name() string
    OccurredAt() time.Time
}
```

### イベント定義

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

### Controllerから発行

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

func (c *OrderController) Create(ctx context.Context, req *CreateOrderRequest) Order {
    order := c.repo.Save(req)
    
    // イベント 発行
    publish.Event(ctx, OrderCreated{
        OrderID: order.ID,
        At:      time.Now(),
    })
    
    return order
}
```

イベントは、Controller の実行完了後に `PostExecutionHook` から一括発行されます。 `publish.Event()`は`context.Context`に注入された`EventBus`にイベントを収集し、実行がエラーなしで完了すると登録されたPublisher（Kafka / RabbitMQ）を介して送信されます。

## 完全な例

```go
package main

import (
    "context"
    "encoding/json"
    "log"
    "strings"
    "sync"
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/event/publish"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
    "github.com/NARUBROWN/spine/pkg/route"
    "github.com/NARUBROWN/spine/pkg/ws"
)

func main() {
    app := spine.New()

    // コンストラクタ登録
    app.Constructor(
        NewUserController,
        NewOrderConsumer,
        NewChatController,
    )

    // HTTP ルート 登録
    app.Route("GET", "/users", (*UserController).GetUserQuery)
    app.Route("GET", "/users/:id", (*UserController).GetUser,
        route.WithInterceptors(&LoggingInterceptor{}),
    )
    app.Route("POST", "/orders/:orderId", (*UserController).CreateOrder)

    // グローバル Interceptor の登録
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
            AllowMethods: []string{"GET", "POST", "OPTIONS"},
            AllowHeaders: []string{"Content-Type"},
        }),
    )

    // イベントコンシューマの登録
    if err := app.Consumers().Register("order.created", (*OrderConsumer).OnCreated); err != nil {
        log.Fatal(err)
    }

    // WebSocket 登録
    if err := app.WebSocket().Register("/ws/chat", (*ChatController).OnMessage); err != nil {
        log.Fatal(err)
    }

    // サーバーの実行
    if err := app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        RabbitMQ: &boot.RabbitMqOptions{
            URL: "amqp://guest:guest@localhost:5672/",
            Read: &boot.RabbitMqReadOptions{
                Exchange: "stock-exchange",
            },
            Write: &boot.RabbitMqWriteOptions{
                Exchange: "stock-exchange",
            },
        },
        HTTP: &boot.HTTPOptions{},
    }); err != nil {
        log.Fatal(err)
    }
}

// Controller
type UserController struct{}

func NewUserController() *UserController {
    return &UserController{}
}

func (c *UserController) CreateOrder(ctx context.Context, orderId path.Int) httpx.Response[string] {
    publish.Event(ctx, OrderCreated{
        OrderID: orderId.Value,
        At:      time.Now(),
    })
    return httpx.Response[string]{Body: "OK"}
}

// Event
type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}

func (e OrderCreated) Name() string        { return "order.created" }
func (e OrderCreated) OccurredAt() time.Time { return e.At }

// Consumer
type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("イベント受信:", eventName)
    log.Println("注文ID:", event.OrderID)
    return nil
}

// WebSocket
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


## ブートストラップの順序
`Run()`を呼び出すと、次の順序で初期化されます。
1. IoC Containerの作成
2. コンストラクタの登録
3. イベントインフラストラクチャの設定(設定されている場合)   - Kafka Publisher / Consumer
   - RabbitMQ Publisher / Consumer
4. Custom Transport 初期化 (`Init()` 呼び出し)
5. Custom Transport スタート(`Start()` - 別途goroutine)
6. HTTP Runtime の構成(設定されている場合)
   - Routerの設定とHandlerMetaの作成
   - ルート Interceptor Resolve (nil ポインタ → Container)
   - 冗長パス検証(`assertNoAmbiguousRoute`)
   - Controller Warm-up (依存関係の事前解決)
   - HTTP Pipelineの設定(ArgumentResolver、ReturnValueHandlerの登録)
   - グローバルインターセプタ登録(重複タイプの削除、nilポインタのResolve)
7. WebSocket Runtime の構成 (登録済みの場合)
   - WS専用のPipelineの作成
   - Echo Transport Hookによる自動マウント
8. Echo Adapter マウント (Recover ミドルウェアを含む)
9. Consumer Runtimeの起動(設定されている場合)
10. HTTPサーバーの起動
### Graceful Shutdown市
1. `SIGINT`/`SIGTERM` シグナル受信
2. WebSocket 接続への Close メッセージの送信
3. イベントコンシューマランタイムの停止
4. Custom Transport `Stop()` 呼び出し
5. HTTP サーバー Shutdown (タイムアウトまで待機)
6. イベント Publisher リソースのクリーンアップ
7. 終了

## 注
- [Interceptor](/ja/reference/api/interceptor) - Interceptor インターフェイス
- [実行パイプライン](/ja/learn/core-concepts/pipeline) - リクエスト処理フロー
- [IoC Container](/ja/learn/getting-started/intro) - 依存性注入
