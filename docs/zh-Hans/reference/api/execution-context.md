# core.ExecutionContext

`ExecutionContext` 是拦截器和执行流水线用于读取请求信息、在处理阶段之间共享值的接口。HTTP 请求、事件和 WebSocket 消息共用此接口，各传输方式还通过独立接口提供额外信息。

```go
import "github.com/NARUBROWN/spine/core"
```

## 选择接口

要在 HTTP 控制器中读取拦截器保存的值，请将 `core.ControllerContext` 声明为参数。拦截器中使用 `core.ExecutionContext`。HTTP 和事件的输入解析分别使用 `HttpRequestContext` 和 `ConsumerRequestContext`。

| 接口 | 嵌入的接口 | 提供的功能 |
| --- | --- | --- |
| `ContextCarrier` | 无 | Go 标准 `context.Context` |
| `EventBusCarrier` | 无 | 请求范围的事件总线 |
| `ExecutionContext` | `ContextCarrier`, `EventBusCarrier` | 请求方法和路径、请求头和参数、值的存储与查询 |
| `ControllerContext` | 无 | 查询拦截器保存的值 |
| `HttpRequestContext` | `ContextCarrier`, `EventBusCarrier` | 查询 HTTP 输入、绑定请求体、多部分表单 |
| `ConsumerRequestContext` | `ContextCarrier`, `EventBusCarrier` | 事件名称和原始请求体 |
| `WebSocketContext` | `ExecutionContext` | 连接 ID、消息类型和原始消息体 |
| `WebSocketRequestContext` | `ContextCarrier` | 发起连接的 HTTP 请求信息 |
| `WebSocketHandshakeContext` | `WebSocketRequestContext` | HTTP 升级前用于认证和授权的请求信息 |
| `WebSocketMessageContext` | `WebSocketContext`, `WebSocketRequestContext` | 消息和原始连接请求信息 |

`ControllerContext` 不嵌入 `ExecutionContext`，仅提供 `Get`。`HttpRequestContext` 和 `ConsumerRequestContext` 也不嵌入 `ExecutionContext`。运行时提供的实现会同时实现所需接口。

## 接口定义

### 基础接口

```go
type ContextCarrier interface {
    Context() context.Context
}

type EventBusCarrier interface {
    EventBus() EventBus
}
```

`EventBus()` 返回 `core.EventBus`。该接口提供用于收集事件的 `Publish(events ...publish.DomainEvent)` 和用于取出已收集事件的 `Drain() []publish.DomainEvent`。

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

专供 HTTP 控制器读取值的接口。可以通过 `Get()` 查询拦截器使用 `Set()` 保存的值。默认消费者和 WebSocket 输入解析器不会注入此类型。

```go
type ControllerContext interface {
    Get(key string) (any, bool)
}
```

### HttpRequestContext

用于读取 HTTP 输入的接口。嵌入 `ContextCarrier` 和 `EventBusCarrier`。

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

### ConsumerRequestContext

用于读取事件消费者输入的接口。嵌入 `ContextCarrier` 和 `EventBusCarrier`。

```go
type ConsumerRequestContext interface {
    ContextCarrier
    EventBusCarrier

    EventName() string
    Payload() []byte
}
```

### WebSocketContext

用于读取 WebSocket 消息的接口。嵌入 `ExecutionContext`。

```go
type WebSocketContext interface {
    ExecutionContext

    ConnID() string
    MessageType() int
    Payload() []byte
}
```

### WebSocket 连接请求信息 {#websocket-request-context}

v0.5.1 会复制并保留 HTTP 升级请求的信息。通过以下接口，可以查询请求头、查询参数、Cookie、远程地址、主机和请求 URI。

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

`WebSocketHandshakeContext` 在 `PreHandshake` 中使用。处理消息时，将 `ExecutionContext` 类型断言为 `WebSocketMessageContext`，即可读取原始连接请求信息。`Headers()`、`Queries()` 和 `Cookies()` 返回副本，因此修改返回的映射不会改变所保留的请求信息。

## ExecutionContext 方法

### Context

```go
Context() context.Context
```

返回 Go 标准库的 `context.Context`。

**返回值**

- `context.Context` - 请求范围的上下文

**示例**

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

返回请求范围的事件总线。用于发布领域事件。

**返回值**

- `core.EventBus` - 事件总线实例

