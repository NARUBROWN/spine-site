# spine.App

::: info
`app.Route` は互換性のため維持されますが非推奨です。[ルートの移行](/ja/learn/migration/preview-controller-routes)、[入力の移行](/ja/learn/migration/v0.7.1-preview)、[OpenAPI](/ja/reference/api/openapi)を参照してください。
:::

`boot.HTTPOptions.OpenAPI.UI` で Swagger UI と ReDoc を選択できます。[HTTP v3 と起動オプション](/ja/learn/migration/preview-features#boot)で実行例、TLS、HTTP v3 の変更を確認してください。

`App`は、コンストラクタ、HTTPルート、インターセプター、イベントコンシューマー、WebSocketハンドラー、ユーザー定義のトランスポートを登録し、アプリケーションを実行するためのエントリーポイントです。このリファレンスでは、Spine v0.7.1の公開APIと起動オプションを扱います。

```go
import (
    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
)
```

## インターフェース定義

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

`Route`のオプションは、アプリのコードから`pkg/route`の関数で渡します。戻り値の型が内部パッケージにある`Consumers()`と`WebSocket()`も、型を直接宣言せずにメソッドを続けて呼び出せます。

## コンストラクタ

### New

```go
func New(options ...Option) App
```

`spine.New(options ...Option)` に必要な実装を渡します。HTTPアプリは `spine.New(echoplatform.Option())` を使います。HTTPを使わないワーカーはHTTPオプションを省き、必要なイベントfactoryを登録します。

新しいSpineアプリケーションのインスタンスを作成します。

**戻り値**

- `App` - アプリケーションのインスタンス

**例**

```go
app := spine.New(echoplatform.Option())
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

## 実装の選択オプション {#platform-options}

HTTP には Echo または net/http、WebSocket には独立した Gorilla 実装を選択します。WS ルートには HTTP の upgrade 対応と WS factory の両方が必要です。検証には `playground.New()` の結果を `spine.WithValidator` に渡します。

| オプション | 実装 |
| --- | --- |
| `spine.WithHTTPAdapter(factory)` | `echoplatform.Option()` / `nethttpplatform.Option()` / `contract/http` |
| `spine.WithWebSocketAdapter(factory)` | `gorillaplatform.Option()` / `contract/websocket` |
| `spine.WithEventAdapter(name, factory, options...)` | Kafka / RabbitMQ / NATS / `contract/event` |
| `spine.WithValidator(validator)` | playground / `contract/validator` |

[プラットフォームとDTO検証の選択](/ja/learn/getting-started/platforms)

## メソッド

### Constructor

```go
Constructor(constructors ...any)
```

生成関数と `constructor.Custom`、`Repository`、`Service`、`Controller`、`Interceptor` の役割マーカーを受け取ります。関数の戻り値は一つです。オブジェクトの役割マーカーは構造体ポインターと `Constructor(依存関係...) *自分の型` を使います。必要な依存関係を登録し、Controller と Interceptor の追加契約も満たしてください。次は従来の生成関数の例です。[役割別登録の例](/ja/learn/tutorial/3-dependency-injection)も参照してください。

```go
// 依存関係のないコンストラクター
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// 依存関係のあるコンストラクター
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

// イベントコンシューマーのコンストラクター
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

HTTPルートを登録します。`method`の前後の空白を取り除き、大文字に変換します。

**引数**

- `method` - HTTPメソッド（`"GET"`、`"POST"`、`"PUT"`、`"DELETE"`など）。大文字と小文字は区別しません
- `path` - URLパスのパターン。`:param`形式でパスパラメータを定義します
- `handler` - コントローラーのメソッド式
- `opts` - ルートオプション（省略可能）

**パスのパターン**
- `/users` - 静的パス
- `/users/:id` - 単一のパラメータ
- `/users/:userId/posts/:postId` - 複数のパラメータ

**例**

以下の `Route` はそれぞれ別の登録例です。同じメソッドとパスを重複登録しないでください。

```go
// 基本ルート
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// ネストされたパス
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

#### ルートオプション

`route.WithInterceptors`で、特定のルートだけにインターセプターを適用します。

```go
import "github.com/NARUBROWN/spine/pkg/route"

// ルートごとにインターセプターを適用
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// 型付き nil ポインターはコンテナーから取得
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// 複数のインターセプターを適用
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

HTTPリクエストとWebSocketメッセージにグローバルインターセプターを登録します。`app.Interceptor(...)`は`app.InterceptorFor(boot.InterceptorAll, ...)`と同じです。登録順に`PreHandle`を実行し、逆順に`PostHandle`、`BeforeResponse`、`AfterCompletion`を実行します。

同じポインターのインスタンスを複数のスコープに登録すると、スコープをまとめて1回実行します。同じ型でも、異なるインスタンスはそれぞれ実行します。`(*AuthInterceptor)(nil)`のような型付きnilポインターを登録すると、コンテナから共有インスタンスを取得して使用します。

**引数**

- `interceptors`: インターセプターのインスタンスの一覧

**実行順序**

1. グローバルインターセプターの`PreHandle`を登録順に実行します。
2. ルーティング後に入力値を解釈します。
3. ルートインターセプターの`PreHandle`を登録順に実行します。
4. コントローラーを実行してレスポンスを準備した後、実行後フックを呼び出します。
5. ルートインターセプター、グローバルインターセプターの順に`PostHandle`を実行します。それぞれ登録の逆順です。
6. 同じ逆順で`BeforeResponse`を実行した後、実際のレスポンスを書き込みます。
7. レスポンス処理後、同じ逆順で`AfterCompletion`を実行します。

エラーや処理中断時の動作は、[インターセプターリファレンス](/ja/reference/api/interceptor)を参照してください。

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

### InterceptorFor

```go
InterceptorFor(scope boot.InterceptorScope, interceptors ...core.Interceptor)
```

グローバルインターセプターを適用するトランスポートを選択します。イベントコンシューマーには適用しません。

| スコープ | 適用対象 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTPリクエスト |
| `boot.InterceptorWebSocket` | WebSocketメッセージと、サポートされる接続前の処理 |
| `boot.InterceptorAll` | 両方のスコープ |

```go
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsAuthInterceptor)
app.InterceptorFor(boot.InterceptorAll, loggingInterceptor)
```

### WithEcho

```go
echoplatform.WithEcho(fn func(*echo.Echo)) echoplatform.EchoOption
```

Echo の拡張はプラットフォーム作成時に型付きの `WithEcho` オプションで登録します。既存の `app := spine.New(echoplatform.Option())` を以下のコードに置き換え、その後のコンストラクターとルートの登録は維持してください。`App.Transport` は Spine v0.6.0 で削除されました。

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

プラットフォームオプションで追加した native Echo ルートは、Spine の HTTP インターセプターと応答 staging を経由せず、静的な Spine ルート契約にも含まれません。実際の動作を別途確認してください。

### RegisterTransport

```go
RegisterTransport(t core.CustomTransport)
```

HTTPパイプラインと独立して実行するトランスポートを登録します。たとえば、gRPCサーバーをSpineの依存性注入と起動および終了処理に接続するときに使用します。

**引数**

- `t` - `core.CustomTransport`インターフェースの実装

**CustomTransportインターフェース**
```go
// core/transport.go
type CustomTransport interface {
    // Init は DI コンテナーの準備後に呼び出されます。
    Init(container Container) error
    // Start は Init の後、別のゴルーチンで呼び出されます。
    Start() error
    // Stop は正常終了時に呼び出されます。
    Stop(ctx context.Context) error
}

type Container interface {
    Resolve(t reflect.Type) (any, error)
}
```

**例**

`Stop` は実行中の RPC を待ち、終了コンテキストの期限が切れた場合はサーバーを強制停止します。`MyService` とサービス登録関数はアプリで実装します。

```go
type GRPCTransport struct {
    server *grpc.Server
}

func (t *GRPCTransport) Init(container core.Container) error {
    // コンテナーからサービスを取得
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
    done := make(chan struct{})
    go func() {
        t.server.GracefulStop()
        close(done)
    }()
    select {
    case <-done:
        return nil
    case <-ctx.Done():
        t.server.Stop()
        return ctx.Err()
    }
}

app.RegisterTransport(&GRPCTransport{})
```

### RunContext / Prepare

```go
RunContext(ctx context.Context, opts boot.Options) error
Prepare(ctx context.Context, opts boot.Options) (PreparedApplication, error)

type PreparedApplication interface {
    HTTPAdapter() httpcontract.HTTPAdapter
    Close(ctx context.Context) error
}

func NetHTTPHandler(prepared PreparedApplication) (http.Handler, error)
```

`RunContext` は context のキャンセルで正常終了を開始します。`Prepare` はリスナーなしでアプリを準備します。`HTTPAdapter()` は準備したアダプターを返し、HTTP が無効なら nil です。`spine.NetHTTPHandler(prepared)` は対応するアダプターの `http.Handler` とエラーを返します。アダプターを重複して起動または終了せず、外部サーバーの終了と準備結果の `Close` は呼び出し元が管理してください。consumer と custom transport の Start は実行しませんが、設定によってブローカー準備検査や custom Init が接続する場合があります。`httpcontract` は `github.com/NARUBROWN/spine/contract/http` です。

### Consumers

```go
Consumers() *consumer.Registry
```

イベントコンシューマーを登録するためのレジストリを返します。KafkaやRabbitMQから受信するイベント名とハンドラーを登録します。コンシューマーのコンストラクタも`Constructor`で登録する必要があります。

**戻り値**

- `*consumer.Registry` - コンシューマーレジストリ

**例**

```go
// イベントコンシューマーを登録
app.Consumers().Register(
    "order.created",            // トピック/イベント名
    (*OrderConsumer).OnCreated, // ハンドラーメソッド
)

app.Consumers().Register(
    "stock.created",
    (*StockConsumer).OnCreated,
)
```

#### イベントハンドラー

イベントハンドラーは、標準コンテキスト、イベント名、イベントDTOを引数として受け取れます。

```go
type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

// イベントハンドラー
func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("イベント受信:", eventName)
    log.Println("注文 ID:", event.OrderID)
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

WebSocketレジストリを返します。WebSocketのパスとハンドラーを登録します。

**戻り値**

- `*ws.Registry` - WebSocketレジストリ

**例**

```go
if err := app.WebSocket().Register("/ws/chat", (*ChatController).OnMessage); err != nil {
    log.Fatal(err)
}
```

#### WebSocketハンドラー

WebSocketハンドラーは、`ws`パッケージの接続IDとメッセージDTOを引数として受け取ります。次の例では接続ごとの送信オブジェクトを保存し、メッセージをすべての接続に送信します。`ChatController`のコンストラクタは`Constructor`で登録します。

この例には標準の `context`、`encoding/json`、`strings`、`sync`、`time` のインポートも必要です。接続一覧はメモリー内にあり、切断された接続は次の送信失敗時に削除されます。

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

WebSocket のパスは HTTP プラットフォームに登録されるため、`boot.Options.HTTP` と upgrade に対応する HTTP プラットフォームが必要です。オリジン、接続数、認証の設定は[セキュリティ設定](/ja/reference/security-configuration#websocket)を参照してください。

### Validate

```go
Validate(opts boot.Options) error
```

ネットワークに接続せずHTTP、WebSocket制限、イベントfactory契約と共通方針、検証器の登録を検査します。`Run` も同じ検査を行います。ブローカー固有の `Config` はプラットフォームの `NewFactory` が先に検査するため、生成エラーも確認します。

bootオプションのエラーは `*boot.ConfigError.Issues` の `Path`、`Code`、`Message`、`Hint` で確認します。イベント、HTTP、WebSocket factoryや検証器の契約エラーも返すため、公開エラーに対して `errors.Is` と `errors.As` を使います。有効な構成では `nil` を返します。

`Validate`はコンストラクタの依存関係を生成せず、ブローカーにも接続しません。コンストラクタとルートの適合性、DI構成、実際のインフラへの接続まで成功したとは判断できません。

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

登録した構成と`boot.Options`に従い、HTTPサーバー、WebSocket、イベントコンシューマー、ユーザー定義のトランスポートを起動します。実行中は終了シグナルまたはランタイムエラーを待機します。設定、初期化、実行、終了に失敗すると、エラーを返します。

```go
if err := app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
}); err != nil {
    log.Fatal(err)
}
```

## boot.Options

JSON 文書と内蔵 UI のオプションは[ランタイム OpenAPI 設定](/ja/reference/api/openapi#options)を参照してください。[UI 登録例](/ja/reference/api/openapi#tools)に import と設定を示します。

`boot.Options` はHTTP実行と終了方針を設定します。HTTP実行時に `HTTP` を指定します。イベント接続と役割は外部プラットフォームの `Config` と `spine.WithEventAdapter` で選択します。

```go
import "github.com/NARUBROWN/spine/pkg/boot"
```

### 構造体定義

```go
type Options struct {
    Address                string
    EnableGracefulShutdown bool
    ShutdownTimeout        time.Duration
    HTTP                   *HTTPOptions
}

