# spine.App API

::: info 0.7.5
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Application composition, execution, and ownership of prepared resources. The fragments below assume the required application types and imports.

<span id="platform-options"></span>

## Composition {#composition}

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

## Constructor contract {#constructors}

Objects implement Constructor(dependencies...) *Self and use role markers. Marker fields are not copied. Custom also accepts external single-result factory functions. (T, error) and variadic arguments are rejected; ordinary slice arguments are allowed. Duplicate, missing, cyclic, and ambiguous interface providers are checked. Instances are shared within the app. Arbitrary DI objects’ Close methods are not called automatically.

## Controllers and routes {#routes}

```go
func (*UserController) Constructor(service *UserService) *UserController {
	return &UserController{service: service}
}
func (c *UserController) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Tags("Users"))
	users.GET("/:id", c.Get)
	users.POST("/", c.Create)
}
```

Prepare collects and freezes RegisterRoutes on Controller-role instances. Registry and Group take path, handler, options... and support GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS. Overlapping routes for the same method are rejected. app.Route, unmarked object registration, and route.WithInterceptors are deprecated compatibility APIs.

<span id="event-publishing"></span>

## Execution and resources {#lifecycle}

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

Validate checks configuration without executing constructors. Prepare executes DI, route collection, and required external initialization but starts no listener or consumer loop. The caller must Close the prepared result. Run/RunContext manage preparation, serving, and graceful shutdown. A nil HTTP option disables the HTTP runtime. Register validation with WithValidator; there is no boot switch that invokes arbitrary DTO methods.

[DI example](/en/learn/tutorial/3-dependency-injection) | [Platforms](/en/learn/getting-started/platforms) | [OpenAPI](/en/reference/api/openapi)

## HTTP runtime options {#boot-options}

boot.Options.Address is the listener address; EnableGracefulShutdown and ShutdownTimeout control shutdown. HTTP nil disables HTTP. Register event platforms separately through WithEventAdapter. Zero HTTP timeouts and sizes choose defaults; only a negative MaxBodyBytes disables its limit.

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

Pass a tls.Config with certificates for TLS; nil uses plaintext HTTP. DisableRecover support depends on platform capabilities. The multipart memory budget is not a total request-memory cap. See [security settings](/en/reference/security-configuration) for limits, WebSocket and transport security, and [OpenAPI](/en/reference/api/openapi) for schema options.
