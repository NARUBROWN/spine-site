# 플랫폼과 DTO 검증 선택

::: warning v0.7.0 미리보기 입력 API 전환
이 페이지의 기존 API 설명과 예제는 안정 버전 `v0.6.5` 기준입니다. `v0.7.0-preview.1`부터 출처별 Path, Query, Header DTO를 지원하며 `query.Values`, `header.Values`와 해당 생성/조회 API, `query.Pagination`, `path.Int`, `path.String`, `path.Boolean`은 Deprecated입니다.

새 DTO 방식은 `v0.6.5`에 그대로 적용할 수 없습니다. 미리보기에서도 한 핸들러 안에서 새 DTO와 Deprecated 입력을 혼용하면 부팅 시 거부합니다. 기존 본문 DTO와 context는 계속 함께 사용할 수 있습니다.

적용 버전과 전환 예제는 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview), 명세 옵션은 [런타임 OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

Spine 0.6.5는 HTTP, WebSocket, 이벤트와 DTO 검증의 공개 계약을 코어에 두고 구체 구현은 독립 모듈로 선택합니다. 코어는 표준 라이브러리만 사용합니다. CLI 0.4.2의 `platform-contracts-v0.6.5` 레시피는 Spine v0.6.5와 각 구현의 v0.1.0 태그를 선택합니다.

## CLI 설치와 생성

일반 설치와 CLI 갱신에는 `@latest`를 사용합니다. 아래 프로젝트 생성 명령은 각각 다른 디렉터리를 만듭니다. 기본값은 HTTP Echo, WebSocket 없음, 이벤트 없음, 검증기 없음입니다.

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
spine new http-app --module example.com/http-app
spine new chat-app --module example.com/chat-app --websocket-platform gorilla
spine new worker --module example.com/worker --platform none --event-platform events:kafka
spine new validated-app --module example.com/validated-app --validator playground
```

`--platform echo|none`, `--websocket-platform none|gorilla`, 반복 가능한 `--event-platform [name:]kafka|rabbitmq`, `--validator none|playground`를 지원합니다. Gorilla는 HTTP Echo가 필요합니다. HTTP 없는 워커에는 이벤트 플랫폼이 하나 이상 필요합니다. 선택된 구현만 설치하며 생성 중 앱, factory, 리스너나 브로커를 실행하지 않습니다.

브로커 주소와 자격 증명은 생성된 README의 환경 변수로 설정합니다. 소비와 발행 역할은 앱 코드의 `Config.Consume`, `Config.Publish`로 선택합니다. 이름이 `events`인 플랫폼은 `SPINE_EVENTS_` 접두사를 사용합니다. `spine.toml`은 구현 선택을 기록합니다.

## 공개 계약과 앱 조립

| 계약 | 구현 모듈 |
| --- | --- |
| `contract/http` | `spine-echo-platform` |
| `contract/websocket` | `spine-gorilla-platform` |
| `contract/event` | `spine-kafka-platform`, `spine-rabbitmq-platform` |
| `contract/validator` | `spine-validator-playground` |

생성된 `BuildApplication`은 `spine.New(...)`에 필요한 옵션을 직접 전달합니다. HTTP는 `echoplatform.Option()`, WebSocket은 `gorillaplatform.Option()`, 이벤트는 `spine.WithEventAdapter(name, factory)`, 검증기는 `spine.WithValidator(validator)`로 연결합니다. factory와 검증기의 생성 오류는 앱을 반환하기 전에 확인합니다.

기존 `adapter`, `adapter/http`, `adapter/event`, `wsadapter`는 0.6.5에서 호환 별칭입니다. 새 구현은 `contract/` 경로를 사용합니다. HTTP 옵션만 선택해도 WebSocket 구현이 자동 추가되지는 않습니다.

## DTO 검증

`--validator playground`는 Go 1.26 이상이 필요합니다. CLI와 검증기를 선택하지 않은 앱은 Go 1.25.5 이상입니다. `playground.New()`로 만든 검증기를 `spine.WithValidator`로 등록하면 바인딩한 HTTP JSON, 폼 DTO와 WebSocket, 소비자 메시지 DTO를 핸들러 전에 검증합니다. 생략하면 `validate` 태그를 자동 검사하지 않습니다.

아래 타입은 `--validator playground`로 생성한 앱에서 사용하는 요청 DTO 예입니다.

```go
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age" validate:"gte=18"`
}
```

규칙 위반은 HTTP 400의 `message`, `fields` 응답, WebSocket 1008 종료, 소비자 NACK 정책으로 이어집니다. HTTP의 `fields[].field`는 JSON Pointer이며 거부한 입력값을 자동 노출하지 않습니다. 검증기 처리 오류는 HTTP 500, WebSocket 1011로 처리합니다.

## 기존 앱 전환과 검증

`boot.Options.Kafka`, `boot.Options.RabbitMQ`와 브로커 전용 boot 타입은 제거되었습니다. 외부 Kafka, RabbitMQ `Config`에서 `Consume`, `Publish`와 연결 설정을 지정하고 `WithEventAdapter`로 등록하세요. 재연결과 ACK/NACK 제한은 `WithEventConsumerRetry`, `WithEventSettlementTimeout`으로 지정합니다.

CLI 갱신은 위의 `go install ...@latest`를 다시 실행합니다. `spine update`는 선택된 레시피의 프로젝트 의존성만 갱신하며 소스, 구현 선택이나 기존 레시피를 자동 전환하지 않습니다. 기존 앱은 먼저 조립 코드와 설정을 수동 전환한 뒤 의존성 변경을 검토하세요.

기존 앱을 0.6.5로 옮길 때는 먼저 `spine.toml`의 `module`, `entrypoint`, `composition`, `port`, `layout`을 유지한 채 레시피와 구현 선택 키를 변경하거나 추가합니다. 다음은 HTTP만 사용하고 검증기를 선택하지 않은 앱의 설정입니다. WebSocket은 `gorilla`, 검증기는 `playground`, 이벤트는 실제 등록 이름과 종류에 맞춘 `event_platforms` 목록으로 바꾸세요. 선택 설정과 앱 조립 코드를 맞춘 뒤 아래 의존성 갱신을 진행합니다. 레시피를 지정하지 않은 기존 앱은 CLI를 갱신해도 0.6.0 의존성 조합을 유지합니다.

```toml
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
event_platforms = []
```

```sh
spine update --dry-run
spine update
spine contract check
spine verify
```

dry-run의 변경 내용을 검토한 뒤 `--dry-run` 없이 적용합니다. 정적 계약과 로컬 검사를 통과한 뒤 실제 HTTP, WebSocket 응답과 브로커 전달을 별도로 확인합니다.

[0.6.5 전환 안내](https://github.com/NARUBROWN/spine/blob/v0.6.5/docs/migration/v0.6.5.md)
