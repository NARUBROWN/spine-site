# 소개

::: warning v0.7.0 미리보기 입력 API 전환
이 페이지의 기존 API 설명과 예제는 안정 버전 `v0.6.5` 기준입니다. `v0.7.0-preview.1`부터 출처별 Path, Query, Header DTO를 지원하며 `query.Values`, `header.Values`와 해당 생성/조회 API, `query.Pagination`, `path.Int`, `path.String`, `path.Boolean`은 Deprecated입니다.

새 DTO 방식은 `v0.6.5`에 그대로 적용할 수 없습니다. 미리보기에서도 한 핸들러 안에서 새 DTO와 Deprecated 입력을 혼용하면 부팅 시 거부합니다. 기존 본문 DTO와 context는 계속 함께 사용할 수 있습니다.

적용 버전과 전환 예제는 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview), 명세 옵션은 [런타임 OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

Spine은 생성자, 라우트, 인터셉터를 Go 코드로 등록하는 웹 프레임워크입니다. 요청을 받을 핸들러와 그 전후에 실행할 작업을 등록 코드에서 확인할 수 있습니다.

이 페이지의 기능별 `src/user` 예제는 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 `--layout legacy`로 생성한 `my-app`을 기준으로 합니다. CLI `v0.4.2`의 기본 `new`는 역할별 `layered-v1` 구조를 생성합니다. 두 레이아웃 모두 Spine `v0.6.5`와 Echo 플랫폼 `v0.1.0`을 사용합니다.

처음 시작한다면 [첫 번째 앱](/ko/learn/getting-started/first-app)에서 CLI로 프로젝트를 만들고 `GET /health` 응답을 확인하세요. 이 문서는 앱을 구성할 때 사용하는 핵심 개념을 소개합니다.

## 앱 구성과 실행

CLI로 생성한 프로젝트에서는 `internal/application/application.go`의 `BuildApplication()`에 앱 구성 코드를 모읍니다. `main.go`는 `BuildApplication` → `Validate` → `Run` 순서로 앱을 구성하고, 검증한 뒤 실행합니다.

다음은 사용자 기능을 직접 구현했을 때의 등록 예시입니다. `UserController`와 인터셉터 구현을 생략한 코드이므로 생성된 파일을 이 예시로 덮어쓰지 마세요.

```go
func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New(echoplatform.Option())

    // 생성자를 등록하면 등록 순서와 관계없이 의존성을 해결합니다.
    app.Constructor(NewUserRepository, NewUserService, NewUserController)

    // 인터셉터를 실행할 순서대로 등록합니다.
    app.InterceptorFor(boot.InterceptorHTTP, &TxInterceptor{}, &LoggingInterceptor{})

    // HTTP 메서드와 경로에 핸들러를 연결합니다.
    app.Route("GET", "/users", (*UserController).GetUser)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```


CLI의 `spine generate resource user`가 만드는 코드는 위 예시와 이름과 경로가 다릅니다. 생성되는 핸들러는 `src/user`의 `UserController.Get`이며, 경로는 `GET /user/:id`입니다. 생성자가 등록된 상태에서 같은 생성자나 라우트를 다시 등록하지 마세요. `BuildApplication`에 추가된 `user.Register(app)` 호출과 오류 처리도 유지해야 합니다. 자세한 절차는 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 확인할 수 있습니다.

## 핵심 개념

### 1. 생성자 기반 의존성 주입

생성자 매개변수로 필요한 의존성을 선언하고 `app.Constructor`에 생성자를 등록합니다. 아래 예시에서 `UserService`는 `UserRepository`를 전달받습니다.

```go
// 생성자 파라미터가 곧 의존성 선언
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

// 등록만 하면 자동으로 의존성 그래프 해결
app.Constructor(NewUserRepository, NewUserService, NewUserController)
```

### 2. 인터셉터 파이프라인

인터셉터는 컨트롤러 호출 전후에 인증, 트랜잭션, 로깅 같은 공통 작업을 실행합니다. 다음 예시는 직접 구현한 세 인터셉터의 등록 순서를 보여줍니다.

```go
app.Interceptor(
    &TxInterceptor{},      // 1. 트랜잭션 시작
    &AuthInterceptor{},    // 2. 인증 확인
    &LoggingInterceptor{}, // 3. 로깅
)

```

`PreHandle`은 등록 순서대로 실행됩니다. 컨트롤러가 반환한 뒤의 `PostHandle`과 응답 처리 전의 `BeforeResponse`, 응답 처리 후의 `AfterCompletion`은 역순으로 실행됩니다. 오류가 발생했을 때의 호출 조건은 [인터셉터](/ko/learn/tutorial/4-interceptor)에서 설명합니다.

### 3. 명시적 라우팅

`app.Route`로 HTTP 메서드, 경로, 핸들러를 연결합니다. 기능별 등록 함수를 두면 관련 라우트를 한곳에서 관리할 수 있습니다.

```go
// 한 곳에서 모든 라우트를 관리
func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
    app.Route("PUT", "/users", (*UserController).UpdateUser)
    app.Route("DELETE", "/users", (*UserController).DeleteUser)
}
```

### 4. 타입 안전한 핸들러

핸들러의 매개변수와 반환 타입으로 요청에서 읽을 값과 응답 형태를 표현합니다. 다음 예시의 조회 핸들러는 쿼리 매개변수를 읽고, 생성 핸들러는 JSON 요청 본문을 구조체 포인터로 전달받습니다. 서비스와 요청, 응답 타입은 직접 구현해야 합니다.

```go
// 함수 시그니처가 곧 API 스펙
func (c *UserController) GetUser(
    ctx context.Context,      // 컨텍스트
    q query.Values,           // 쿼리 파라미터
) (httpx.Response[UserResponse], error) {     // 응답 타입
    user, err := c.svc.Get(ctx, q.Int("id", 0))
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}

// DTO는 자동으로 바인딩
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,    // JSON body → 구조체 (포인터)
) (httpx.Response[UserResponse], error) {
    user, err := c.svc.Create(ctx, req)
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}
```

## 시작하기

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

CLI를 설치한 뒤 [첫 번째 앱](/ko/learn/getting-started/first-app)에서 프로젝트를 생성하고 HTTP 응답을 확인하세요. 명령을 찾지 못하면 [설치 안내](/ko/learn/getting-started/installation)의 경로 설정을 참고하세요.
