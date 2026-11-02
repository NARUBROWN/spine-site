# 보안 설정

Spine v0.6.0은 브로커의 암호화된 연결과 HTTP 및 WebSocket의 크기, 시간, 연결 수 제한을 기본으로 적용합니다. 이 참조에서 기본값과 설정 제약을 확인하고, 배포할 앱의 출처, 인증과 메시지 실패 정책을 선택하십시오.

## 설정 검증

`App.Validate`는 네트워크 연결을 열지 않고 부트 옵션을 검사합니다. `App.Run`도 시작 전에 같은 검사를 수행합니다. 생성자와 의존성 구성, 브로커 연결의 성공 여부는 이 사전 검증에 포함되지 않습니다.

```go
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

오류는 `*boot.ConfigError`로 반환합니다. `Issues`의 각 `ConfigIssue`는 다음 필드를 제공합니다. 프로그램에서 오류를 분류할 때는 메시지를 파싱하지 않고 `Code`를 사용하십시오. 브로커 URL의 자격 증명은 설정 오류에 노출하지 않습니다.

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
| RabbitMQ 발행 | 메시지 영속화, 필수 라우팅, 발행 확인, 유한 재시도 | `PublisherRetry` |
| RabbitMQ 처리 실패 | 재큐잉하지 않고 거부 | `FailurePolicy` |
| RabbitMQ 동시 처리 | 소비자당 미확인 메시지 1개 | 양의 `PrefetchCount` |
| 소비자 전송 실패 | 지수 백오프와 지터를 적용해 리더 재생성 | `ConsumerRetry` |
| WebSocket 출처 | 브라우저 요청은 프로토콜과 호스트가 같은 출처만 허용 | `AllowedOrigins` |
| WebSocket 연결 수 | 연결과 연결 대기 요청을 합쳐 1024개 | 양의 `MaxConnections` 또는 `boot.UnlimitedWebSocketConnections` |
| WebSocket 연결 인증 | 선택적 인터페이스를 구현한 인터셉터만 업그레이드 전에 실행 | `core.WebSocketHandshakeInterceptor` 구현 |
| 전역 인터셉터 | HTTP와 WebSocket 모두에 적용 | `InterceptorFor`로 범위 제한 |
| 자격 증명을 허용하는 CORS | 명시적 출처 필요 | `*`와 `AllowCredentials: true`를 함께 사용할 수 없음 |
| 쿠키 | 응답 기록 전에 유효하지 않은 필드 거부 | 임의 값을 보존해야 할 때 `httpx.EncodeCookieValue` 사용 |

## Kafka

`boot.KafkaOptions`의 `Read`와 `Write`는 독립적으로 활성화합니다. 둘 중 하나라도 설정하면 `Brokers`가 필요하고, `Read`를 사용하면 `GroupID`도 지정해야 합니다. 별도 전송 설정이 없으면 소비자와 발행기 모두에 TLS 1.2 이상을 적용합니다.

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    Read:  &boot.KafkaReadOptions{GroupID: "orders"},
    Write: &boot.KafkaWriteOptions{},
}
```

사용자 정의 CA, mTLS, SASL이 필요하면 `TLS`, `Dialer`, `Transport`를 설정합니다. 활성화한 역할에 명시적 TLS와 `AllowInsecureTransport`를 함께 설정하면 `KAFKA_TLS_INSECURE_CONFLICT` 오류가 발생합니다. 평문 연결은 격리된 로컬 개발 환경에서만 명시적으로 허용하십시오.

```go
Kafka: &boot.KafkaOptions{
    Brokers:                []string{"localhost:9092"},
    AllowInsecureTransport: true,
    Read:                   &boot.KafkaReadOptions{GroupID: "local"},
}
```

리더 오류나 ACK/NACK 실패 뒤에는 `ConsumerRetry`에 따라 기존 리더를 닫고 새 리더를 만듭니다. 이 옵션은 전송 계층의 재연결을 제어하며, 핸들러의 메시지 처리 정책을 바꾸지 않습니다.

| `ConsumerRetryOptions` 필드 | 타입 | 기본값 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5초 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2, 즉 20% |
| `MaxAttempts` | `int` | `0`, 무제한 재시도 |

각 필드의 `0`은 기본값을 선택합니다. 음수는 허용하지 않습니다. 명시한 지연 상한은 최초 지연 이상이어야 하며, 배수는 1 이상, 지터는 0에서 1 사이여야 합니다. 같은 옵션을 RabbitMQ 소비자에도 적용합니다.

Kafka 핸들러는 재전달을 고려해 멱등하게 구현해야 합니다. 영구적으로 처리할 수 없는 메시지를 자동으로 건너뛰거나 별도 실패 큐로 보내지는 않습니다.

## RabbitMQ

운영 URL은 `amqps://`를 사용합니다. 활성화한 `Read`와 `Write`에는 각각 `Exchange`가 필요합니다. 기본 실패 정책은 재큐잉 없는 거부입니다.

