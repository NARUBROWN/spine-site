# 설치

Spine CLI를 설치하고 CLI가 생성한 프로젝트에서 개발을 시작합니다. 이 문서는 Spine CLI **0.1.4**, 생성되는 Spine **v0.5.1**을 기준으로 합니다.

## 요구사항

- Go **1.25.5 이상**. CLI의 권장·검증 버전은 **1.27.3**입니다.
- Go 실행 파일 설치 경로가 `PATH`에 포함되어 있어야 합니다. `GOBIN`을 설정하지 않았다면 기본 경로는 `$(go env GOPATH)/bin`입니다.

```bash
go version
```

## CLI 설치

이 사이트에서는 `spine` 명령으로 설치합니다.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

설치 후 `spine`을 찾지 못하고 `GOBIN`을 따로 설정하지 않았다면, Bash·Zsh에서 현재 세션의 경로를 추가합니다. 계속 사용하려면 같은 설정을 셸 시작 파일에 저장하세요. `GOBIN`을 설정했다면 그 디렉터리를 대신 추가합니다.

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

버전 출력은 `spine-cli 0.1.4`입니다.

## 새 프로젝트 생성

프로젝트를 둘 상위 디렉터리에서 실행합니다.

```bash
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
```

CLI는 `go.mod`에 Spine `v0.5.1`을 지정합니다. 의존성은 `go mod tidy`로 준비합니다.

생성된 `spine.toml`은 다음과 같습니다.

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`internal/application/application.go`의 `BuildApplication()`이 구성 요소와 `GET /health`를 등록합니다. 생성된 `main.go`는 이 함수를 호출하고 `app.Validate(options)`를 통과한 뒤 `app.Run(options)`을 실행합니다.

## 검증과 실행

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor`는 도구와 프로젝트 설정을 진단하고, `inspect`는 등록된 실행 계약을 보여줍니다. `contract check`는 정적 실행 계약을 검사하며 `verify`는 계약·gofmt·vet·test를 수행합니다. 생성된 `application_test.go`도 서버를 열지 않고 `BuildApplication()`과 `app.Validate(options)`를 검사합니다.

검사를 통과하면 `spine dev`로 실행하고, 다른 터미널에서 실제 HTTP 응답을 확인합니다.

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

응답은 `{"status":"ok"}`입니다. `Ctrl+C`로 개발 서버를 종료합니다. 로컬 검증과 외부 DB·브로커·배포 환경의 E2E 검증은 별개입니다.

## 다음 단계

[5분 퀵스타트 →](/ko/learn/getting-started/first-app)에서 생성된 프로젝트 구조와 첫 API를 확인하세요.