发布事件的控制器接收 `context.Context` 参数并调用 `publish.Event(ctx, event)`。运行时会将事件总线关联到标准上下文。请参阅[事件发布示例](/zh-Hans/reference/api/spine-app#event-publishing)。

### Method

```go
Method() string
```

返回请求方法。

**返回值**

- HTTP：`"GET"`、`"POST"`、`"PUT"`、`"DELETE"` 等
- 事件消费者：`"EVENT"`
- WebSocket：`"WS"`

**示例**

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

返回请求路径。

**返回值**

- HTTP：请求路径（例如 `"/users/123"`）
- 事件消费者：事件名称（例如 `"order.created"`）
- WebSocket：WebSocket 路径（例如 `"/ws/chat"`）

**示例**

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

返回指定名称的 HTTP 请求头值。

**参数**

- `name` - 请求头名称（不区分大小写）

**返回值**

- `string` - 请求头值。不存在时返回空字符串
- 事件消费者：空字符串
- WebSocket：从 HTTP 升级请求中保留的请求头值

**示例**

```go
origin := ctx.Header("Origin")
auth := ctx.Header("Authorization")
```

### Params

```go
Params() map[string]string
```

以映射形式返回所有路径参数。

**返回值**

- `map[string]string` - 路径参数映射
- 事件消费者：`nil`
- WebSocket：路由器解析出的路径参数。路由前为空映射

**示例**

```go
// Route: /users/:userId/posts/:postId
// Request: /users/123/posts/456

params := ctx.Params()  // {"userId": "123", "postId": "456"}
```

### PathKeys

```go
PathKeys() []string
```

按声明顺序返回路径参数的键。

**返回值**

- `[]string` - 键的切片
- 事件消费者：`nil`
- WebSocket：路由器解析出的键顺序。路由前为空切片

**示例**

```go
// Route: /users/:userId/posts/:postId

ctx.PathKeys()  // ["userId", "postId"]
```

### Queries

```go
Queries() map[string][]string
```

以映射形式返回所有查询参数。

**返回值**

- `map[string][]string` - 查询参数映射
- 事件消费者：`nil`
- WebSocket：从 HTTP 升级请求中保留的查询参数

**示例**

```go
// Request: /users?status=active&tag=go&tag=web

queries := ctx.Queries()
// {"status": ["active"], "tag": ["go", "web"]}
```

### Set

```go
Set(key string, value any)
```

将值保存到内部存储中。

**参数**

- `key` - 要保存的键
- `value` - 要保存的值

**示例**

```go
ctx.Set("auth.user", authenticatedUser)
ctx.Set("request.startTime", time.Now())
```

### Get

```go
Get(key string) (any, bool)
```

从内部存储中查询值。

**参数**

- `key` - 要查询的键

**返回值**

- `any` - 已保存的值
- `bool` - 键是否存在

**示例**

```go
if rw, ok := ctx.Get("spine.response_writer"); ok {
    responseWriter := rw.(core.ResponseWriter)
}
```

## ControllerContext

用于在控制器中读取拦截器保存值的接口。

### Get

```go
Get(key string) (any, bool)
```

委托给 `ExecutionContext.Get()`。不提供 `Set()` 方法。

以下代码扩展了 [CLI 项目](/zh-Hans/learn/tutorial/1-project-structure)中的 `src/user/user_controller.go`。`User`、`AuthUser` 和存储库字段由应用定义。保留生成的 `user.Register(app)` 和根目录的 `main.go`。

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

解析 HTTP 输入时使用的附加方法。

### Param

```go
Param(name string) string
```

返回指定路径参数的值。

**示例**

```go
userId := ctx.Param("id")  // "123"
```

### Query

```go
Query(name string) string
```

返回指定查询参数的第一个值。

**示例**

```go
page := ctx.Query("page")  // "1"
```

### Headers

```go
Headers() map[string][]string
```

以映射形式返回所有 HTTP 请求头。

**示例**

```go
headers := ctx.Headers()
// {"Content-Type": ["application/json"], "Accept": ["text/html", "application/json"]}
```

### Bind

```go
Bind(out any) error
```

将 HTTP 请求体绑定到结构体。

**示例**

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

访问多部分表单数据。

**示例**

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

解析事件输入时使用的方法。

### EventName

```go
EventName() string
```

返回收到的事件名称。

**示例**

```go
name := ctx.EventName()  // "order.created"
```

### Payload

```go
Payload() []byte
```

返回事件的原始载荷。

**示例**

```go
payload := ctx.Payload()  // []byte (JSON)
var event OrderCreated
json.Unmarshal(payload, &event)
```

## WebSocketContext 方法

解析 WebSocket 输入时使用的方法。

### ConnID

```go
ConnID() string
```

返回 WebSocket 连接的唯一标识符。

**示例**

```go
connID := ctx.ConnID()  // "a1b2c3d4-..."
```

### MessageType

```go
MessageType() int
```

返回 WebSocket 消息类型。

**返回值**

- `1` - TextMessage
- `2` - BinaryMessage

**示例**

```go
if ctx.MessageType() == ws.TextMessage {
    // 텍스트 메시지 처리
}
```

### Payload

```go
Payload() []byte
```

返回 WebSocket 消息的原始载荷。

**示例**

```go
payload := ctx.Payload()  // []byte
var msg ChatMessage
json.Unmarshal(payload, &msg)
```

## 保留键

| 键 | 类型 | 说明 |
|----|------|------|
| `spine.response_writer` | `core.ResponseWriter` | 响应输出接口 |
| `spine.params` | `map[string]string` | 路径参数 |
| `spine.pathKeys` | `[]string` | 路径参数键的顺序 |

## 在拦截器中使用

`ExecutionContext` 作为第一个参数传递给拦截器的所有方法。

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

### 日志示例

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

### CORS 示例

以下示例展示如何访问响应输出接口。`Config` 和 `isAllowedOrigin` 由应用定义。完整的 CORS 配置请使用[可验证的内置拦截器](/zh-Hans/reference/security-configuration#cors-cookies)。

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

## 在输入解析中使用

解析输入的组件接收 `core.ExecutionContext`，并将其类型断言为对应传输方式的接口。例如，读取 HTTP 路径参数需要 `core.HttpRequestContext`，读取事件名称需要 `core.ConsumerRequestContext`，读取 WebSocket 连接 ID 需要 `core.WebSocketContext`。如果上下文未实现相应接口，类型断言将失败。

对于 HTTP 控制器的 `context.Context` 参数，运行时传递标准上下文和请求范围的事件总线；对于 `core.ControllerContext` 参数，传递仅提供 `Get()` 的视图。消费者和 WebSocket 的默认输入解析器不提供 `ControllerContext` 注入功能。运行时的输入解析代码可在以下源码中查看。

- [HTTP 路径参数解析](https://github.com/NARUBROWN/spine/blob/v0.5.1/internal/resolver/path_int_resolver.go)
- [传递标准上下文](https://github.com/NARUBROWN/spine/blob/v0.5.1/internal/resolver/std_context_resolver.go)
- [传递控制器查询上下文](https://github.com/NARUBROWN/spine/blob/v0.5.1/internal/resolver/controller_context_resolver.go)
- [事件输入解析](https://github.com/NARUBROWN/spine/tree/v0.5.1/internal/event/consumer/resolver)
- [WebSocket 输入解析](https://github.com/NARUBROWN/spine/tree/v0.5.1/internal/ws/resolver)

## 不同协议的行为差异

| 方法 | HTTP | 事件消费者 | WebSocket |
|--------|------|----------|-----------|
| `Method()` | `"GET"`、`"POST"` 等 | `"EVENT"` | `"WS"` |
| `Path()` | `/users/123` | `order.created` | `/ws/chat` |
| `Header()` | 请求头值 | 空字符串 | 连接请求的请求头值 |
| `Params()` | 路径参数 | `nil` | 路由器解析出的路径参数 |
| `PathKeys()` | 路径参数键的顺序 | `nil` | 路径参数键的顺序 |
| `Queries()` | 查询参数 | `nil` | 连接请求的查询参数 |
| `EventBus()` | EventBus | EventBus | EventBus |
| `Context()` | 请求上下文 | 事件处理上下文 | 消息处理上下文 |

## 实现

| 实现 | 接口 | 位置 |
|--------|-----------|------|
| `echoContext` | `ExecutionContext` + `HttpRequestContext` | `internal/adapter/echo/context_impl.go` |
| `ConsumerRequestContextImpl` | `ExecutionContext` + `ConsumerRequestContext` | `internal/event/consumer/request_context_impl.go` |
| `WSExecutionContext` | `WebSocketMessageContext` | `internal/ws/context_impl.go` |
| `controllerCtxView` | `ControllerContext` | `internal/runtime/controller_ctx.go` |

## 约束和错误

- 全局拦截器的 `PreHandle` 在路由前执行。此时 `HandlerMeta{}` 为空，因此不要直接访问控制器类型或方法。路径参数也应在路由完成后读取。
- 键不存在时，`Get` 返回 `(nil, false)`。使用前请检查已保存值的类型。`ControllerContext` 不会阻止修改已保存的对象本身。
- 值不存在时，`Header` 和 `Query` 返回空字符串。WebSocket 的 `Cookie` 同时返回值及其是否存在。
- `Bind` 和 `MultipartForm` 在解析请求体失败时返回错误。请将错误传递给调用方，并停止处理。
- 以 `spine.` 开头的保留键由运行时使用。应用共享的值请使用 `auth.user` 等独立名称。

## 参考

- [拦截器](/zh-Hans/reference/api/interceptor)：认证和日志等通用处理
- [执行上下文概念](/zh-Hans/learn/core-concepts/execution-context) - 详细说明
