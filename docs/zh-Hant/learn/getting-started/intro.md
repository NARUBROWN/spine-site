# 簡介

Spine 是透過 Go 程式碼註冊建構函式、路由與攔截器的網頁框架。從註冊程式碼就能看出由哪個處理器接收請求，以及在呼叫前後執行哪些工作。

如果是第一次使用，請從[第一個應用程式](/zh-Hant/learn/getting-started/first-app)開始，透過 CLI 建立專案並確認 `GET /health` 的回應。本篇介紹設定應用程式時會用到的核心概念。

## 設定與執行應用程式

在 CLI 建立的專案中，應用程式的設定程式碼集中放在 `internal/application/application.go` 的 `BuildApplication()`。`main.go` 依照 `BuildApplication` → `Validate` → `Run` 的順序，先設定及驗證應用程式，再執行。

以下是自行實作使用者功能後的註冊範例。範例省略了 `UserController` 與攔截器的實作，請勿用這段程式碼覆寫產生的檔案。

```go
func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()

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


CLI 指令 `spine generate resource user` 產生的程式碼，其名稱與路徑和上述範例不同。產生的處理器是 `src/user` 中的 `UserController.Get`，路徑則是 `GET /user/:id`。建構函式已註冊時，請勿再次註冊相同的建構函式或路由。也必須保留新增至 `BuildApplication` 的 `user.Register(app)` 呼叫及錯誤處理。詳細步驟請參閱[專案結構](/zh-Hant/learn/tutorial/1-project-structure)。

## 核心概念

### 1. 以建構函式進行相依性注入

透過建構函式的參數宣告所需的相依性，再將建構函式註冊至 `app.Constructor`。在下列範例中，`UserService` 會接收 `UserRepository`。

```go
// 생성자 파라미터가 곧 의존성 선언
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

// 등록만 하면 자동으로 의존성 그래프 해결
app.Constructor(NewUserRepository, NewUserService, NewUserController)
```

### 2. 攔截器管線

攔截器在控制器呼叫前後，執行身分驗證、交易與記錄日誌等共通工作。以下範例展示三個自行實作的攔截器的註冊順序。

```go
app.Interceptor(
    &TxInterceptor{},      // 1. 트랜잭션 시작
    &AuthInterceptor{},    // 2. 인증 확인
    &LoggingInterceptor{}, // 3. 로깅
)

```

`PreHandle` 依註冊順序執行。控制器返回後的 `PostHandle`、處理回應前的 `BeforeResponse`，以及處理回應後的 `AfterCompletion`，則依反向順序執行。發生錯誤時的呼叫條件，請參閱[攔截器](/zh-Hant/learn/tutorial/4-interceptor)。

### 3. 明確的路由註冊

使用 `app.Route` 將 HTTP 方法、路徑與處理器連結起來。為各項功能建立註冊函式，就能集中管理相關路由。

```go
// 한 곳에서 모든 라우트를 관리
func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
    app.Route("PUT", "/users", (*UserController).UpdateUser)
    app.Route("DELETE", "/users", (*UserController).DeleteUser)
}
```

### 4. 型別安全的處理器

透過處理器的參數與回傳型別，表達要從請求讀取的值及回應格式。下列範例的查詢處理器會讀取查詢參數，建立處理器則會以結構體指標接收 JSON 請求主體。服務、請求與回應型別都需要自行實作。

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

## 開始使用

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

安裝 CLI 後，請依照[第一個應用程式](/zh-Hant/learn/getting-started/first-app)建立專案並確認 HTTP 回應。若找不到指令，請參閱[安裝說明](/zh-Hant/learn/getting-started/installation)中的路徑設定。