type HTTPOptions struct {
    TLS               *tls.Config
    OpenAPI           OpenAPIOptions
    GlobalPrefix      string
    DisableRecover    bool
    ReadHeaderTimeout time.Duration
    ReadTimeout       time.Duration
    WriteTimeout      time.Duration
    IdleTimeout       time.Duration
    MaxHeaderBytes    int
    MaxBodyBytes      int64
    MultipartMemoryBytes int64
    WebSocket         WebSocketOptions
}
```

| `Options`フィールド | 意味とデフォルトの動作 |
| --- | --- |
| `Address` | HTTPサーバーがリッスンするアドレス。例: `":8080"` |
| `EnableGracefulShutdown` | `true`の場合、HTTPサーバーで`SIGINT`、`SIGTERM`を受け取り、正常終了します。デフォルトは`false` |
| `ShutdownTimeout` | HTTPとユーザー定義のトランスポートの終了時に使用する待機時間。`0`の場合は10秒。負の値は指定できません |
| `HTTP` | HTTPとWebSocketの設定。`nil`の場合はHTTPサーバーが無効 |

| `HTTPOptions`フィールド | `0`または省略時 | 制約 |
| --- | --- | --- |
| `TLS` | `nil`、平文 HTTP | 証明書または証明書選択コールバックを持つ `*tls.Config` |
| `OpenAPI` | 無効 | 文書と任意の UI の設定 |
| `MultipartMemoryBytes` | 32 MiB | 正数または 0。リクエスト全体のメモリ上限ではない |
| `GlobalPrefix` | プレフィックスなし | 以下のパス規則を適用 |
| `DisableRecover` | `false`。panicをHTTP 500に変換するリカバリーミドルウェアを使用 | `true`の場合はミドルウェアを無効化 |
| `ReadHeaderTimeout` | 5秒 | 負の値は指定不可 |
| `ReadTimeout` | 30秒 | 負の値は指定不可 |
| `WriteTimeout` | 30秒 | 負の値は指定不可 |
| `IdleTimeout` | 120秒 | 負の値は指定不可 |
| `MaxHeaderBytes` | 1 MiB | 負の値は指定不可 |
| `MaxBodyBytes` | 32 MiB | 負の値の場合は本文サイズの制限を無効化 |
| `WebSocket` | [WebSocketのデフォルト値](/ja/reference/security-configuration#websocket) | `boot.WebSocketOptions` |


net/http プラットフォームは `DisableRecover: true` をサポートしません。

### GlobalPrefixの検証規則

`Validate`と`Run`は、次の規則に従わない値を`HTTP_GLOBAL_PREFIX_INVALID`設定エラーとして返します。空文字列の場合はプレフィックスを適用しません。

- `"/"`で始まる必要があります
- `":"`（パスパラメータ）を含めることはできません
- `"*"`（ワイルドカード）を含めることはできません
- 末尾の`"/"`は自動で取り除かれます

```go
// 有効な接頭辞
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// Validate と Run が設定エラーを返す
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // '/' で始まっていない
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // パスパラメーターを含む
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // ワイルドカードを含む
```

### 基本的な使用方法

```go
app.Run(boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{},
})
```

### 正常終了

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

HTTPの正常終了を有効にすると、`SIGINT`、`SIGTERM`を受け取って新しいリクエストの受け入れを停止し、処理中のリクエストを待機します。WebSocket接続を閉じ、イベントコンシューマーを停止した後、ユーザー定義のトランスポートの`Stop(ctx)`を呼び出します。

`ShutdownTimeout`は、HTTPとユーザー定義のトランスポートの終了コンテキストに適用します。コンシューマーの`Stop`は、処理、ACK/NACK、リーダーが終了するまで待機するため、この値をプロセス全体の強制終了期限と解釈しないでください。HTTPを使用せず、コンシューマーやユーザー定義のトランスポートだけを実行する場合も終了シグナルを処理します。

### Recoverミドルウェア

デフォルトでは、panicをHTTP 500レスポンスに変換するリカバリーミドルウェアが有効です。

```go
// Recover を無効化
HTTP: &boot.HTTPOptions{
    DisableRecover: true,
}
```

## Kafka設定

### factoryの生成と登録

`kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"` をimportします。`Config.Consume` と `Config.Publish` で役割を選び、`Brokers` を指定します。コンシューマーには `GroupID` も必要です。以下は `BuildApplication` 内で使用し、`echoplatform`、`spine`、`boot`、`time` もimportします。

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

