# 현재 릴리스

이 문서 사이트는 Spine v0.6.0과 Spine CLI v0.4.0를 기준으로 합니다.

## Spine v0.6.0

Spine v0.6.0의 공개 API와 런타임은 다음 기능을 제공합니다.

- HTTP 계약과 Echo 구현을 분리하고 `spine-echo-platform`으로 HTTP 앱 생성
- CLI `v0.4.0`의 기본 `new`에서 플랫폼 설치, 정적 계약 검사와 빌드 수행

- `BeforeResponse`를 포함한 4단계 인터셉터와 전송 전에 준비하는 HTTP 응답
- 네트워크에 연결하지 않고 설정을 검사하며 구조화된 `boot.ConfigError`를 반환하는 `App.Validate`
- `InterceptorFor`를 이용한 HTTP와 WebSocket 인터셉터의 적용 범위 지정
- Kafka의 TLS와 컨슈머 재시도 설정, ACK/NACK 실패 후 리더 재생성과 안전한 종료
- RabbitMQ의 암호화된 연결, 영속 메시지 발행 확인, prefetch, 실패 정책과 DLX
- WebSocket의 동일 출처 검사, 신뢰하는 프록시 설정, 연결 수 제한과 업그레이드 전 인증
- 인증 정보를 포함하는 CORS 요청과 쿠키 설정의 엄격한 검증
- 부팅 중 준비 상태 검사와 정해진 순서에 따른 종료
- 안전한 DI 싱글턴 해석, 라우터 대체 처리와 인자 변환

운영 환경의 기본값과 제약은 [보안 설정](/ko/reference/security-configuration)에서 확인하세요.

## Spine CLI v0.4.0

설치와 프로젝트 생성 예제는 Spine CLI v0.4.0를 기준으로 합니다. 이 버전의 CLI는 Spine v0.6.0을 사용하는 프로젝트를 생성합니다.

- [CLI 설치](/ko/learn/getting-started/installation)
- [첫 앱 만들기](/ko/learn/getting-started/first-app)
