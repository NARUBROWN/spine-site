# 보안 설정

Spine v0.5.1은 안전한 전송과 제한된 런타임을 기본값으로 사용합니다. 배포 전에 `App.Validate`로 설정을 검사할 수 있으며, `App.Run`도 네트워크 연결을 열기 전에 같은 검증을 자동 수행합니다.

```go
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

검증 오류는 `*boot.ConfigError`이며, `Issues`의 각 `ConfigIssue`에는 `Path`, `Code`, `Message`, `Hint`가 있습니다. 자동화에서는 안정적인 `Code`를 사용하고 사람이 읽는 메시지를 파싱하지 마십시오. 브로커 URL의 자격 증명은 오류에 노출되지 않습니다.

## 안전한 기본값

| 영역 | 기본값 | 명시적 개발·호환 설정 |
|---|---|---|
| Kafka | 활성화한 reader/writer에 TLS 1.2 이상 적용 | 사용자 정의 `TLS`/`Dialer`/`Transport`, 또는 로컬 전용 `AllowInsecureTransport: true` |
| RabbitMQ | `amqps://` 필수 | `amqp://`와 `AllowInsecureTransport: true` |
| RabbitMQ 발행 | persistent, mandatory routing, publisher confirm, 유한 재시도 | `PublisherRetry` 조정 |
| RabbitMQ 처리 실패 | 재큐잉 없이 reject | `FailurePolicy: boot.RabbitMqFailureRequeue` |
| RabbitMQ prefetch | consumer당 미확인 메시지 1개 | 양의 `PrefetchCount` |
| Consumer 전송 실패 | 지수 백오프와 지터로 reader 재생성 | `ConsumerRetry` 조정 |
| WebSocket 출처 | 프로토콜과 호스트가 같은 출처만 허용 | 정확한 `AllowedOrigins` 지정 |
| WebSocket 용량 | 연결 및 대기 handshake 1024개 | 양의 제한값 또는 `boot.UnlimitedWebSocketConnections` |
| WebSocket 인증 | 선택적 handshake 인터셉터가 upgrade 전에 실행 | 인증이 필요한 route에 `WebSocketHandshakeInterceptor` 구현 |
| 전역 인터셉터 | HTTP와 WebSocket 모두에 적용 | `InterceptorFor`로 범위 제한 |
| 자격 증명 포함 CORS | 명시적 출처 필수 | `*`와 credentials 조합은 허용되지 않음 |
| 쿠키 | 응답 기록 전에 유효하지 않은 필드 거부 | 임의 값은 `httpx.EncodeCookieValue`로 인코딩 |

## Kafka

별도 전송 설정을 하지 않으면 consumer와 publisher 모두에 TLS 1.2 이상이 적용됩니다.

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    Read:  &boot.KafkaReadOptions{GroupID: "orders"},
    Write: &boot.KafkaWriteOptions{},
}
```

사용자 정의 CA, mTLS, SASL이 필요할 때만 `TLS`, `Dialer`, `Transport`를 재정의하십시오. 명시적 TLS와 `AllowInsecureTransport`를 함께 설정하면 `KAFKA_TLS_INSECURE_CONFLICT`가 발생합니다. 평문 연결은 격리된 로컬 개발 환경에서만 명시적으로 허용하십시오.

```go
Kafka: &boot.KafkaOptions{
    Brokers:                []string{"localhost:9092"},
    AllowInsecureTransport: true,
    Read:                   &boot.KafkaReadOptions{GroupID: "local"},
}
```

reader 오류 또는 ACK/NACK 실패 뒤에는 `ConsumerRetry`에 따라 기존 reader를 닫고 새 reader를 만듭니다. 기본값은 최초 100ms, 최대 5초, 배수 2, 지터 20%, 무제한 재시도입니다. Kafka handler는 재전달을 고려해 멱등하게 구현해야 하며, 영구 실패 메시지를 자동으로 건너뛰거나 DLQ로 보내지는 않습니다.

## RabbitMQ

운영 URL은 `amqps://`를 사용합니다. 기본 실패 정책은 재큐잉 없는 reject입니다.

