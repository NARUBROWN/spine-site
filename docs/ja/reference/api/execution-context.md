# core.ExecutionContext

::: info
旧入力 API との互換性は[入力の移行](/ja/learn/migration/v0.7.1-preview)、文書設定は [OpenAPI](/ja/reference/api/openapi)を参照してください。
:::

`ExecutionContext`は、インターセプターと実行パイプラインでリクエスト情報を読み取り、処理段階の間で値を共有するためのインターフェースです。HTTPリクエスト、イベント、WebSocketメッセージで共通に使用し、トランスポートごとの追加情報は個別のインターフェースで提供します。

```go
import "github.com/NARUBROWN/spine/core"
```

## インターフェースの選択

HTTPコントローラーでインターセプターが保存した値を読み取るには、`core.ControllerContext`を引数として宣言します。インターセプターでは`core.ExecutionContext`を使用します。HTTPとイベントの入力の解釈には、それぞれ`HttpRequestContext`と`ConsumerRequestContext`を使用します。

| インターフェース | 含むインターフェース | 提供する機能 |
| --- | --- | --- |
| `ContextCarrier` | なし | Go標準の`context.Context` |
| `EventBusCarrier` | なし | リクエストスコープのイベントバス |
| `ExecutionContext` | `ContextCarrier`, `EventBusCarrier` | リクエストのメソッドとパス、ヘッダーとパラメータ、値の保存と取得 |
| `ControllerContext` | なし | インターセプターが保存した値の取得 |
| `HttpRequestContext` | `ContextCarrier`, `EventBusCarrier` | HTTP入力の取得、本文のバインド、マルチパートフォーム |
| `ConsumerRequestContext` | `ContextCarrier`, `EventBusCarrier` | イベント名と生の本文 |
| `WebSocketContext` | `ExecutionContext` | 接続ID、メッセージ型、生の本文 |
| `WebSocketRequestContext` | `ContextCarrier` | 接続を要求したHTTPリクエストの情報 |
| `WebSocketHandshakeContext` | `WebSocketRequestContext` | HTTPアップグレード前の認証と認可に使用するリクエスト情報 |
| `WebSocketMessageContext` | `WebSocketContext`, `WebSocketRequestContext` | メッセージと元の接続リクエスト情報 |

`ControllerContext`は`ExecutionContext`を含まず、`Get`だけを提供します。`HttpRequestContext`と`ConsumerRequestContext`も`ExecutionContext`を含みません。ランタイムが提供する実装は、必要なインターフェースを併せて実装します。

## インターフェース定義

### 基底インターフェース

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() EventBus
}
```

`EventBus()`は`core.EventBus`を返します。イベントを収集する`Publish(events ...publish.DomainEvent)`と、収集したイベントを取り出す`Drain() []publish.DomainEvent`を提供します。

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

HTTPコントローラーで値を読み取るための専用インターフェースです。インターセプターが`Set()`で保存した値を`Get()`で取得できます。標準のコンシューマーとWebSocketの入力リゾルバーは、この型を注入しません。

```go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

### HttpRequestContext

HTTP入力を読み取るインターフェースです。`ContextCarrier`と`EventBusCarrier`を含みます。

