# 보안 설정

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

Spine `v0.7.5`는 HTTP와 WebSocket의 크기, 시간과 연결 수를 제한합니다. 브로커 전송 정책은 독립 플랫폼이 관리합니다. 사용하는 플랫폼 버전과 설정을 함께 확인하세요.

## 설정 검증

App.Validate는 리스너 없이 부트 옵션과 실행 없이 확인 가능한 DI 구성을 검사합니다. Run도 시작 전에 검사합니다. 실제 생성자 실행과 DB 또는 브로커 연결 성공은 준비 단계와 실제 요청에서 따로 확인해야 합니다.

```go
if err := app.Validate(options); err != nil {
	log.Fatal(err)
}
if err := app.Run(options); err != nil {
	log.Fatal(err)
}
```

부트 설정 오류는 `*boot.ConfigError`의 `Issues`로 확인합니다. 외부 플랫폼의 `NewFactory`가 반환하는 설정 오류는 별도로 확인하세요. 오류 분류에는 메시지 문자열 대신 공개 오류와 코드를 사용하고 브로커 자격 증명을 로그에 남기지 않습니다.

| 필드 | 의미 |
| --- | --- |
| `Path` | 문제가 있는 설정 위치 |
| `Code` | 오류 분류 코드 |
| `Message` | 사람이 읽는 오류 설명 |
| `Hint` | 설정을 수정하는 방법 |

## 안전한 기본값

| 영역 | 기본 동작 | 조정 방법 |
| --- | --- | --- |
| HTTP | 읽기와 쓰기 시간, 헤더와 본문 크기 제한 | [`boot.HTTPOptions`](/ko/reference/api/spine-app#boot-options) |
| Kafka | 활성화한 소비자와 발행기에 TLS 1.2 이상 적용 | `TLS`, `Dialer`, `Transport`. 로컬 평문 연결은 `AllowInsecureTransport: true` |
| RabbitMQ 연결 | `amqps://` 필수 | 로컬 평문 연결은 `amqp://`와 `AllowInsecureTransport: true` |
| RabbitMQ 발행 | persistent / mandatory / publisher confirm | `OperationTimeout` |
| RabbitMQ 처리 실패 | 재큐잉하지 않고 거부 | `rabbitmqplatform.Config.FailurePolicy` |
| RabbitMQ 동시 처리 | 소비자당 미확인 메시지 1개 | 양의 `PrefetchCount` |
| 소비자 전송 실패 | 지수 백오프와 지터를 적용해 리더 재생성 | `spine.WithEventConsumerRetry` |
| WebSocket 출처 | 브라우저 요청은 프로토콜과 호스트가 같은 출처만 허용 | `AllowedOrigins` |
| WebSocket 연결 수 | 연결과 연결 대기 요청을 합쳐 1024개 | 양의 `MaxConnections` 또는 `boot.UnlimitedWebSocketConnections` |
| WebSocket 연결 인증 | 선택적 인터페이스를 구현한 인터셉터만 업그레이드 전에 실행 | `core.WebSocketHandshakeInterceptor` 구현 |
| 전역 인터셉터 | HTTP와 WebSocket 모두에 적용 | `InterceptorFor`로 범위 제한 |
| 자격 증명을 허용하는 CORS | 명시적 출처 필요 | `*`와 `AllowCredentials: true`를 함께 사용할 수 없음 |
| 쿠키 | 응답 기록 전에 유효하지 않은 필드 거부 | 임의 값을 보존해야 할 때 `httpx.EncodeCookieValue` 사용 |

## Kafka

`kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"`을 import합니다. `Config.Consume`과 `Config.Publish`로 역할을 선택하며 `Brokers`가 필요합니다. 소비자는 `GroupID`도 지정합니다. 다음 코드는 `BuildApplication` 안에서 사용하며 `echoplatform`, `spine`, `boot`, `time`도 import합니다.

```go
factory, err := kafkaplatform.NewFactory(kafkaplatform.Config{
	Brokers:     []string{"kafka.example.com:9093"},
	Consume:     true,
	Publish:     true,
	GroupID:     "orders",
	TopicPrefix: "prod.",
})
if err != nil {
	return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory,
	spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{MaxAttempts: 5}),
	spine.WithEventSettlementTimeout(5*time.Second),
))
```

Kafka 플랫폼은 별도 설정이 없으면 TLS 1.2 이상을 적용합니다. `TLS`, `Dialer`, `Transport`로 CA, mTLS, SASL을 설정합니다. `AllowInsecureTransport: true`는 격리된 로컬 평문 연결에만 사용하며 명시적 TLS와 함께 지정할 수 없습니다. `NewFactory`는 설정만 검사합니다. `Prepare`와 `Run`은 등록된 소비자의 reader를 준비할 때 브로커와 토픽을 확인합니다. Kafka 발행 전용 앱은 브로커 연결 없이 기동할 수 있으므로 실제 발행으로 연결과 전달을 별도로 확인하세요.

`Config.TopicPrefix`는 발행 이름과 소비 구독 모두에 접두사를 붙입니다. 양쪽 factory에 `prod.`를 설정하면 앱에는 `order.created`를 등록하고 브로커 토픽은 `prod.order.created`로 준비합니다. 접두사에는 구분자를 직접 포함합니다.

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})`는 리더와 ACK/NACK 실패 뒤 재연결을 제어합니다. 기본값은 최초 100ms, 최대 5초, 배수 2, 지터 0.2, `MaxAttempts: 0`의 무제한 전송 재시도입니다. 핸들러 재시도 횟수나 DLQ 정책은 지정하지 않습니다. `WithEventSettlementTimeout`의 기본 ACK/NACK 제한은 5초입니다. Kafka의 처리 실패는 뒤의 offset 커밋으로 건너뛰지 않으며 영구 실패 메시지가 파티션을 막을 수 있습니다.

## RabbitMQ

`rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"`을 import합니다. 공통 `Config.Exchange`와 `Consume`, `Publish`를 설정합니다. 기본 URL은 `amqps://`이며 로컬 `amqp://`는 `AllowInsecureTransport: true`로 명시적으로 허용합니다. 다음 코드는 `BuildApplication` 안에서 사용합니다.