```go
RabbitMQ: &boot.RabbitMqOptions{
    URL: "amqps://user:pass@rabbit.example/vhost",
    PublisherRetry: boot.PublisherRetryOptions{
        InitialDelay:   200 * time.Millisecond,
        MaxDelay:       5 * time.Second,
        MaxAttempts:    5,
        ConfirmTimeout: 5 * time.Second,
    },
    Read: &boot.RabbitMqReadOptions{
        Exchange:      "events",
        PrefetchCount: 16,
        FailurePolicy: boot.RabbitMqFailureReject,
        DeadLetter: &boot.RabbitMqDeadLetterOptions{
            Exchange:   "events.dlx",
            RoutingKey: "events.failed",
        },
    },
    Write: &boot.RabbitMqWriteOptions{Exchange: "events"},
}
```

| 읽기 설정 | 기본값과 제약 |
| --- | --- |
| `PrefetchCount` | `0`이면 소비자당 미확인 메시지 1개. 직접 지정할 때는 양수 |
| `FailurePolicy` | 생략하면 `boot.RabbitMqFailureReject`. 재큐잉하려면 `boot.RabbitMqFailureRequeue` |
| `DeadLetter` | 기본값 `nil`. 설정할 때는 사전에 생성한 DLX의 `Exchange`가 필요하며 `RoutingKey`도 지정 가능 |
| `RequeueOnError` | 이전 버전과의 호환용. `true`이면 재큐잉. 명시한 `FailurePolicy`와 충돌하면 설정 오류 |

DLX는 처리하지 못한 메시지를 받는 교환기입니다. 운영자가 먼저 생성해야 하며, 일치하는 DLX 구성이 없으면 거부한 메시지가 폐기될 수 있습니다. 기존 큐의 인자와 새 설정이 다르면 RabbitMQ가 큐 선언 조건 불일치 오류를 반환할 수 있습니다.

`RabbitMqFailureRequeue`를 사용하면 처리할 수 없는 메시지를 무기한 다시 전달할 수 있습니다. 새 구성에는 거부 정책과 DLX를 사용하십시오. `RequeueOnError`는 사용 중단 예정이며 새 코드에서는 `FailurePolicy`를 사용합니다. 핸들러를 선택하는 키는 AMQP `Type`이 아니라 큐를 바인딩한 `RoutingKey`입니다.

발행기는 영속 메시지, `mandatory=true`와 발행 확인을 사용합니다. 메시지를 라우팅할 수 없거나 확인이 거부 또는 유실되면 성공으로 처리하지 않습니다. 확인 유실 뒤 재시도하면 같은 메시지를 중복 발행할 수 있으므로 소비자는 멱등해야 합니다.

| `PublisherRetryOptions` 필드 | 타입 | 기본값 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5초 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2, 즉 20% |
| `MaxAttempts` | `int` | 총 3회 시도 |
| `ConfirmTimeout` | `time.Duration` | 5초 |

각 필드의 `0`은 기본값을 선택합니다. 음수는 허용하지 않으며, 지연 범위와 배수 및 지터의 제약은 `ConsumerRetryOptions`와 같습니다. `MaxAttempts`를 늘리면 발행 중복 가능성도 고려해야 합니다.

## WebSocket

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

```go
func (i *AuthInterceptor) PreHandshake(
    ctx core.WebSocketHandshakeContext,
    meta core.HandlerMeta,
) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("missing credentials")
    }
    return i.verify(token)
}
```

연결 전 컨텍스트와 메시지 컨텍스트는 원래 요청의 헤더, 쿼리, 쿠키, 원격 주소, 호스트와 요청 URI를 보존합니다. 공개 인터페이스는 [실행 컨텍스트 참조](/ko/reference/api/execution-context#websocket-request-context)를 참고하십시오.

## CORS와 쿠키 {#cors-cookies}

`AllowOrigins: []string{"*"}`와 `AllowCredentials: true`는 함께 사용할 수 없습니다. 시작 단계에서 검사하려면 `cors.NewValidated`를 사용하십시오. `cors.New`도 첫 요청에서 응답 헤더를 쓰기 전에 구조화된 오류를 반환합니다.

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

## 운영 시 제약

- `WEBSOCKET_CAPACITY_EXCEEDED`, 소비자 재연결 시도 소진과 RabbitMQ `Type` 및 `RoutingKey` 불일치를 감시합니다.
- Kafka와 RabbitMQ 소비자는 멱등하게 구현합니다. Kafka에서 처리할 수 없는 메시지와 RabbitMQ DLX를 운영하는 절차도 준비합니다.
- 실제 소켓 쓰기와 브로커 발행은 DB 커밋과 원자적으로 묶이지 않습니다. 원자성이 필요하면 트랜잭셔널 아웃박스와 멱등 키를 사용합니다.
- 지원 버전은 [현재 릴리스](/ko/community/changelog)에서 확인하십시오.
