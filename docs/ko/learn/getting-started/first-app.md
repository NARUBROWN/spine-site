# 첫 번째 앱

Spine CLI로 새 프로젝트를 만들고 `GET /health`가 `{"status":"ok"}`를 반환하는지 확인합니다. 생성된 파일을 읽으면서 앱을 구성하고 검증한 뒤 실행하는 흐름도 살펴봅니다.

Go 1.25.5 이상이 필요하며, CLI의 권장 버전은 Go 1.27.3입니다. 처음 의존성을 다운로드할 때 걸리는 시간은 환경에 따라 다릅니다.

## 1. CLI 설치와 명령 확인

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

v0.7.0 미리보기는 [Preview CLI 설치](/ko/learn/getting-started/installation#preview-cli)에서 CLI를 `@preview`로 설치한 뒤 진행하세요. 이 페이지의 `spine.toml` 예시는 정식 레시피 기준이며, Preview CLI의 새 프로젝트는 `platform-contracts-preview`를 사용합니다.

`spine version`으로 설치된 CLI 버전을 확인합니다. 명령을 찾을 수 없다면 [설치 안내](/ko/learn/getting-started/installation)에서 PATH 설정을 확인하세요.

## 2. 프로젝트 생성

프로젝트를 둘 상위 디렉터리에서 실행합니다. `hello-spine` 디렉터리가 이미 있다면 다른 이름을 사용하세요.

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
```

`new`는 설치한 CLI의 검증 레시피에 따라 Spine, Echo 플랫폼과 Echo의 호환 버전을 선택하고 의존성 설치, 정적 계약 검사와 빌드를 완료합니다. 선택된 버전은 생성된 `go.mod`에서 확인합니다. `--skip-install`로 파일만 생성했다면 `go mod tidy`와 `go mod download all`을 별도로 실행하세요. 설치 과정에서는 앱 초기화, 테스트나 리스너를 실행하지 않습니다.

## 3. 생성된 구조 확인

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── go.sum
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    ├── controller/health_controller.go
    └── route/route.go
```

프로젝트에는 실행을 시작하는 `main.go`와 앱 구성 코드를 담은 `internal/application` 디렉터리가 있습니다. `spine.toml`은 모듈 경로, 실행 진입점, 앱 구성 코드의 위치와 포트를 CLI에 알려줍니다.

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
```

`internal/application/application.go`의 `BuildApplication()`은 앱과 실행 옵션을 반환합니다. 생성된 코드는 `HealthController` 생성자와 `GET /health`를 등록하고, HTTP 실행 옵션인 `boot.HTTPOptions`를 명시합니다.

기능을 추가할 때는 이 함수나 여기에서 호출하는 `Register(app) error` 함수에 라우트, 생성자, 인터셉터 등록을 모읍니다. 자세한 방법은 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 다룹니다.

`main.go`는 이미 생성되어 있으므로 수정할 필요가 없습니다. 다음 코드에서 앱 구성, 검증, 실행 순서를 확인하세요.

```go
func main() {
    app, options, err := application.BuildApplication()
    if err != nil {
        log.Fatal(err)
    }
    if err := app.Validate(options); err != nil {
        log.Fatal(err)
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

## 4. 앱 구성과 코드 검증

생성한 프로젝트의 루트 디렉터리에서 실행합니다.

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor`는 도구와 프로젝트 설정을 진단합니다. `inspect`는 코드에 등록된 라우트와 의존성 등 앱 구성을 보여줍니다. CLI가 등록 코드에서 추출한 이 정보를 실행 계약이라고 합니다.

`contract check`는 실행 계약을 검사하고, `verify`는 계약 검사에 더해 `gofmt`, `go vet`, Go 테스트를 실행합니다. 생성된 `application_test.go`도 서버를 시작하지 않고 `BuildApplication()`과 `app.Validate(options)`를 검사합니다. 모든 명령이 오류 없이 끝났으면 서버를 실행할 준비가 된 것입니다.

## 5. 실행하고 응답 확인

```bash
spine dev
```

서버가 실행된 상태에서 다른 터미널을 열고 요청합니다.

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

위 JSON 응답이 반환되면 `GET /health`가 동작한 것입니다. 서버를 실행한 터미널에서 `Ctrl+C`를 눌러 개발 서버를 종료합니다.

## 다음 단계

- [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 생성된 프로젝트에 기능을 추가합니다.
- [컨트롤러](/ko/learn/tutorial/2-controller)에서 라우트와 핸들러를 살펴봅니다.
- [데이터베이스](/ko/learn/tutorial/5-database)에서 저장소에 Bun ORM을 연결합니다.
