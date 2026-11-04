# 현재 릴리스

::: warning v0.7.0 미리보기 입력 API 전환
이 페이지의 기존 API 설명과 예제는 안정 버전 `v0.6.5` 기준입니다. `v0.7.0-preview.1`부터 출처별 Path, Query, Header DTO를 지원하며 `query.Values`, `header.Values`와 해당 생성/조회 API, `query.Pagination`, `path.Int`, `path.String`, `path.Boolean`은 Deprecated입니다.

새 DTO 방식은 `v0.6.5`에 그대로 적용할 수 없습니다. 미리보기에서도 한 핸들러 안에서 새 DTO와 Deprecated 입력을 혼용하면 부팅 시 거부합니다. 기존 본문 DTO와 context는 계속 함께 사용할 수 있습니다.

적용 버전과 전환 예제는 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview), 명세 옵션은 [런타임 OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

일반 설치는 `@latest`를 사용합니다. 현재 문서 기준은 Spine v0.6.5와 CLI v0.4.2입니다. 설치된 CLI는 `spine version`, 실제 의존성은 생성된 `go.mod`에서 확인하세요.

## Spine v0.7.0 미리보기 1 {#spine-preview}

미리보기로 공개한 태그는 코어 `v0.7.0-preview.1`과 각 독립 플랫폼 및 playground `v0.2.0-preview.1`입니다. 안정 문서의 기준인 `v0.6.5`와 구분해서 선택하세요.

출처별 Path, Query, Header DTO와 기존 입력 API의 Deprecated, 혼용 시 부팅 거부와 본문 바인딩 변경을 안내합니다. 표준 OpenAPI는 `Enabled: true`로 명시적으로 켭니다.

[핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview)과 [런타임 OpenAPI 참조](/ko/reference/api/openapi)에서 적용 버전, 호환성 범위와 사용법을 확인하세요.

## Spine v0.6.5 / CLI v0.4.2

HTTP, WebSocket, 이벤트와 DTO 검증의 공개 계약을 `contract/`로 통합했습니다. `spine.New(...)`에서 독립 플랫폼을 선택하며 Kafka, RabbitMQ boot 옵션은 제거했습니다. CLI 0.4.2는 구현 선택과 v0.6.5 레시피를 생성합니다.

[플랫폼과 DTO 검증 선택](/ko/learn/getting-started/platforms)

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

## Spine CLI v0.4.1

공식 설치 경로는 `github.com/NARUBROWN/spine-cli/cmd/spine`, 호출 명령은 `spine`으로 안내합니다. 기존 앱의 마이그레이션 가이드와 오프라인 계약 검사의 모듈 캐시 준비 절차를 추가한 패치이며, CLI v0.4.0의 명령과 생성 동작은 유지합니다.

- [CLI v0.4.1 릴리스](https://github.com/NARUBROWN/spine-cli/releases/tag/v0.4.1)
- [기존 앱 마이그레이션 가이드](https://github.com/NARUBROWN/spine-cli/blob/v0.4.1/migration/v0.4.0.md)

## Spine CLI v0.4.0

CLI v0.4.0은 Spine v0.6.0, Echo 플랫폼 v0.1.0과 HTTP 어댑터 v2 계약을 지원합니다.

- [CLI 설치](/ko/learn/getting-started/installation)
- [첫 앱 만들기](/ko/learn/getting-started/first-app)