```go
type HttpRequestContext interface {
    ContextCarrier
    EventBusCarrier

    // 個別にアクセス
    Param(name string) string
    Query(name string) string
    Header(name string) string

    // ビュー全体にアクセス
    Params() map[string]string
    Queries() map[string][]string
    Headers() map[string][]string

    // リクエスト本文
    Bind(out any) error

    // マルチパート
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

`HTTPResponseContext.ResponseWriter()` は HTTP 応答 writer を返します。パイプラインは応答準備中に staging writer に置き換え、送信前に復元します。コントローラーは通常、writer に直接アクセスせず `httpx.Response[T]`、`httpx.Redirect`、`httpx.Binary` を返します。

### ConsumerRequestContext

イベントコンシューマーの入力を読み取るインターフェースです。`ContextCarrier`と`EventBusCarrier`を含みます。

```go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string
    Payload() []byte
}
```

### WebSocketContext

WebSocketメッセージを読み取るインターフェースです。`ExecutionContext`を含みます。

```go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string
    MessageType() int
    Payload() []byte
}
```

### WebSocketの接続リクエスト情報 {#websocket-request-context}

v0.7.1はHTTPアップグレードリクエストの情報をコピーして保持します。次のインターフェースで、ヘッダー、クエリ、Cookie、リモートアドレス、ホスト、リクエストURIを取得できます。

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

`WebSocketHandshakeContext`は`PreHandshake`で使用します。メッセージの処理中は、`ExecutionContext`を`WebSocketMessageContext`に型アサーションして、元の接続リクエスト情報を読み取ります。`Headers()`、`Queries()`、`Cookies()`はコピーを返すため、返されたマップを変更しても、保持されているリクエスト情報は変わりません。

## ExecutionContextのメソッド

### Context

```go
Context() context.Context
```

Go標準ライブラリの`context.Context`を返します。

**戻り値**

- `context.Context` - リクエストスコープのコンテキスト

**例**

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

リクエストスコープのイベントバスを返します。ドメインイベントの発行に使用します。

**戻り値**

- `core.EventBus` - イベントバスのインスタンス

イベントを発行するコントローラーでは、`context.Context`を引数として受け取り、`publish.Event(ctx, event)`を呼び出します。ランタイムがイベントバスを標準コンテキストに接続します。[イベント発行の例](/ja/reference/api/spine-app#event-publishing)を参照してください。

### Method

```go
Method() string
```

リクエストメソッドを返します。

**戻り値**

- HTTP: `"GET"`、`"POST"`、`"PUT"`、`"DELETE"`など
- イベントコンシューマー: `"EVENT"`
- WebSocket: `"WS"`

**例**

```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // CORS プリフライトリクエストを処理
    }
    return nil
}
```

### Path

```go
Path() string
```

リクエストパスを返します。

**戻り値**

- HTTP: リクエストパス（例: `"/users/123"`）
- イベントコンシューマー: イベント名（例: `"order.created"`）
- WebSocket: WebSocketのパス（例: `"/ws/chat"`）

**例**

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

指定した名前のHTTPヘッダー値を返します。

**引数**

- `name` - ヘッダー名（大文字と小文字を区別しません）

**戻り値**

- `string` - ヘッダー値。存在しない場合は空文字列
- イベントコンシューマー: 空文字列
- WebSocket: HTTPアップグレードリクエストから保持したヘッダー値

**例**

```go
origin := ctx.Header("Origin")
auth := ctx.Header("Authorization")
```

### Params

```go
Params() map[string]string
```

すべてのパスパラメータをマップで返します。

**戻り値**

- `map[string]string` - パスパラメータのマップ
- イベントコンシューマー: `nil`
- WebSocket: ルーターが解釈したパスパラメータ。ルーティング前は空のマップ

**例**

```go
// Route: /users/:userId/posts/:postId
// Request: /users/123/posts/456

params := ctx.Params()  // {"userId": "123", "postId": "456"}
```

### PathKeys

```go
PathKeys() []string
```

パスパラメータのキーを宣言順に返します。

**戻り値**

- `[]string` - キーのスライス
- イベントコンシューマー: `nil`
- WebSocket: ルーターが解釈したキーの順序。ルーティング前は空のスライス

**例**

```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```

### SetRoute

```go
SetRoute(params map[string]string, pathKeys []string)
```

ルーターが解決したパラメーターとキーの順序を保存します。実装は入力をコピーし、ユーザーの Set/Get ストアと分離します。ExecutionContext を独自実装する場合、このメソッドも必要です。

### Queries

```go
Queries() map[string][]string
```

すべてのクエリパラメータをマップで返します。

**戻り値**

- `map[string][]string` - クエリパラメータのマップ
- イベントコンシューマー: `nil`
- WebSocket: HTTPアップグレードリクエストから保持したクエリパラメータ

**例**

```go
// Request: /users?status=active&tag=go&tag=web

