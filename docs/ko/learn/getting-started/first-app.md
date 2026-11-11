# 설치와 첫 번째 앱

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

CLI 설치 채널과 앱 의존성 채널을 별도로 선택합니다. 이 안내는 0.7.5 API를 사용하는 Preview 앱 기준입니다. 정식 릴리스 선택은 [채널 안내](/ko/community/release-channels)를 참고하세요.

## 요구사항

Go 1.26 이상을 사용하고 선택한 모듈의 go 지시문을 확인합니다. GOBIN 또는 기본 GOPATH/bin이 PATH에 있어야 합니다.

```sh
go version
```

## Preview CLI 설치 {#preview-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

preview는 이동하는 브랜치입니다. 재현하려면 출력 버전과 커밋을 기록하고 고정 태그를 사용합니다. 정식 CLI는 @latest로 설치합니다. spine update는 앱 의존성을 갱신하며 CLI나 앱 소스를 바꾸지 않습니다.

## 프로젝트 생성

```sh
spine new my-app --module example.com/my-app --channel preview --validator playground --no-interactive
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
