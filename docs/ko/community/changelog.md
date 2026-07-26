# 현재 릴리스

## Spine v0.5.1

이 사이트는 Spine v0.5.1의 현재 공개 API와 런타임 동작을 설명합니다.

- `BeforeResponse`를 포함하는 4단계 인터셉터와 준비된 HTTP 응답
- 구조화된 `boot.ConfigError`를 반환하는 네트워크 없는 `App.Validate` 검사
- `InterceptorFor`를 통한 HTTP/WebSocket 인터셉터 범위 지정
- Kafka TLS, 제한된 consumer 재시도, ACK/NACK 실패 후 reader 재생성, 안전한 종료
- RabbitMQ 보안 전송, persistent confirmed publish, prefetch, 실패 정책, DLX
- WebSocket 동일 출처 검사, 신뢰 프록시, 연결 상한, upgrade 전 인증
- credential을 사용하는 CORS와 Cookie의 엄격한 검증
- bootstrap readiness 검사와 결정적인 종료
- 안전한 DI singleton 해석, router fallback, argument 변환

운영 설정은 [보안 설정](/ko/reference/security-configuration)을 참고하십시오.
