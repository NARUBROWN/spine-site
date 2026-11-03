# spine.App

`App`は、コンストラクタ、HTTPルート、インターセプター、イベントコンシューマー、WebSocketハンドラー、ユーザー定義のトランスポートを登録し、アプリケーションを実行するためのエントリーポイントです。このリファレンスでは、Spine v0.6.5の公開APIと起動オプションを扱います。

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

HTTPにはEcho、WebSocketには独立したGorilla実装を選択します。WS登録にはHTTPのupgrade対応とWS factoryの両方が必要です。検証を有効にするには `playground.New()` の結果を `spine.WithValidator` に渡します。

| オプション | 実装 |
| --- | --- |
| `spine.WithHTTPAdapter(factory)` | `echoplatform.Option()` / `contract/http` |
| `spine.WithWebSocketAdapter(factory)` | `gorillaplatform.Option()` / `contract/websocket` |
| `spine.WithEventAdapter(name, factory, options...)` | Kafka / RabbitMQ / `contract/event` |
| `spine.WithValidator(validator)` | playground / `contract/validator` |

[プラットフォームとDTO検証の選択](/ja/learn/getting-started/platforms)

## メソッド

### Constructor

```go
Constructor(constructors ...any)
```

依存性注入コンテナにコンストラクタ関数を登録します。コンストラクタの引数の型に応じて、登録済みのほかのオブジェクトを注入します。

**引数**

- `constructors` - コンストラクタ関数（可変長引数）

**コンストラクタの規則**

- 関数である必要があります
- 戻り値は正確に1つである必要があります
- 引数の型を提供するコンストラクタも登録する必要があります

**例**

```go
// 의존성 없는 생성자
func NewUserRepository() *UserRepository {
    return &UserRepository{}
}

// 의존성 있는 생성자
func NewUserController(repo *UserRepository) *UserController {
    return &UserController{repo: repo}
}

// 이벤트 소비자 생성자
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

```go
// 기본 라우트
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).GetUser)
app.Route("POST", "/users", (*UserController).CreateUser)
app.Route("PUT", "/users/:id", (*UserController).UpdateUser)
app.Route("DELETE", "/users/:id", (*UserController).DeleteUser)

// 중첩 경로
app.Route("GET", "/users/:userId/posts/:postId", (*PostController).GetPost)
```

#### ルートオプション

`route.WithInterceptors`で、特定のルートだけにインターセプターを適用します。

```go
import "github.com/NARUBROWN/spine/pkg/route"

// 라우트별 인터셉터 적용
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&LoggingInterceptor{}),
)

