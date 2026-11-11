# v0.7.1 控制器与路由迁移

::: info
本页记录 0.7.1 当时行为与迁移历史。当前输入、上下文和验证请参考 [0.7.5 迁移指南](/zh-Hans/learn/migration/v0.7.5)。
:::


本文适用于 Spine `v0.7.1`。核心需要 Go 1.25.5 或更高版本，playground 验证器需要 Go 1.26 或更高版本。

## 在控制器中注册路由 {#routes}

v0.7.1 中，`app.Route` 以及使用构造函数、独立 route.go 和方法表达式的 HTTP 控制器方式已标记为 Deprecated。迁移期间仍可使用，移除版本尚未确定。普通 DI 构造函数并未弃用。

这是注册示例，并非独立应用。请在应用中添加 HTTP 平台和运行配置。

```go
import (
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type UserPath struct { ID int64 `path:"id"` }
type User struct { ID int64 `json:"id"` }

func (*UserController) Constructor() *UserController { return &UserController{} }

func (c *UserController) RegisterRoutes(r *api.Registry) {
    users := r.Group("/users", api.Tags("Users"))
    users.GET("/:id",
        func(p input.Path[UserPath]) httpx.Response[User] {
            return httpx.Response[User]{Body: User{ID: p.ID}}
        }, api.Summary("Get user"))
}

func register(app interface{ Constructor(...any) }) {
    app.Constructor(constructor.Controller(&UserController{}))
}
```

可以保留现有方法的逻辑并从回调中调用。新旧路由可以共存，但相同方法和路径重复注册会在准备阶段被拒绝。迁移后请删除对应的旧注册。支持 `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`。

## 构造与角色 {#constructors}

`app.Constructor` 接受 `constructor.Custom`, `Repository`, `Service`, `Controller`, `Interceptor` 角色注册以及现有构造函数。对象注册需要结构体指针和非可变参数的 `Constructor(依赖...) *自身类型` 方法。注册值的字段不会复制，构造结果按应用缓存。`Custom` 也接受现有的单返回值构造函数。

Controller 还须实现包含 `RegisterRoutes(*api.Registry)` 的 `api.Controller`，Interceptor 须实现 `core.Interceptor`。注册 Interceptor 只提供 DI，仍需单独配置全局或路由应用。启动前检查构造契约和依赖图，实际构造时检测 nil 返回值与 panic。

## 输入与分组 {#groups}

`input.Query[T]` 和 `input.Body[T]` 的 `T` 必须是结构体。路径和查询优先使用标签，否则使用 lowerCamel 名称。请求头使用带 `header` 标签的独立结构体指针。

在 v0.7.1 中，每个路径变量对应一个标量 `input.Path[T]` 参数，顺序与路由一致。数量必须相同，且不能在同一处理器中混用路径 DTO 或旧路径包装类型。

分组和 Registry 都使用 `GET(path, handler, options...)` 顺序。分组继承前缀和标签，并可通过 `api.Interceptors(...)` 添加拦截器。`example` 和 `description` 标签仅用于文档，不是运行时默认值或验证规则。

## 弃用输入与兼容性 {#deprecated}

`path.Int`, `path.String`, `path.Boolean`, `query.Values`, `header.Values`、Values 的构造与查询 API 和 `query.Pagination` 均为 Deprecated。在同一处理器中与新的 Path、Query、Header DTO 混用会在准备时被拒绝。现有请求体 DTO 和 context 仍受支持。兼容路径 `adapter`, `adapter/http`, `adapter/event`, `adapter/websocket` 也已弃用，请按用途使用 `contract/http`, `contract/event`, `contract/validator`, `contract/websocket`。HTTP v2 实现不会自动转换为 v3。

## 描述与验证 {#verification}

含新控制器的应用在准备前调用 `spine.DescribeHTTP` 会返回 `spine.ErrRoutesNotCollected`。调用方执行 `app.Prepare` 后使用 `spine.DescribePreparedHTTP` 查询，并关闭准备结果。准备过程可能初始化已配置的数据库或消息代理。CLI 静态分析不执行用户代码，可能无法解析动态路径或拦截器列表。`--source runtime` 也不会自动执行 Prepare。

静态 OpenAPI 不执行验证器，无法确定验证约束。请在准备好的应用中查看反映所选验证器的描述。不支持的示例或规则可能产生诊断，电子邮件、URI、UUID 和正则表达式的等价性无法保证。整数边界在规范中精确保留。

迁移后运行 `spine contract check` 和 `spine verify`，并检查实际 HTTP 请求与描述。输入迁移和 HTTP v3 的其他限制请参阅以下文档。

- [v0.7.1](/zh-Hans/learn/migration/v0.7.1-preview)
- [HTTP v3](/zh-Hans/learn/migration/preview-features#body)
