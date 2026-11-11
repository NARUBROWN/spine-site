# Spine 0.7.5 문서 반영과 검증

사이트 전체 문서 경로를 점검하고, 한국어와 영어, 일본어, 중국어 간체 및 번체를 같은 API와 실행 예제로 맞췄습니다. 변경은 별도 작업트리의 `temp/v0.7.5-docs` 브랜치에 있습니다.

## 반영 범위

- 핸들러와 네 인터셉터 훅은 공개 `pkg/spine.Ctx`를 기본으로 사용합니다. 기존 표준 context.Context 주입은 호환 지원으로 설명합니다.
- HTTP 입력을 `input.Path/Query/Header/Body`로 통일하고, 기본 lowerCamel 이름과 태그의 역할을 설명합니다.
- BuildApplication에서 검증기를 생성하고 WithValidator로 연결합니다. 자동 태그 검증과 선택적인 DTO Validate 메서드 및 앱 Validate를 구분합니다.
- 역할별 생성자, 그룹과 개별 라우트 인터셉터, 인증과 바인딩 순서, BeforeResponse 오류 우선순위 및 HTTPError 상태 범위를 맞췄습니다.
- DB와 트랜잭션은 표준 Go context 및 명시적인 bun.IDB 전달, BeforeResponse 커밋과 롤백으로 설명합니다.
- CRUD, 로그인, OpenAPI, WebSocket과 Kafka 예제를 갱신했습니다. WebSocket은 공개 3인자 ws.Send를 사용해 현재 연결에 응답합니다.
- 기본 layered-v1에서 지원하지 않는 slice 생성 안내를 제거했습니다. CLI 문서는 실제 새 앱 생성과 리소스 생성으로 확인했습니다.
- 새 0.7.5 이전 안내, 탐색 메뉴, 홈페이지 CLI 예시, 에이전트 프롬프트와 llms.txt를 갱신했습니다.
- 과거 버전 문서는 해당 버전의 기록으로 표시하고 현재 안내를 연결했습니다. 릴리스 카탈로그는 공식 저장소 9개의 공개 태그와 정책으로 재수집했습니다.

## 주요 문서

- [컨트롤러와 DTO](../../docs/ko/learn/tutorial/2-controller.md)
- [의존성 주입](../../docs/ko/learn/tutorial/3-dependency-injection.md)
- [인터셉터](../../docs/ko/learn/tutorial/4-interceptor.md)
- [데이터베이스](../../docs/ko/learn/tutorial/5-database.md)
- [트랜잭션](../../docs/ko/learn/tutorial/6-transaction.md)
- [오류와 검증](../../docs/ko/learn/tutorial/7-error-handling.md)
- [0.7.5 이전 안내](../../docs/ko/learn/migration/v0.7.5.md)

## 확인 결과

216개 Markdown 경로를 점검했고 185개를 변경하거나 추가했습니다. 한국어 43개와 번역 172개의 구조, 링크와 실행 코드가 일치합니다.

- Go 예제 405개 문법 검사 통과. 이 중 문맥을 보충하는 조각은 10개입니다.
- 현재 예제 프로젝트 15개 검증 통과: HTTP 10개, WebSocket 1개, 컴파일 3개, 공개 계약 대조 1개입니다.
- 로컬 후보 소스와 공개 모듈만 사용하는 임시 프로젝트에서 각각 검증했습니다. 공개 모듈 검사는 로컬 replace를 사용하지 않습니다.
- CLI 기본 앱 및 resource 생성, 생성 코드의 Deprecated 참조 검사, Kafka 두 앱의 문서 코드 조립과 contract check 및 verify를 통과했습니다.
- 사이트 빌드, Python 단위 검사 9개와 렌더링된 내부 링크 11,880개 검사를 통과했습니다.

검증기는 문서에서 Go 블록을 직접 추출합니다. 실제 MySQL 연결 및 커밋과 롤백, Kafka 메시지 전달은 실행하지 않았으며 해당 예제는 컴파일과 정적 검사까지 확인했습니다. DB와 브로커를 실행한 통합 검증으로 해석하지 않습니다.

## 재현

공개된 의존성만 사용하는 검사입니다.

```sh
python3 scripts/check-doc-translations.py
go run scripts/check-go-examples.go docs
python3 scripts/check-v075-examples.py --output /tmp/spine-v075-examples.json
python3 -m unittest discover -s scripts -p 'test_*.py'
npm ci
npm run docs:build
python3 scripts/check-doc-translations.py --check-rendered
python3 scripts/sync-release-catalog.py --check
```

후보 소스의 변경을 확인할 때는 소스를 명시적으로 전달합니다.

```sh
python3 scripts/check-v075-examples.py \
  --core-source /path/to/spine \
  --http-source /path/to/spine-echo-platform \
  --validator-source /path/to/spine-validator-playground \
  --websocket-source /path/to/spine-gorilla-platform \
  --output /tmp/spine-v075-candidate-examples.json

python3 scripts/check-v075-cli-docs.py \
  --cli /path/to/spine-cli-binary \
  --output /tmp/spine-v075-cli-docs.json
```

검사 대상 소스 커밋, 실행 결과와 범위는 `verification-summary.json`, 전체 문서 경로별 상태와 해시는 `documentation-audit.json`에 기록했습니다. 이 임시 브랜치는 문서 검토용입니다. 사이트 배포는 별도 단계입니다.
