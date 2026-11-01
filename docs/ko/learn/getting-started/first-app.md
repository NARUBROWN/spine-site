# 첫 번째 앱

Spine CLI를 설치하고 프로젝트를 생성한 뒤, 약 5분 안에 `GET /health`를 실행합니다. Go 1.25.5 이상이 필요하며, CLI의 권장 버전은 Go 1.27.3입니다. 최초 의존성 다운로드 시간은 환경에 따라 다릅니다.

## 1. CLI 설치와 명령 확인

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version`은 `spine-cli 0.1.4`를 출력합니다. 명령을 찾지 못하면 [설치 안내](/ko/learn/getting-started/installation)에서 Go 실행 파일 경로 설정을 확인하세요.

## 2. 프로젝트 생성

프로젝트를 둘 상위 디렉터리에서 실행합니다.

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
go mod tidy
```

CLI는 `go.mod`에 Spine `v0.5.1`을 지정합니다. 의존성은 `go mod tidy`로 준비합니다.

## 3. 생성된 구조 확인

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/application/
    ├── application.go
    └── application_test.go
```

`spine.toml`은 모듈, 실행 진입점과 등록 코드를 찾을 위치를 CLI에 알려줍니다.

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go`의 `BuildApplication()`이 앱과 실행 옵션을 조립합니다. 생성된 코드는 `HealthController` 생성자와 `GET /health`를 등록하고, `boot.HTTPOptions`를 명시합니다. 라우트·생성자·인터셉터 등록은 이 함수 또는 여기에서 호출하는 `Register(app) error`에 모읍니다.

`main.go`는 이미 생성되어 있습니다. 직접 덮어쓸 필요 없이 다음 실행 흐름을 확인하세요.

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

## 4. 계약과 로컬 코드 검증

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor`는 도구와 프로젝트 설정을 진단하고, `inspect`는 등록된 실행 계약을 보여줍니다. `contract check`는 정적 실행 계약을 검사하며 `verify`는 계약·gofmt·vet·test를 수행합니다. 생성된 `application_test.go`도 서버를 열지 않고 `BuildApplication()`과 `app.Validate(options)`를 검사합니다.

## 5. 실행하고 응답 확인

```bash
spine dev
```

다른 터미널에서 요청합니다.

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

개발 서버는 `Ctrl+C`로 종료합니다. 이제 CLI로 생성한 프로젝트, 재사용 가능한 앱 조립 함수, 정적 계약 검사와 실제 HTTP 응답을 확인했습니다.

## 다음 단계

- [프로젝트 구조](/ko/learn/tutorial/1-project-structure) — 생성된 프로젝트에 기능 추가하기
- [컨트롤러](/ko/learn/tutorial/2-controller) — CLI로 생성한 라우트와 핸들러 살펴보기
- [데이터베이스](/ko/learn/tutorial/5-database) — 저장소에 Bun ORM 연결하기
