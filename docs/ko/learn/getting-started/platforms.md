# 플랫폼과 DTO 검증 선택

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

Spine `v0.7.5`는 HTTP, WebSocket, 이벤트와 DTO 검증의 공개 계약을 코어에 두고 구현을 독립 모듈로 선택합니다. 필요한 구현만 앱에 연결할 수 있습니다.

## CLI로 선택하기

[CLI 설치](/ko/learn/getting-started/installation) 후 0.7.5 API를 지원하는 Preview CLI를 사용합니다. CLI 설치 채널과 앱 의존성 채널은 별개입니다.

```sh
spine new http-app --module example.com/http-app --channel preview --platform nethttp --no-interactive
spine new chat-app --module example.com/chat-app --channel preview --platform nethttp --websocket-platform gorilla --no-interactive
spine new worker --module example.com/worker --channel preview --platform none --event-platform events:nats --no-interactive
spine new validated-app --module example.com/validated-app --channel preview --validator playground --no-interactive
```

기본 HTTP 플랫폼은 Echo이며, WebSocket, 이벤트, validator와 프론트엔드는 기본적으로 선택하지 않습니다. `--platform none`은 이벤트 워커를 만들며 이벤트 플랫폼이 필요합니다. WebSocket은 HTTP 플랫폼이 필요합니다. `--event-platform`은 여러 번 지정할 수 있습니다.

CLI와 코어는 Go 1.25.5 이상이 필요합니다. playground validator와 NATS 플랫폼은 Go 1.26 이상이 필요합니다. 선택한 버전은 `go.mod`와 `spine.toml`에서 확인하세요. `--skip-install`도 버전 조회가 필요하지만 설치와 빌드는 생략합니다.

## 공개 계약과 구현

HTTP는 `contract/http`와 Echo 또는 net/http, WebSocket은 `contract/websocket`과 Gorilla를 사용합니다. 이벤트는 `contract/event`와 Kafka, RabbitMQ 또는 NATS를, 검증은 `contract/validator`와 playground를 사용할 수 있습니다. HTTP 플랫폼을 선택해도 WebSocket 구현은 자동으로 추가되지 않습니다.

앱은 `spine.New(...)`에 HTTP와 WebSocket 옵션, `spine.WithEventAdapter`와 `spine.WithValidator`를 전달합니다. 생성된 앱의 조립 코드를 확인하고 factory 오류를 처리하세요. 기존 `adapter` 호환 경로는 Deprecated이며 HTTP v2 구현이 v3로 자동 변환되지는 않습니다.

## DTO 검증

`--validator playground`로 만든 앱은 바인딩한 DTO를 핸들러 전에 검증합니다. 검증기를 등록하지 않으면 `validate` 태그는 실행되지 않습니다. 다음은 요청 DTO 예제입니다.

```go
type CreateUserRequest struct {
	Email string `json:"email" validate:"required,email"`
	Age   int    `json:"age" validate:"gte=18"`
}
```

규칙 위반은 HTTP 400, WebSocket 1008 종료 또는 소비자 실패 정책으로 처리됩니다. HTTP 오류의 필드 경로와 명세 범위는 사용하는 validator 계약에 따릅니다.

## 업데이트와 확인

`spine update`는 프로젝트에 기록된 의존성 채널을 유지하며 CLI 실행 파일이나 앱 소스를 바꾸지 않습니다. 먼저 변경 계획과 base hash를 검토하고 출력 안내에 따라 적용하세요. 외부 DB, WebSocket과 브로커 동작은 실제 환경에서 별도로 검증합니다.

```sh
spine update --dry-run
```

[릴리스 채널과 설치](/ko/community/release-channels), [입력 전환](/ko/learn/migration/v0.7.5), [HTTP v3와 부팅 옵션](/ko/learn/migration/v0.7.5)을 참고하세요.