// 타입이 있는 nil 포인터는 컨테이너에서 조회
app.Route(
    "POST",
    "/admin/users",
    (*AdminController).CreateUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// 여러 인터셉터 적용
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
    // Init은 DI 컨테이너 준비 이후 호출됩니다.
    Init(container Container) error
    // Start는 Init 이후 별도 고루틴에서 호출됩니다.
    Start() error
    // Stop은 정상 종료 시 호출됩니다.
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
    // 컨테이너에서 서비스 조회
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

`RunContext` は context のキャンセルで正常終了を開始します。`Prepare` はリスナーなしでアプリを準備し、`Handler()` と `Close(ctx)` を返します。consumer と custom transport の Start は実行しませんが、設定によって broker readiness と custom Init がネットワーク接続を開くことがあります。準備結果の Close と外部 HTTP サーバーの終了は呼び出し元が管理します。

### Consumers

```go
Consumers() *consumer.Registry
```

イベントコンシューマーを登録するためのレジストリを返します。KafkaやRabbitMQから受信するイベント名とハンドラーを登録します。コンシューマーのコンストラクタも`Constructor`で登録する必要があります。

**戻り値**

- `*consumer.Registry` - コンシューマーレジストリ

**例**

```go
// 이벤트 소비자 등록
app.Consumers().Register(
    "order.created",            // 토픽/이벤트 이름
    (*OrderConsumer).OnCreated, // 핸들러 메서드
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

// 이벤트 핸들러
func (c *OrderConsumer) OnCreated(
    ctx context.Context,
    eventName string,
    event OrderCreated,
) error {
    log.Println("이벤트 수신:", eventName)
    log.Println("주문 ID:", event.OrderID)
    return nil
}

// 이벤트 DTO
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

WebSocketはHTTPサーバーと同じEchoインスタンスにパスを登録するため、`boot.Options.HTTP`が必要です。オリジン、接続数、認証の設定は、[セキュリティ設定](/ja/reference/security-configuration#websocket)を参照してください。

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

| `Options`フィールド | 意味とデフォルトの動作 |
| --- | --- |
| `Address` | HTTPサーバーがリッスンするアドレス。例: `":8080"` |
| `EnableGracefulShutdown` | `true`の場合、HTTPサーバーで`SIGINT`、`SIGTERM`を受け取り、正常終了します。デフォルトは`false` |
| `ShutdownTimeout` | HTTPとユーザー定義のトランスポートの終了時に使用する待機時間。`0`の場合は10秒。負の値は指定できません |
| `HTTP` | HTTPとWebSocketの設定。`nil`の場合はHTTPサーバーが無効 |

| `HTTPOptions`フィールド | `0`または省略時 | 制約 |
| --- | --- | --- |
| `GlobalPrefix` | プレフィックスなし | 以下のパス規則を適用 |
| `DisableRecover` | `false`。panicをHTTP 500に変換するリカバリーミドルウェアを使用 | `true`の場合はミドルウェアを無効化 |
| `ReadHeaderTimeout` | 5秒 | 負の値は指定不可 |
| `ReadTimeout` | 30秒 | 負の値は指定不可 |
| `WriteTimeout` | 30秒 | 負の値は指定不可 |
| `IdleTimeout` | 120秒 | 負の値は指定不可 |
| `MaxHeaderBytes` | 1 MiB | 負の値は指定不可 |
| `MaxBodyBytes` | 32 MiB | 負の値の場合は本文サイズの制限を無効化 |
| `WebSocket` | [WebSocketのデフォルト値](/ja/reference/security-configuration#websocket) | `boot.WebSocketOptions` |

### GlobalPrefixの検証規則

`Validate`と`Run`は、次の規則に従わない値を`HTTP_GLOBAL_PREFIX_INVALID`設定エラーとして返します。空文字列の場合はプレフィックスを適用しません。

- `"/"`で始まる必要があります
- `":"`（パスパラメータ）を含めることはできません
- `"*"`（ワイルドカード）を含めることはできません
- 末尾の`"/"`は自動で取り除かれます

```go
// 유효한 접두사
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/v1"}
HTTP: &boot.HTTPOptions{GlobalPrefix: "/v2"}

// Validate와 Run이 설정 오류 반환
HTTP: &boot.HTTPOptions{GlobalPrefix: "api"}       // '/'로 시작하지 않음
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/:ver"}  // 경로 매개변수 포함
HTTP: &boot.HTTPOptions{GlobalPrefix: "/api/*"}     // 와일드카드 포함
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
// Recover 비활성화
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

    // 이벤트 발행
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

// BuildApplication은 서버 실행, 계약 검사와 오프라인 검증이 함께 사용하는 앱 구성 함수입니다.
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

## 起動と終了の順序

`Run`はオプションの事前検証後、依存性注入コンテナとイベントパブリッシャーを構成します。ユーザー定義のトランスポートの`Init`を呼び出し、HTTPとWebSocketのルートおよびインターセプターを解釈して、必要なコントローラーを事前に生成します。登録済みのコンシューマーがある場合は、ブローカーのランタイムも検証します。

この準備が終わると、コンシューマーとユーザー定義のトランスポートの`Start`を別のゴルーチンで実行し、最後にHTTPサーバーを起動します。HTTPルートは、同じメソッドでパスが曖昧に重なると起動に失敗します。たとえば、`/users/:id`と`/users/me`は重複するパスとして検出します。

終了時は、WebSocketとHTTPへのリクエストの受け入れを先に停止し、コンシューマーの停止を待ってから、ユーザー定義のトランスポートの`Stop`を初期化の逆順に呼び出します。その後、イベントパブリッシャーのリソースを解放します。具体的な実装は、[v0.6.5の起動および終了コード](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/bootstrap/bootstrap.go)を参照してください。

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