```go
RabbitMQ: &boot.RabbitMqOptions{
    URL: "amqps://user:pass@rabbit.example/vhost",
    PublisherRetry: boot.PublisherRetryOptions{
        InitialDelay:  200 * time.Millisecond,
        MaxDelay:      5 * time.Second,
        MaxAttempts:   5,
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

DLX exchange는 운영자가 먼저 생성해야 합니다. 기존 queue 인자가 다르면 RabbitMQ가 queue precondition 오류를 반환할 수 있습니다. `RabbitMqFailureRequeue`는 poison message를 무기한 다시 전달할 수 있으므로, 새 구성에는 reject와 DLX를 사용하십시오. `RequeueOnError`는 사용 중단 예정이며 새 코드에서는 `FailurePolicy`를 사용합니다. dispatch key는 AMQP `Type`이 아니라 queue binding의 `RoutingKey`입니다.

Publisher는 persistent 메시지, `mandatory=true`, publisher confirm을 사용합니다. 라우팅 불가나 negative/missing confirm은 성공이 아닙니다. confirm 유실 뒤 재시도는 중복 발행을 만들 수 있으므로 consumer는 멱등해야 합니다.

## WebSocket

정확한 출처와 연결 상한을 지정하는 것이 좋습니다.

```go
HTTP: &boot.HTTPOptions{
    WebSocket: boot.WebSocketOptions{
        AllowedOrigins: []string{"https://app.example.com"},
        MaxConnections: 4096,
    },
},
```

`AllowedOrigins`가 비어 있으면 브라우저 요청의 프로토콜과 호스트가 모두 같아야 합니다. TLS 종료 프록시 뒤에서는 `TrustedProxyCIDRs`를 지정할 수 있습니다. `Forwarded`와 `X-Forwarded-Proto`는 요청 상대가 이 목록에 있을 때만 신뢰하며, 프록시는 외부 전달 헤더를 제거하거나 덮어써야 합니다.

기본 연결 상한은 `boot.DefaultWebSocketMaxConnections`(1024)입니다. 한도에는 인증을 기다리는 handshake도 포함됩니다. 초과 요청은 upgrade되지 않고 HTTP 503, `Retry-After`, `WEBSOCKET_CAPACITY_EXCEEDED` JSON을 받습니다.

인증 인터셉터는 `core.WebSocketHandshakeInterceptor`를 추가로 구현하십시오. `PreHandshake`는 slot 예약 뒤, HTTP upgrade 전에 실행됩니다.

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

handshake와 메시지 컨텍스트는 header, query, cookie, remote address, host, request URI의 불변 snapshot을 제공합니다.

## CORS와 쿠키

`AllowOrigins: []string{"*"}`와 `AllowCredentials: true`는 유효하지 않습니다. 시작 단계에서 검사하려면 `cors.NewValidated`를 사용하십시오. 기존 `cors.New`도 첫 요청에서 응답 헤더를 쓰기 전에 구조화된 오류를 반환합니다.

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
    AllowOrigins:     []string{"https://app.example.com"},
    AllowCredentials: true,
})
```

쿠키 이름·값·경로·도메인·SameSite·Priority가 유효하지 않으면 JSON, 문자열, 바이너리, 리다이렉트 handler는 헤더나 본문을 쓰기 전에 실패합니다. 유니코드나 구분자를 왕복해야 할 때만 `httpx.EncodeCookieValue`와 `httpx.DecodeCookieValue`를 사용하십시오.

## 운영 점검

- `WEBSOCKET_CAPACITY_EXCEEDED`, consumer 재연결 소진, RabbitMQ `Type`/`RoutingKey` 불일치를 감시합니다.
- Kafka/RabbitMQ consumer를 멱등하게 만들고, Kafka 독성 메시지 및 RabbitMQ DLX 운영 절차를 준비합니다.
- 실제 socket 쓰기와 broker publish는 DB commit과 원자적으로 묶이지 않습니다. 원자성이 필요하면 transactional outbox와 멱등 키를 사용합니다.
- 지원 버전은 [현재 릴리스](/ko/community/changelog)에서 확인하십시오.