```go
factory, err := rabbitmqplatform.NewFactory(rabbitmqplatform.Config{
	URL:           "amqps://user:pass@rabbit.example.com/vhost",
	Exchange:      "events",
	Consume:       true,
	Publish:       true,
	PrefetchCount: 16,
	FailurePolicy: rabbitmqplatform.FailureReject,
	DeadLetter: &rabbitmqplatform.DeadLetter{
		Exchange:   "events.dlx",
		RoutingKey: "events.failed",
	},
	OperationTimeout: 5 * time.Second,
})
if err != nil {
	return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory))
```

`PrefetchCount`를 생략하면 소비자당 미확인 메시지는 1개입니다. 실패 정책의 기본값은 `rabbitmqplatform.FailureReject`이며 `FailureRequeue`는 처리 불가능한 메시지를 무기한 다시 전달할 수 있습니다. `DeadLetter`에 지정할 교환기는 먼저 준비해야 합니다. `TopicPrefix`는 발행 라우팅 키와 구독 바인딩에 적용하고 `QueuePrefix`는 큐 이름에 적용합니다.

발행기는 영속 메시지, mandatory 라우팅과 publisher confirm을 사용합니다. `OperationTimeout` 기본값은 5초입니다. 실패한 메시지를 자동 재발행하는 `PublisherRetry` 옵션은 없습니다. 확인 유실 뒤 앱이 재시도하면 중복이 생길 수 있으므로 소비자는 멱등하게 구현합니다.

## WebSocket

