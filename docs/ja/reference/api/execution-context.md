# core.ExecutionContext

ExecutionContextへのAPIリファレンス。


## 概要

`ExecutionContext`は、Spineパイプラインから要求情報にアクセスし、コンポーネント間のデータを共有するインタフェースです。 HTTPリクエスト、イベントメッセージ、WebSocketメッセージの両方を処理する統合実行コンテキスト。


```go
import "github.com/NARUBROWN/spine/core"
```


## インターフェイス層

SpineはContextを階層的に分離します。

```
ContextCarrier ──────┬──► ExecutionContext ──► WebSocketContext
                     │
EventBusCarrier ─────┤
                     │
                     ├──► HttpRequestContext
                     │
                     ├──► ConsumerRequestContext
                     │
                     └──► ControllerContext (読み取り 전용 Facade)
```

|インターフェース|役割|使用場所|
|-----------|------|----------|
| `ContextCarrier` | Go context配信|どこでも
| `EventBusCarrier` |イベント発行|コントローラー、コンシューマー
| `ExecutionContext` |実行フロー制御|ルーター、パイプライン、インターセプター|
| `ControllerContext` | ExecutionContext読み取り専用Facade | Controller |
| `HttpRequestContext` | HTTP入力の解釈HTTP ArgumentResolver |
| `ConsumerRequestContext` |イベント入力の解釈Consumer ArgumentResolver |
| `WebSocketContext` | WebSocket入力解析| WebSocket ArgumentResolver |


## インタフェース定義

### ベースのインタフェース


```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() EventBus
}
```

> **注**：`EventBusCarrier`の戻り値の種類は`core.EventBus`です。 `core.EventBus`は、`Publish(events ...publish.DomainEvent)`と`Drain() []publish.DomainEvent`メソッドを持つインタフェースです。

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
    Queries() map[string][]string
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

### ControllerContext

Controllerのみ読み取り専用Facadeです。 Interceptorが`Set()`に注入した値をControllerから`Get()`に参照するための公式通路です。


```go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

### HttpRequestContext

HTTP 専用拡張インターフェイスです。 `ContextCarrier`と`EventBusCarrier`を直接埋め込みます。


```go
type HttpRequestContext interface {
    ContextCarrier
    EventBusCarrier

    // 個別 접근
    Param(name string) string
    Query(name string) string
    Header(name string) string

    // 全体 뷰 접근
    Params() map[string]string
    Queries() map[string][]string
    Headers() map[string][]string

    // body
    Bind(out any) error

    // Multipart
    MultipartForm() (*multipart.Form, error)
}
```

### ConsumerRequestContext

イベントコンシューマ専用の拡張インタフェースです。 `ContextCarrier`と`EventBusCarrier`を直接埋め込みます。


```go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string
    Payload() []byte
}
```

### WebSocketContext

WebSocket 専用の拡張インターフェイスです。 `ExecutionContext`を埋め込みます。


```go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string
    MessageType() int
    Payload() []byte
}
```


## ExecutionContextメソッド

### Context


```go
Context() context.Context
```

Go 標準ライブラリの `context.Context` を返します。

**戻り値**
- `context.Context` - 要求スコープのコンテキスト

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

リクエストスコープのEventBusを返します。ドメインイベントの発行に使用されます。

**戻り値**
- `core.EventBus` - イベントバスインスタンス

**例**

```go
// PostExecutionHook에서 イベント drain
func (h *EventDispatchHook) AfterExecution(ctx core.ExecutionContext, results []any, err error) {
    if err != nil {
        return
    }
    
    events := ctx.EventBus().Drain()
    if len(events) == 0 {
        return
    }
    
    h.Dispatcher.Dispatch(ctx.Context(), events)
}
```

### Method


```go
Method() string
```

リクエストメソッドを返します。

**戻り値**
- HTTP：`"GET"`、`"POST"`、`"PUT"`、`"DELETE"`など
- Consumer: `"EVENT"`
- WebSocket: `"WS"`

**例**

```go
func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Method() == "OPTIONS" {
        // Preflight リクエスト 処理
    }
    return nil
}
```


### Path


```go
Path() string
```

要求パスを返します。

**戻り値**
- HTTP：リクエストパス（例：`"/users/123"`）
- Consumer：イベント名（例：`"order.created"`）
- WebSocket：WebSocketパス（例：`"/ws/chat"`）

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

**パラメータ**
- `name` - ヘッダ名（大文字と小文字の区別なし）

**戻り値**
- `string` - ヘッダー値。なければ空の文字列
- Consumer/WebSocketでは常に空の文字列

**例**

```go
origin := ctx.Header("Origin")
auth := ctx.Header("Authorization")
```


### Params


```go
Params() map[string]string
```

すべてのパスパラメータをマップとして返​​します。

**戻り値**
- `map[string]string` - パスパラメータマップ
- Consumer/WebSocketでは空のマップ

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

パスパラメータキーを宣言順に返します。

**戻り値**
- `[]string` - キースライス
- Consumer/WebSocketでは、空のスライス

**例**

```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```


### Queries


```go
Queries() map[string][]string
```

すべてのクエリパラメータをマップとして返​​します。

**戻り値**
- `map[string][]string` - クエリパラメータマップ
- Consumer/WebSocketでは空のマップ

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

**パラメータ**
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

内部ストアから値を照会します。

**パラメータ**
- `key` - 照会するキー

**戻り値**
- `any` - 保存された値
- `bool` - キーが存在するかどうか

**例**

```go
if rw, ok := ctx.Get("spine.response_writer"); ok {
    responseWriter := rw.(core.ResponseWriter)
}
```


## ControllerContext

Controller で Interceptor が注入した値を読み取るための専用ビューです。

### Get


```go
Get(key string) (any, bool)
```

`ExecutionContext.Get()`に委任します。 `Set()` メソッドは提供しません。

**実装**

```go
// internal/runtime/controller_ctx.go
type controllerCtxView struct {
    ec core.ExecutionContext
}

