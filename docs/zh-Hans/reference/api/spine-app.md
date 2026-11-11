# spine.App API

::: info 0.7.5
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

介绍应用组装、执行及准备结果的资源所有权。以下片段假设应用已具备所需类型与导入。

<span id="platform-options"></span>

## 组装 {#composition}

```go
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(
		constructor.Custom(database.NewDB),
		constructor.Repository(&UserRepository{}),
		constructor.Service(&UserService{}),
		constructor.Controller(&UserController{}),
		constructor.Interceptor(&TxInterceptor{}),
	)
	app.InterceptorFor(boot.InterceptorHTTP, (*TxInterceptor)(nil))
	return app, boot.Options{
		Address: ":8080",
		HTTP: &boot.HTTPOptions{
			OpenAPI: boot.OpenAPIOptions{Enabled: true},
		},
		EnableGracefulShutdown: true,
	}, nil
}
```

## 构造契约 {#constructors}

对象实现 Constructor(dependencies...) *Self 并通过角色标记注册，不复制标记对象的字段。Custom 也接受返回单个值的外部工厂函数。不支持 (T, error) 或可变参数，支持普通切片参数。检查重复、缺失、循环及接口提供者歧义。实例在应用中共享，不会自动调用任意 DI 对象的 Close。

## 控制器与路由 {#routes}

```go
func (*UserController) Constructor(service *UserService) *UserController {
	return &UserController{service: service}
}

type CreateUser struct {
	Name string `json:"name"`
}

func (*UserController) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Tags("Users"))
	users.GET("/:id", func(id input.Path[int64]) httpx.Response[map[string]int64] {
		return httpx.Response[map[string]int64]{Body: map[string]int64{"id": *id}}
	})
	users.POST("/", func(body input.Body[CreateUser]) httpx.Response[CreateUser] {
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: 201}}
	})
}
```

Prepare 从 Controller 角色实例收集并冻结 RegisterRoutes。Registry 与 Group 参数顺序为 path, handler, options...，支持 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS。同一方法存在重叠路径时拒绝。app.Route、未标记对象注册与 route.WithInterceptors 是弃用的兼容 API。

<span id="event-publishing"></span>

## 执行与资源 {#lifecycle}

```go
type App interface {
	Constructor(...any)
	// Deprecated: use RegisterRoutes.
	Route(string, string, any, ...api.Option)
	Interceptor(...core.Interceptor)
	InterceptorFor(boot.InterceptorScope, ...core.Interceptor)
	RegisterTransport(core.CustomTransport)
	Validate(boot.Options) error
	Prepare(context.Context, boot.Options) (PreparedApplication, error)
	Run(boot.Options) error
	RunContext(context.Context, boot.Options) error
	Consumers() Registrar
	WebSocket() Registrar
}
type Registrar interface{ Register(string, any) error }
type PreparedApplication interface {
	HTTPAdapter() httpcontract.HTTPAdapter
	Close(context.Context) error
}
```

Validate 不执行构造函数，只检查配置。Prepare 执行 DI、路由收集及所需外部初始化，但不启动监听器或消费循环。调用方负责 Close 准备结果。Run/RunContext 管理准备、服务运行和优雅退出。HTTP 为 nil 时禁用 HTTP 运行时。验证器通过 WithValidator 注册，不存在自动调用任意 DTO 方法的 boot 开关。

[DI 示例](/zh-Hans/learn/tutorial/3-dependency-injection) | [平台](/zh-Hans/learn/getting-started/platforms) | [OpenAPI](/zh-Hans/reference/api/openapi)

## HTTP 运行选项 {#boot-options}

boot.Options.Address 是监听地址，EnableGracefulShutdown 和 ShutdownTimeout 控制关闭策略。HTTP 为 nil 则不运行 HTTP，事件平台通过 WithEventAdapter 独立注册。HTTP 时间和大小为 0 时选择默认值，只有负数 MaxBodyBytes 会关闭正文限制。

```go
options := boot.Options{
	Address:                ":8080",
	EnableGracefulShutdown: true,
	ShutdownTimeout:        10 * time.Second,
	HTTP: &boot.HTTPOptions{
		GlobalPrefix:         "/api",
		ReadHeaderTimeout:    5 * time.Second,
		ReadTimeout:          30 * time.Second,
		WriteTimeout:         30 * time.Second,
		IdleTimeout:          60 * time.Second,
		MaxHeaderBytes:       1 << 20,
		MaxBodyBytes:         8 << 20,
		MultipartMemoryBytes: 4 << 20,
	},
}
```

| HTTPOptions | Type |
| --- | --- |
| TLS | *tls.Config |
| OpenAPI | boot.OpenAPIOptions |
| GlobalPrefix | string |
| DisableRecover | bool |
| ReadHeaderTimeout / ReadTimeout / WriteTimeout / IdleTimeout | time.Duration |
| MaxHeaderBytes | int |
| MaxBodyBytes / MultipartMemoryBytes | int64 |
| WebSocket | boot.WebSocketOptions |

TLS 传入已加载证书的 tls.Config，nil 使用明文 HTTP。DisableRecover 取决于平台能力。multipart 内存预算不代表请求总内存上限。限制、WebSocket 和传输安全参见[安全设置](/zh-Hans/reference/security-configuration)，规范设置参见 [OpenAPI](/zh-Hans/reference/api/openapi)。