queries := ctx.Queries()
// {"status": ["active"], "tag": ["go", "web"]}
```

### Set

```go
Set(key string, value any)
```

内部ストアに値を保存します。

**引数**

- `key` - 保存するキー
- `value` - 保存する値

**例**

```go
ctx.Set("auth.user", authenticatedUser)
ctx.Set("request.startTime", time.Now())
```

### Get

```go
Get(key string) (any, bool)
```

内部ストアから値を取得します。

**引数**

- `key` - 取得するキー

**戻り値**

- `any` - 保存された値
- `bool` - キーの存在有無

**例**

```go
value, exists := ctx.Get("auth.user")
```

## ControllerContext

コントローラーでインターセプターが保存した値を読み取るインターフェースです。

### Get

```go
Get(key string) (any, bool)
```

`ExecutionContext.Get()`に委譲します。`Set()`メソッドは提供しません。

以下のコードは、[CLIプロジェクト](/ja/learn/tutorial/1-project-structure)の`src/user/user_controller.go`を拡張する例です。`User`、`AuthUser`、リポジトリのフィールドはアプリで定義します。生成された`user.Register(app)`とルートの`main.go`は維持します。

この抜粋には `core`、`input`、`httpx`、`httperr` パッケージが必要です。認証が必須の場合は値がない場合も拒否するようアプリのポリシーを適用してください。

```go
func (c *UserController) GetUser(ctx core.ControllerContext, userId input.Path[int64]) (httpx.Response[User], error) {
    // インターセプターが Set("auth.user", ...) で保存した値を取得
    if authUser, ok := ctx.Get("auth.user"); ok {
        auth, valid := authUser.(*AuthUser)
        if !valid || auth == nil {
            return httpx.Response[User]{}, httperr.Unauthorized("invalid authentication context")
        }
        _ = auth
        // ...
    }
    user, err := c.repo.FindByID(*userId)
    if err != nil {
        return httpx.Response[User]{}, err
    }
    return httpx.Response[User]{Body: user}, nil
}
```

## HttpRequestContextのメソッド

HTTP入力を解釈するときに使用する追加メソッドです。

### Param

```go
Param(name string) string
```

指定したパスパラメータの値を返します。

**例**

```go
userId := ctx.Param("id")  // "123"
```

### Query

```go
Query(name string) string
```

指定したクエリパラメータの最初の値を返します。

**例**

```go
page := ctx.Query("page")  // "1"
```

### Headers

```go
Headers() map[string][]string
```

すべてのHTTPヘッダーをマップで返します。

**例**

```go
headers := ctx.Headers()
// {"Content-Type": ["application/json"], "Accept": ["text/html", "application/json"]}
```

### Bind

```go
Bind(out any) error
```

HTTPリクエストの本文を構造体にバインドします。

**例**

HTTP v3 のコアリクエストビューが本文を解釈します。パスとクエリは本文 DTO に結合されず、Spine DTO の入力は Echo Binder や JSONSerializer の拡張を呼びません。

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

マルチパートフォームのデータにアクセスします。

**例**

```go
form, err := ctx.MultipartForm()
if err != nil {
    return err
}
for _, file := range form.File["upload"] {
    // ファイルを処理
}
```

## ConsumerRequestContextのメソッド

イベント入力を解釈するときに使用するメソッドです。

### EventName

```go
EventName() string
```

受信したイベントの名前を返します。

**例**

```go
name := ctx.EventName()  // "order.created"
```

### Payload

```go
Payload() []byte
```

イベントの生のペイロードを返します。

**例**

```go
payload := ctx.Payload()  // []byte (JSON)
var event OrderCreated
json.Unmarshal(payload, &event)
```

## WebSocketContextのメソッド

WebSocket入力を解釈するときに使用するメソッドです。

### ConnID

```go
ConnID() string
```

WebSocket接続の一意の識別子を返します。

**例**

```go
connID := ctx.ConnID()  // "a1b2c3d4-..."
```

### MessageType

```go
MessageType() int
```

WebSocketメッセージの型を返します。

**戻り値**

- `1` - TextMessage
- `2` - BinaryMessage

**例**

```go
if ctx.MessageType() == ws.TextMessage {
    // テキストメッセージを処理
}
```

### Payload

```go
Payload() []byte
```

WebSocketメッセージの生のペイロードを返します。

**例**

```go
payload := ctx.Payload()  // []byte
var msg ChatMessage
json.Unmarshal(payload, &msg)
```

## ルーティングと応答の契約

ルーティング情報と HTTP 応答 writer は、ユーザーの Set/Get ストアとは独立した型付き契約で管理します。ルーターは `SetRoute` でパス値を保存し、HTTP パイプラインは `HTTPResponseContext` で writer を選択します。

| API | 型 | 説明 |
|----|------|------|
| `HTTPResponseContext.ResponseWriter()` | `core.ResponseWriter` | レスポンス出力インターフェース |
| `Params()` | `map[string]string` | パスパラメータ |
| `PathKeys()` | `[]string` | パスパラメータのキーの順序 |

## インターセプターでの使用

`ExecutionContext`は、インターセプターのすべてのメソッドに第1引数として渡されます。

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### ログ出力の例

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

### CORSの例

次は、レスポンス出力インターフェースにアクセスする例です。`Config`と`isAllowedOrigin`はアプリで定義します。CORS全体の設定には、[検証可能な標準インターセプター](/ja/reference/security-configuration#cors-cookies)を使用してください。

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

## 入力の解釈での使用

入力を解釈するコンポーネントは、`core.ExecutionContext`を受け取り、トランスポートに対応するインターフェースに型アサーションします。たとえば、HTTPのパスパラメータを読み取るには`core.HttpRequestContext`、イベント名を読み取るには`core.ConsumerRequestContext`、WebSocketの接続IDを読み取るには`core.WebSocketContext`が必要です。対応するインターフェースを実装していないコンテキストでは、型アサーションが失敗します。

HTTPコントローラーの`context.Context`引数には標準コンテキストとリクエストスコープのイベントバスを渡し、`core.ControllerContext`引数には`Get()`だけを提供するビューを渡します。コンシューマーとWebSocketの標準入力リゾルバーには、`ControllerContext`を注入する機能がありません。ランタイムの入力解釈コードは、次のソースで確認できます。

- [HTTPパスパラメータの解釈](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/resolver/scalar_path_resolver.go)
- [標準コンテキストの受け渡し](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/resolver/std_context_resolver.go)
- [コントローラーの取得用コンテキストの受け渡し](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/resolver/controller_context_resolver.go)
- [イベント入力の解釈](https://github.com/NARUBROWN/spine/tree/v0.7.1/internal/event/consumer/resolver)
- [WebSocket入力の解釈](https://github.com/NARUBROWN/spine/tree/v0.7.1/internal/ws/resolver)

## プロトコルごとの動作の違い

| メソッド | HTTP | イベントコンシューマー | WebSocket |
|--------|------|----------|-----------|
| `Method()` | `"GET"`、`"POST"`など | `"EVENT"` | `"WS"` |
| `Path()` | `/users/123` | `order.created` | `/ws/chat` |
| `Header()` | ヘッダー値 | 空文字列 | 接続リクエストのヘッダー値 |
| `Params()` | パスパラメータ | `nil` | ルーターが解釈したパスパラメータ |
| `PathKeys()` | パスパラメータのキーの順序 | `nil` | パスパラメータのキーの順序 |
| `Queries()` | クエリパラメータ | `nil` | 接続リクエストのクエリパラメータ |
| `EventBus()` | EventBus | EventBus | EventBus |
| `Context()` | リクエストコンテキスト | イベント処理コンテキスト | メッセージ処理コンテキスト |

## 実装

| 実装 | インターフェース | 場所 |
|--------|-----------|------|
| `echoContext` | `ExecutionContext` + `HttpRequestContext` | `internal/adapter/echo/context_impl.go` |
| `ConsumerRequestContextImpl` | `ExecutionContext` + `ConsumerRequestContext` | `internal/event/consumer/request_context_impl.go` |
| `WSExecutionContext` | `WebSocketMessageContext` | `internal/ws/context_impl.go` |
| `controllerCtxView` | `ControllerContext` | `internal/runtime/controller_ctx.go` |

## 制約とエラー

- グローバルインターセプターの`PreHandle`は、ルーティング前に実行されます。この時点では`HandlerMeta{}`が空のため、コントローラーの型やメソッドに直接アクセスしないでください。パスパラメータもルーティング後に読み取る必要があります。
- `Get`は、キーが存在しない場合に`(nil, false)`を返します。保存された値の型を確認してから使用してください。`ControllerContext`は、保存されたオブジェクト自体の変更を防ぐものではありません。
- `Header`と`Query`は、値が存在しない場合に空文字列を返します。WebSocketの`Cookie`は、値と存在有無を併せて返します。
- `Bind`と`MultipartForm`は、本文の解釈に失敗するとエラーを返します。呼び出し元にエラーを返し、処理を中断してください。
- `spine.`で始まる予約済みキーは、ランタイムが使用します。アプリで共有する値には、`auth.user`のような別の名前を使用してください。

## 関連情報

- [インターセプター](/ja/reference/api/interceptor): 認証やログ出力などの共通処理
- [実行コンテキストの概念](/ja/learn/core-concepts/execution-context) - 詳細な説明
