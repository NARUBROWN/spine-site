# 릴리스 노트

현재 API 사용법은 [0.7.5 전환 안내](/ko/learn/migration/v0.7.5)에서 확인하세요. 아래 발행 정보와 과거 릴리스 기록은 각 태그 기준입니다.

[저장소별 버전 현황](/ko/community/versions)에서 최신 태그와 다음 목표 버전을 확인하세요.

Preview, RC, 정식 채널의 선택과 발행 절차는 [릴리스 채널과 설치](/ko/community/release-channels)에서 확인하세요.

## Spine v0.7.1

Spine `v0.7.1`은 컨트롤러 라우트와 역할별 생성자, 출처별 HTTP 입력, 런타임 OpenAPI와 HTTP v3를 제공합니다. 이전 입력 API는 호환되지만 Deprecated이며 새 입력과 같은 핸들러에서 혼용할 수 없습니다.

[v0.7.1 전환 안내](/ko/learn/migration/v0.7.1)와 [런타임 OpenAPI](/ko/reference/api/openapi)를 참고하세요. CLI 버전과 앱 의존성은 별도로 선택합니다. 설치한 CLI는 `spine version`, 실제 의존성은 `go.mod`에서 확인하세요. 아래 항목은 해당 버전의 과거 기록입니다.

## Preview CLI @preview {#cli-preview-branch}

CLI는 `@preview`로 설치할 수 있습니다. 앱 의존성은 CLI 채널과 별도로 `spine new --channel preview`, `rc`, `main` 중에서 선택합니다. Preview 채널은 선택한 의존성의 이동하는 `@preview` 브랜치를 조회합니다. 재현하려면 앱 소스와 `go.mod`, `go.sum`을 보관하세요.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

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