### 方針と制約

Kafkaプラットフォームは標準でTLS 1.2以上を適用します。CA、mTLS、SASLには `TLS`、`Dialer`、`Transport` を設定します。`AllowInsecureTransport: true` は隔離したローカル平文接続にのみ使い、明示的なTLSと併用しません。`NewFactory` は設定だけを検査します。`Prepare` と `Run` は登録されたコンシューマーのreaderを準備するときにブローカーとトピックを確認します。Kafka発行専用アプリは接続せずに起動できるため、実際の発行で接続と配送を別途確認してください。

`Config.TopicPrefix` は発行名と消費側の購読の両方に接頭辞を付けます。両factoryに `prod.` を設定する場合、アプリには `order.created` を登録し、ブローカーに `prod.order.created` を準備します。区切り文字は接頭辞に含めます。

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})` はリーダーやACK/NACKの失敗後の再接続を制御します。標準値は初回100ms、最大5秒、倍率2、ジッター0.2、`MaxAttempts: 0` による無制限の転送再試行です。ハンドラーの再試行回数やDLQ方針は設定しません。`WithEventSettlementTimeout` の標準ACK/NACK制限は5秒です。Kafkaは後続offsetのcommitで失敗レコードを飛ばさないため、処理不能なレコードがパーティションを止めることがあります。

## RabbitMQ設定

### factoryの生成と登録

`rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"` をimportします。共通の `Config.Exchange` と `Consume`、`Publish` を設定します。標準では `amqps://` が必要です。ローカルの `amqp://` は `AllowInsecureTransport: true` で明示的に許可します。以下は `BuildApplication` 内で使います。

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