HTTP는 Echo 또는 net/http, WebSocket은 독립 Gorilla 구현을 선택합니다. WebSocket 경로에는 HTTP 업그레이드 지원과 WS factory가 필요합니다. 검증기는 `playground.New()`를 `spine.WithValidator`에 전달합니다.

`boot.HTTPOptions.WebSocket`에서 출처, 연결 수와 메시지 제한을 설정합니다. 앱에서 사용할 정확한 출처와 연결 상한을 지정하십시오.

```go
HTTP: &boot.HTTPOptions{
    WebSocket: boot.WebSocketOptions{
        AllowedOrigins: []string{"https://app.example.com"},
        MaxConnections: 4096,
    },
},
```

| `WebSocketOptions` 필드 | 타입 | 기본값과 제약 |
| --- | --- | --- |
| `MaxConnections` | `int` | `0`이면 `boot.DefaultWebSocketMaxConnections`, 즉 1024. 양수로 제한하거나 `boot.UnlimitedWebSocketConnections`로 해제 |
| `CapacityRetryAfter` | `time.Duration` | 5초. 연결 상한 초과 시 `Retry-After` 값. 음수 불가 |
| `AllowedOrigins` | `[]string` | 비어 있으면 동일 출처. 직접 지정할 때는 경로, 쿼리, 프래그먼트 없는 `http://` 또는 `https://` 출처. `*`도 지원하지만 모든 출처를 허용 |
| `TrustedProxyCIDRs` | `[]string` | 기본값 없음. 전달 헤더를 신뢰할 프록시의 CIDR 목록 |
| `MaxMessageBytes` | `int64` | 1 MiB. 음수 불가 |
| `HandshakeTimeout` | `time.Duration` | 10초. 음수 불가 |
| `ReadTimeout` | `time.Duration` | 60초. 음수 불가 |
| `WriteTimeout` | `time.Duration` | 10초. 음수 불가 |
| `PingInterval` | `time.Duration` | 읽기 제한의 절반. 기본 읽기 제한에서는 30초. 음수 불가 |

시간과 크기 필드의 `0`은 기본값을 선택합니다. 연결 수 제한을 해제할 때는 `-1` 대신 이름이 있는 상수 `boot.UnlimitedWebSocketConnections`를 사용하십시오.

`AllowedOrigins`가 비어 있으면 브라우저 요청의 프로토콜과 호스트가 모두 같아야 합니다. TLS 종료 프록시 뒤에서는 `TrustedProxyCIDRs`를 지정할 수 있습니다. `Forwarded`와 `X-Forwarded-Proto`는 요청 상대가 이 목록에 있을 때만 신뢰합니다. 프록시는 외부에서 받은 전달 헤더를 제거하거나 덮어써야 합니다.

연결 상한에는 인증을 기다리는 연결 요청도 포함합니다. 초과 요청은 업그레이드하지 않고 HTTP 503과 `Retry-After` 헤더, `WEBSOCKET_CAPACITY_EXCEEDED` 코드가 있는 JSON을 반환합니다.

연결 인증이 필요하면 인터셉터에 `core.WebSocketHandshakeInterceptor`도 구현하십시오. `PreHandshake`는 연결 자리를 예약한 뒤 HTTP 업그레이드 전에 실행합니다. 메시지별 `PreHandle`과는 별도입니다.

다음은 이미 네 훅과 verify 메서드를 구현한 AuthInterceptor에 추가하는 조각입니다. spinectx는 공개 pkg/spine, core는 메타데이터, httperr는 공개 오류 패키지입니다.

```go
func (i *AuthInterceptor) PreHandshake(
	ctx spinectx.Ctx,
	meta core.HandlerMeta,
) error {
	request, ok := ctx.WebSocket()
	if !ok {
		return httperr.Unauthorized("HTTP request required")
	}
	token := request.Header("Authorization")
	if token == "" {
		return httperr.Unauthorized("missing credentials")
	}
	return i.verify(token)
}
```

