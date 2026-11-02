# 설치

Spine `v0.6.0`부터 공식 시작 경로는 CLI의 `new`입니다. 최신 공개 CLI를 설치한 뒤 프로젝트를 만들고 개발 서버의 응답을 확인합니다.

## 요구사항

- Go 1.25.5 이상이 필요합니다. CLI의 권장 버전은 Go 1.27.3입니다.
- Go 실행 파일 설치 경로가 `PATH`에 포함되어 있어야 합니다. `GOBIN`을 설정하지 않았다면 기본 경로는 `$(go env GOPATH)/bin`입니다.

```bash
go version
```

출력된 Go 버전이 1.25.5 이상인지 확인하세요.

## CLI 설치

다음 명령으로 CLI를 설치하고 버전을 확인합니다.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

`spine version`으로 설치된 CLI 버전을 확인합니다.

`spine` 명령을 찾지 못하고 `GOBIN`을 따로 설정하지 않았다면, Bash나 Zsh에서 다음 명령으로 현재 세션의 경로를 추가하세요. 계속 사용하려면 같은 설정을 셸 시작 파일에 저장합니다. `GOBIN`을 설정했다면 그 디렉터리를 대신 추가하세요.

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

## 새 프로젝트 생성

프로젝트를 둘 상위 디렉터리에서 실행합니다. 같은 이름의 `my-app` 디렉터리가 이미 있다면 다른 이름을 사용하세요.

```bash
spine new my-app --module example.com/my-app
cd my-app
```

`new`는 설치한 CLI의 검증 레시피에 따라 Spine, Echo 플랫폼과 Echo의 호환 버전을 선택하고 의존성 설치, 정적 계약 검사와 빌드를 완료합니다. 선택된 버전은 생성된 `go.mod`에서 확인합니다. `--skip-install`로 파일만 생성했다면 `go mod tidy`와 `go mod download all`을 별도로 실행하세요. 설치 과정에서는 앱 초기화, 테스트나 리스너를 실행하지 않습니다.

생성된 `spine.toml`은 다음과 같습니다.

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
```

`internal/application/application.go`의 `BuildApplication()`이 구성 요소와 `GET /health`를 등록합니다. 생성된 `main.go`는 이 함수를 호출하고, `app.Validate(options)`로 구성을 검증한 뒤 `app.Run(options)`으로 서버를 실행합니다.

## 검증과 실행

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

각 명령이 오류 없이 끝나는지 확인하세요.

| 명령 | 확인하는 내용 |
| --- | --- |
| `spine doctor` | Go 도구와 프로젝트 설정 |
| `spine inspect` | 코드에 등록된 라우트, 의존성 등 앱 구성 |
| `spine contract check` | 등록 코드에서 추출한 실행 계약의 유효성 |
| `spine verify` | 실행 계약과 `gofmt`, `go vet`, Go 테스트 결과 |

생성된 `application_test.go`는 서버를 시작하지 않고 `BuildApplication()`과 `app.Validate(options)`를 검사합니다. 이 단계에서는 코드와 앱 구성이 검증되며, 실제 HTTP 응답은 다음 단계에서 확인합니다.

검사를 통과하면 `spine dev`로 실행하고, 다른 터미널에서 실제 HTTP 응답을 확인합니다.

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

`{"status":"ok"}`가 반환되면 개발 서버가 요청을 처리한 것입니다. 서버를 실행한 터미널에서 `Ctrl+C`를 눌러 종료합니다. 외부 데이터베이스나 메시지 브로커를 연결하거나 배포한 뒤에는 해당 환경에서도 동작을 확인해야 합니다.

## 다음 단계

[첫 번째 앱](/ko/learn/getting-started/first-app)에서 생성된 파일의 역할을 살펴보거나, [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 기능을 추가하세요.
