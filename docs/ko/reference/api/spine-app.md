# spine.App API

::: info 0.7.5
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

앱 조립, 실행과 준비 결과의 소유권을 설명합니다. 아래 코드는 필요한 타입과 import를 갖춘 앱에 적용하는 구성 조각입니다.

<span id="platform-options"></span>

## 조립 {#composition}

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

## 생성 계약 {#constructors}

객체는 Constructor(의존성...) *자기타입을 구현하고 역할별 표식으로 등록합니다. 표식 객체의 필드는 복사하지 않습니다. Custom은 외부 단일 반환 생성 함수도 받습니다. (T, error)와 가변 인자는 거부하고 일반 슬라이스 인자는 허용합니다. 중복, 누락, 순환과 모호한 인터페이스 제공자를 검사합니다. 생성 결과는 앱에서 공유합니다. 임의 DI 객체의 Close를 자동 호출하지 않습니다.

## 컨트롤러와 경로 {#routes}

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

Controller 역할의 인스턴스에서 Prepare가 RegisterRoutes를 수집하고 고정합니다. Registry와 Group은 path, handler, options... 순서이며 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS를 지원합니다. 같은 메서드의 겹치는 경로는 거부합니다. app.Route와 역할 없는 객체 등록 및 route.WithInterceptors는 Deprecated 호환 API입니다.

<span id="event-publishing"></span>

## 실행과 자원 {#lifecycle}

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

Validate는 생성자를 실행하지 않는 구성 검증입니다. Prepare는 DI, 등록 수집과 필요한 외부 초기화를 실행하지만 리스너나 컨슈머 루프를 시작하지 않습니다. 반환한 준비 결과는 호출자가 Close해야 합니다. Run/RunContext는 준비와 서버 실행 및 정상 종료를 관리합니다. HTTP가 nil이면 HTTP 런타임을 켜지 않습니다. 검증기는 boot의 자동 검사 스위치가 아니라 WithValidator로 등록합니다.

[DI 예제](/ko/learn/tutorial/3-dependency-injection) | [플랫폼](/ko/learn/getting-started/platforms) | [OpenAPI](/ko/reference/api/openapi)

## HTTP 실행 옵션 {#boot-options}

boot.Options의 Address는 리스너 주소, EnableGracefulShutdown과 ShutdownTimeout은 종료 정책입니다. HTTP가 nil이면 HTTP를 실행하지 않습니다. 이벤트 플랫폼은 WithEventAdapter로 독립 등록합니다. HTTP 옵션의 시간과 크기 0은 기본값이며 MaxBodyBytes의 음수만 본문 제한을 해제합니다.

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

TLS는 인증서를 로드한 tls.Config를 전달하며 nil이면 평문 HTTP입니다. DisableRecover 지원 여부는 플랫폼 capability에 따릅니다. multipart 메모리 예산은 요청 전체 메모리 상한이 아닙니다. 자세한 제한, WebSocket과 전송 보안은 [보안 설정](/ko/reference/security-configuration), 명세 옵션은 [OpenAPI](/ko/reference/api/openapi)를 참고하세요.