연결 전 컨텍스트와 메시지 컨텍스트는 원래 요청의 헤더, 쿼리, 쿠키, 원격 주소, 호스트와 요청 URI를 보존합니다. 공개 인터페이스는 [실행 컨텍스트 참조](/ko/reference/api/execution-context#websocket-request-context)를 참고하십시오.

## CORS와 쿠키 {#cors-cookies}

`AllowOrigins: []string{"*"}`와 `AllowCredentials: true`는 함께 사용할 수 없습니다. 시작 단계에서 검사하려면 `cors.NewValidated`를 사용하십시오. `cors.New`도 첫 요청에서 응답 헤더를 쓰기 전에 구조화된 오류를 반환합니다.

CORS 사전 요청은 `OPTIONS`, `Origin`, `Access-Control-Request-Method`가 함께 있을 때 판별합니다. 허용된 요청은 204, 거부된 출처나 메서드 또는 헤더는 403입니다. 일반 요청에서 허용되지 않은 출처는 CORS 허용 헤더를 받지 않지만 서버의 인증이나 접근 제어를 대신하지 않습니다.

`MaxAge`는 초 단위 포인터입니다. nil이면 헤더를 생략하고 0이면 명시적 0을 보냅니다. `ExposeHeaders`는 일반 응답의 노출 헤더를 지정하며 `AllowOrigin`은 정적 목록에서 허용하지 않은 출처를 추가로 판단할 수 있습니다. 자격 증명을 허용할 때는 와일드카드 출처를 사용할 수 없습니다.

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
	AllowOrigins:     []string{"https://app.example.com"},
	AllowCredentials: true,
})
if err != nil {
	log.Fatal(err)
}
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
```

쿠키의 이름, 값, 경로, 도메인, `SameSite`, `Priority`가 유효하지 않으면 JSON, 문자열, 바이너리와 리다이렉트 응답은 헤더나 본문을 쓰기 전에 실패합니다. 유니코드나 구분자를 원래 값으로 복원해야 할 때는 `httpx.EncodeCookieValue`와 `httpx.DecodeCookieValue`를 사용하십시오.

### CORS 사전 요청 확인

다음 독립 앱을 Spine `v0.7.5`과 호환 Echo 플랫폼이 있는 별도 Go 모듈의 `main.go`로 저장하고 실행하세요. `Authorization`은 허용 헤더에 명시합니다.

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/interceptor/cors"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/resource", func() httpx.Response[string] { return httpx.Response[string]{Body: "ok"} })
}
func main() {
	maxAge := 60
	policy, err := cors.NewValidated(cors.Config{
		AllowOrigins:     []string{"https://app.example.com"},
		AllowMethods:     []string{"GET"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           &maxAge,
	})
	if err != nil {
		log.Fatal(err)
	}
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}))
	app.InterceptorFor(boot.InterceptorHTTP, policy)
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

첫 요청은 204와 `Access-Control-Max-Age: 60`, 두 번째는 403을 반환합니다.

```bash
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization' http://localhost:8080/resource
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: DELETE' http://localhost:8080/resource
```

## 운영 시 제약

- `WEBSOCKET_CAPACITY_EXCEEDED`, 소비자 재연결 시도 소진, reader 및 ACK/NACK 실패와 이벤트 발행 실패를 감시합니다.
- Kafka와 RabbitMQ 소비자는 멱등하게 구현합니다. Kafka에서 처리할 수 없는 메시지와 RabbitMQ DLX를 운영하는 절차도 준비합니다.
- 실제 소켓 쓰기와 브로커 발행은 DB 커밋과 원자적으로 묶이지 않습니다. 원자성이 필요하면 트랜잭셔널 아웃박스와 멱등 키를 사용합니다.
- 지원 버전은 [현재 릴리스](/ko/community/changelog)에서 확인하십시오.