### 方針と制約

`PrefetchCount` を省略すると未確認メッセージはコンシューマーごとに1件です。標準方針は `rabbitmqplatform.FailureReject` です。`FailureRequeue` は処理不能なメッセージを無期限に再配信する可能性があります。`DeadLetter` の交換機は事前に準備します。`TopicPrefix` は発行routing keyと購読bindingに、`QueuePrefix` はキュー名に適用します。

発行器は永続メッセージ、mandatory routing、publisher confirmを使います。`OperationTimeout` の標準値は5秒です。失敗メッセージを自動再発行する `PublisherRetry` オプションはありません。確認喪失後のアプリによる再試行は重複を生むため、コンシューマーを冪等にします。

## イベント発行 {#event-publishing}

コントローラーでドメインイベントを収集し、登録済みのKafkaやRabbitMQのパブリッシャーに送信できます。

### DomainEventインターフェース

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

type DomainEvent interface {
    Name() string
    OccurredAt() time.Time
}
```

### イベントの定義

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

### コントローラーから発行

```go
import "github.com/NARUBROWN/spine/pkg/event/publish"

func (c *OrderController) Create(ctx context.Context, req *CreateOrderRequest) httpx.Response[Order] {
    order := c.repo.Save(req)

    // イベントを発行
    publish.Event(ctx, OrderCreated{
        OrderID: order.ID,
        At:      time.Now(),
    })

    return httpx.Response[Order]{Body: order}
}
```

`publish.Event()`は、`context.Context`に接続されたイベントバスにイベントを収集します。コントローラーの実行とレスポンスの準備が成功すると、実行後フックで登録済みのKafkaまたはRabbitMQのパブリッシャーにまとめて送信します。この送信は`BeforeResponse`より前に実行されるため、DBトランザクションのコミットと原子的にまとめられるわけではありません。原子的な処理が必要な場合は、トランザクショナルアウトボックスを構成してください。

## CLIプロジェクトでの使用

[最初のアプリを作成する](/ja/learn/getting-started/first-app)で生成したプロジェクトでは、`internal/application/application.go`の`BuildApplication`でアプリを構成し、ルートの`main.go`で`Validate`のエラーを確認した後に`Run`を呼び出します。次のコマンドでプロジェクトを確認できます。

```sh
spine doctor
spine contract check
spine verify
```

生成される`BuildApplication`の基本形は次のとおりです。

```go
package application

