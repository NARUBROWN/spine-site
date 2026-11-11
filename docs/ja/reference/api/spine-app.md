# spine.App API

::: info 0.7.5
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

アプリの構成、実行、準備済みリソースの所有権を説明します。以下の断片では必要な型と import があるものとします。

<span id="platform-options"></span>

## 構成 {#composition}

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

## 生成契約 {#constructors}

オブジェクトは Constructor(dependencies...) *Self を実装し、役割マーカーで登録します。マーカーのフィールドはコピーしません。Custom は外部の単一戻り値の生成関数も受け取ります。(T, error) と可変長引数は拒否し、通常のスライス引数は許可します。重複、欠落、循環、曖昧なインターフェース提供を検証します。インスタンスはアプリ内で共有します。任意の DI オブジェクトの Close は自動実行しません。

## コントローラーとルート {#routes}

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

Prepare は Controller 役割のインスタンスから RegisterRoutes を収集して固定します。Registry と Group は path, handler, options... の順で GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS に対応します。同一メソッドで重複する経路は拒否します。app.Route、役割なしのオブジェクト登録、route.WithInterceptors は非推奨の互換 API です。

<span id="event-publishing"></span>

## 実行とリソース {#lifecycle}

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

Validate は生成関数を実行せずに構成を検証します。Prepare は DI、登録収集、必要な外部初期化を実行しますが listener や consumer ループは開始しません。呼び出し側が準備結果を Close します。Run/RunContext は準備、実行、正常終了を管理します。HTTP が nil なら HTTP は無効です。検証器は WithValidator で登録し、任意の DTO メソッドを呼ぶ boot スイッチはありません。

[DI の例](/ja/learn/tutorial/3-dependency-injection) | [プラットフォーム](/ja/learn/getting-started/platforms) | [OpenAPI](/ja/reference/api/openapi)

## HTTP 実行オプション {#boot-options}

boot.Options.Address はリスナーのアドレスで、EnableGracefulShutdown と ShutdownTimeout は終了方針です。HTTP が nil なら HTTP を実行しません。イベントは WithEventAdapter で別に登録します。HTTP の時間とサイズの 0 は既定値を選び、負の MaxBodyBytes だけが本文制限を解除します。

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

TLS は証明書を読み込んだ tls.Config を渡し、nil は平文 HTTP です。DisableRecover はプラットフォーム capability に依存します。multipart メモリ予算はリクエスト全体の上限ではありません。制限、WebSocket、転送保護は[セキュリティ設定](/ja/reference/security-configuration)、仕様は [OpenAPI](/ja/reference/api/openapi)を参照してください。