func NewControllerContext(ec core.ExecutionContext) core.ControllerContext {
    return controllerCtxView{ec: ec}
}

func (v controllerCtxView) Get(key string) (any, bool) {
    return v.ec.Get(key)
}
```

**使用例**

```go
func (c *UserController) GetUser(ctx core.ControllerContext, userId path.Int) (User, error) {
    // Interceptor가 Set("auth.user", ...)으로 주입한 값을 読み取り
    if authUser, ok := ctx.Get("auth.user"); ok {
        user := authUser.(*AuthUser)
        // ...
    }
    return c.repo.FindByID(userId.Value)
}
```


## HttpRequestContext メソッド

HTTP ArgumentResolver で使用される追加のメソッドです。

### Param


```go
Param(name string) string
```

特定のパスパラメータ値を返します。

**例**

```go
userId := ctx.Param("id")  // "123"
```

### Query


```go
Query(name string) string
```

特定のクエリパラメータの最初の値を返します。

**例**

```go
page := ctx.Query("page")  // "1"
```

### Headers


```go
Headers() map[string][]string
```

すべてのHTTPヘッダーをマップとして返​​します。

**例**

```go
headers := ctx.Headers()
// {"Content-Type": ["application/json"], "Accept": ["text/html", "application/json"]}
```

### Bind


```go
Bind(out any) error
```

HTTP bodyを構造体にバインドします。

**例**

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

Multipart form データにアクセスします。

**例**

```go
form, err := ctx.MultipartForm()
if err != nil {
    return err
}
for _, file := range form.File["upload"] {
    // 파일 処理
}
```


## ConsumerRequestContext メソッド

イベントコンシューマ ArgumentResolver で使用されるメソッドです。

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


## WebSocketContext メソッド

WebSocket ArgumentResolver で使用されるメソッドです。

### ConnID


```go
ConnID() string
```

WebSocket 接続の一意の識別子を返します。

**例**

```go
connID := ctx.ConnID()  // "a1b2c3d4-..."
```

### MessageType


```go
MessageType() int
```

WebSocket メッセージタイプを返します。

**戻り値**
- `1` - TextMessage
- `2` - BinaryMessage

**例**

```go
if ctx.MessageType() == ws.TextMessage {
    // 텍스트 메시지 処理
}
```

### Payload


```go
Payload() []byte
```

WebSocket メッセージの生のペイロードを返します。

**例**

```go
payload := ctx.Payload()  // []byte
var msg ChatMessage
json.Unmarshal(payload, &msg)
```


## 予約キー

|キー|タイプ|説明
|----|------|------|
| `spine.response_writer` | `core.ResponseWriter` |応答出力インターフェース|
| `spine.params` | `map[string]string` |パスパラメータ|
| `spine.pathKeys` | `[]string` |パスパラメータキーシーケンス|


## Interceptorで使用

`ExecutionContext` は、Interceptor のすべてのメソッドで最初の引数として渡されます。


```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### ロギングの例


