# spine.App API

::: info 0.7.5
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

介紹應用組裝、執行與準備結果的資源所有權。以下片段假設應用已具備所需型別與匯入。

<span id="platform-options"></span>

## 組裝 {#composition}

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

## 建構契約 {#constructors}

物件實作 Constructor(dependencies...) *Self 並透過角色標記註冊，不複製標記物件的欄位。Custom 也接受回傳單一值的外部工廠函式。不支援 (T, error) 或可變參數，支援一般切片參數。檢查重複、缺漏、循環及介面提供者歧義。執行個體在應用中共用，不會自動呼叫任意 DI 物件的 Close。

## 控制器與路由 {#routes}

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

Prepare 從 Controller 角色執行個體收集並固定 RegisterRoutes。Registry 與 Group 參數順序為 path, handler, options...，支援 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS。同一方法存在重疊路徑時拒絕。app.Route、未標記物件註冊與 route.WithInterceptors 是棄用的相容 API。

<span id="event-publishing"></span>

## 執行與資源 {#lifecycle}

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

Validate 不執行建構函式，只檢查設定。Prepare 執行 DI、路由收集與所需外部初始化，但不啟動監聽器或消費迴圈。呼叫端負責 Close 準備結果。Run/RunContext 管理準備、服務執行與正常關閉。HTTP 為 nil 時停用 HTTP 執行階段。驗證器透過 WithValidator 註冊，不存在自動呼叫任意 DTO 方法的 boot 開關。

[DI 範例](/zh-Hant/learn/tutorial/3-dependency-injection) | [平台](/zh-Hant/learn/getting-started/platforms) | [OpenAPI](/zh-Hant/reference/api/openapi)

## HTTP 執行選項 {#boot-options}

boot.Options.Address 是監聽位址，EnableGracefulShutdown 與 ShutdownTimeout 控制關閉策略。HTTP 為 nil 則不執行 HTTP，事件平台透過 WithEventAdapter 獨立註冊。HTTP 時間與大小為 0 時選擇預設值，只有負數 MaxBodyBytes 會關閉本文限制。

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

TLS 傳入已載入憑證的 tls.Config，nil 使用明文 HTTP。DisableRecover 取決於平台能力。multipart 記憶體預算不代表請求總記憶體上限。限制、WebSocket 與傳輸安全參見[安全設定](/zh-Hant/reference/security-configuration)，規格設定參見 [OpenAPI](/zh-Hant/reference/api/openapi)。