import (
	controller "example.com/my-app/src/controller"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"os"
)

func BuildApplication() (spine.App, boot.Options, error) {
	app := spine.New(echoplatform.Option())
	app.Constructor(
		constructor.Controller(&controller.HealthController{}),
	)
	address := ":8080"
	if port := os.Getenv("SPINE_PORT"); port != "" {
		address = ":" + port
	}
	return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
```

## 起動と終了の順序

`Run`はオプションの事前検証後、依存性注入コンテナとイベントパブリッシャーを構成します。ユーザー定義のトランスポートの`Init`を呼び出し、HTTPとWebSocketのルートおよびインターセプターを解釈して、必要なコントローラーを事前に生成します。登録済みのコンシューマーがある場合は、ブローカーのランタイムも検証します。

この準備が終わると、コンシューマーとユーザー定義のトランスポートの`Start`を別のゴルーチンで実行し、最後にHTTPサーバーを起動します。HTTPルートは、同じメソッドでパスが曖昧に重なると起動に失敗します。たとえば、`/users/:id`と`/users/me`は重複するパスとして検出します。

終了時は、WebSocketとHTTPへのリクエストの受け入れを先に停止し、コンシューマーの停止を待ってから、ユーザー定義のトランスポートの`Stop`を初期化の逆順に呼び出します。その後、イベントパブリッシャーのリソースを解放します。具体的な実装は、[v0.7.1の起動および終了コード](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/bootstrap/bootstrap.go)を参照してください。

## 制約とエラー

- コンストラクタの戻り値は正確に1つである必要があります。`(T, error)`を返すコンストラクタは登録できません。
- HTTP入力DTOはポインターで受け取り、成功レスポンスは`httpx.Response[T]`など、サポートするレスポンス型で返します。[コントローラーの書き方](/ja/learn/tutorial/2-controller)を参照してください。
- `Validate`が成功しても、`Run`でコンストラクタ、依存関係、ルート、ブローカー接続のエラーが発生する場合があります。両方のメソッドの戻り値のエラーを確認してください。
- WebSocketのパスを登録して`HTTP`を省略すると、`WEBSOCKET_HTTP_REQUIRED`設定エラーが発生します。
- `InterceptorFor`のスコープには、`InterceptorHTTP`、`InterceptorWebSocket`、`InterceptorAll`のいずれかを使用します。`0`やサポートされていないビットが含まれる場合は、`INTERCEPTOR_SCOPE_INVALID`設定エラーが発生します。
- ネットワーク送信、イベント発行、DBコミットは、1つの原子的な操作ではありません。再試行や重複処理への対応が必要かどうかは、アプリで判断する必要があります。

## 関連情報

- [インターセプター](/ja/reference/api/interceptor): 公開インターフェースと実行順序
- [実行パイプライン](/ja/learn/core-concepts/pipeline) - リクエスト処理の流れ
- [Spineの紹介](/ja/learn/getting-started/intro): 依存性注入と主要な概念