```go
type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s -> %s.%s",
        ctx.Method(),
        ctx.Path(),
        meta.ControllerType.Name(),
        meta.Method.Name,
    )
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

### CORSの例


```go
type CORSInterceptor struct {
    config Config
}

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return nil
    }
    rw := rwAny.(core.ResponseWriter)
    
    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
        rw.SetHeader("Vary", "Origin")
    }
    
    if ctx.Method() == "OPTIONS" {
        rw.WriteStatus(204)
        return core.ErrAbortPipeline
    }
    
    return nil
}
```


## ArgumentResolverで使用

ArgumentResolver は `core.ExecutionContext` を受け取り、必要に応じてプロトコル固有の Context で型断言します。

### HTTP Resolverの例


```go
func (r *PathIntResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    // HttpRequestContext로 型 단언
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("HTTP リクエスト 컨텍스트가 아닙니다")
    }

    raw, ok := httpCtx.Params()[parameterMeta.PathKey]
    if !ok {
        return nil, fmt.Errorf("path param을 見つかりません: %s", parameterMeta.PathKey)
    }

    value, err := strconv.ParseInt(raw, 10, 64)
    if err != nil {
        return nil, err
    }

    return path.Int{Value: value}, nil
}
```

### Consumer Resolverの例


```go
func (r *EventNameResolver) Resolve(ctx core.ExecutionContext, meta ParameterMeta) (any, error) {
    // ConsumerRequestContext로 型 단언
    consumerCtx, ok := ctx.(core.ConsumerRequestContext)
    if !ok {
        return nil, fmt.Errorf("ConsumerRequestContext가 아닙니다")
    }

    return consumerCtx.EventName(), nil
}
```

### WebSocket Resolverの例


```go
func (r *ConnectionIDResolver) Resolve(ctx core.ExecutionContext, meta ParameterMeta) (any, error) {
    // WebSocketContext로 型 단언
    wsCtx, ok := ctx.(core.WebSocketContext)
    if !ok {
        return nil, fmt.Errorf("WebSocketContext가 아닙니다")
    }

    return ws.ConnectionID{Value: wsCtx.ConnID()}, nil
}
```

### Common Resolverの例

HTTP、Consumer、WebSocketの両方で動作するResolverです。


```go
func (r *StdContextResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    baseCtx := ctx.Context()
    bus := ctx.EventBus()
    if bus != nil {
        // EventBus를 context.Context에 주입
        return context.WithValue(baseCtx, publish.PublisherKey, bus), nil
    }
    return baseCtx, nil
}
```

### ControllerContext Resolverの例


```go
func (r *ControllerContextResolver) Resolve(ctx core.ExecutionContext, _ ParameterMeta) (any, error) {
    return runtime.NewControllerContext(ctx), nil
}
```


## プロトコル固有の動作の違い

|メソッドHTTP |消費者WebSocket |
|--------|------|----------|-----------|
| `Method()` | `"GET"`、`"POST"`など`"EVENT"` | `"WS"` |
| `Path()` | `/users/123` | `order.created` | `/ws/chat` |
| `Header()` |ヘッダー値|空の文字列空の文字列
| `Params()` | path params |空の地図空の地図
| `PathKeys()` |キーシーケンス|空のスライス|空のスライス|
| `Queries()` | query params |空の地図空の地図
| `EventBus()` | EventBus | EventBus | EventBus |
| `Context()` |リクエストコンテキストリクエストコンテキストリクエストコンテキスト


## 実装

|実装インターフェース|場所
|--------|-----------|------|
| `echoContext` | `ExecutionContext` + `HttpRequestContext` | `internal/adapter/echo/context_impl.go` |
| `ConsumerRequestContextImpl` | `ExecutionContext` + `ConsumerRequestContext` | `internal/event/consumer/request_context_impl.go` |
| `WSExecutionContext` | `WebSocketContext` (⊃ `ExecutionContext`) | `internal/ws/context_impl.go` |
| `controllerCtxView` | `ControllerContext` | `internal/runtime/controller_ctx.go` |


## 注

- [Interceptor](/ja/reference/api/interceptor) - 横断関心事の処理
- [実行コンテキストの概念](/ja/learn/core-concepts/execution-context) - 詳細な説明