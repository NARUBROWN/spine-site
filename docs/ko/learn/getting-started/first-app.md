# 설치와 첫 번째 앱

Spine CLI `v0.4.4`로 코어 `v0.7.5`를 사용하는 HTTP 앱을 만듭니다. 설치 채널과 앱 의존성 채널은 [릴리스 채널 안내](/ko/community/release-channels)에서 확인하세요.

## 요구사항

이 예제의 검증기에는 Go 1.26 이상이 필요합니다. `GOBIN` 또는 기본 `GOPATH/bin`을 `PATH`에 추가하세요.

```sh
go version
```

<span id="preview-cli"></span>

## 정식 CLI 설치 {#install-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

`spine version`으로 설치된 버전을 확인합니다. 같은 CLI 버전을 재현하려면 설치 명령에 `@v0.4.4`를 지정하세요. `spine update`는 앱 의존성을 갱신합니다.

## 프로젝트 생성

```sh
spine new my-app --module example.com/my-app --channel main --validator playground --no-interactive
cd my-app
go list -m all
spine doctor
spine inspect
```

CLI 레시피가 호환 버전을 선택합니다. go.mod에서 코어 0.7.5 API와 플랫폼 조합을 확인하세요. 기본 레이아웃은 layered-v1입니다. --validator playground는 BuildApplication에 검증기를 조립합니다. 기본 validator none은 태그 검증을 켜지 않습니다. 생성은 외부 앱 자원이나 리스너를 시작하지 않습니다.

```text
my-app/
├── main.go
├── go.mod
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/controller/health_controller.go
```

## 검증과 실행

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

{"status":"ok"}를 확인하고 Ctrl+C로 종료합니다. 생성된 main은 BuildApplication, app.Validate, app.Run 순서입니다. Validate는 생성자나 DB 접속을 실행하지 않으므로 실제 요청도 확인합니다.

## 의존성 메타데이터 복구

--skip-install이나 수동 변경 뒤 MODULE_GRAPH_UNAVAILABLE이면 모듈 정보를 내려받습니다.

```sh
go mod tidy
go mod download all
spine contract check
```

## 다음 단계

[프로젝트 구조](/ko/learn/tutorial/1-project-structure) / [컨트롤러](/ko/learn/tutorial/2-controller) / [플랫폼 선택](/ko/learn/getting-started/platforms)
