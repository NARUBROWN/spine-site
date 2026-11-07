# 簡介

::: warning Preview
本頁包含穩定版 `v0.6.5` 範例。Preview 中的 `app.Route` 已標記為 Deprecated。請參閱[控制器與路由遷移](/zh-Hant/learn/migration/preview-controller-routes)。
:::

::: warning v0.7.0 Preview 輸入 API 移轉
本頁既有 API 說明與範例以穩定版 `v0.6.5` 為基準。自 `v0.7.0-preview.1` 起，可依輸入來源使用獨立的 Path、Query 與 Header DTO。`query.Values`、`header.Values` 及其建構與讀取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均標記為 Deprecated。

新的 DTO 方式無法直接用於 `v0.6.5`。在 Preview 中，同一處理器混用新 DTO 與 Deprecated 輸入也會在啟動時遭到拒絕。既有本文 DTO 與情境仍可搭配任一方式使用。

適用版本與移轉範例請見 [Preview 處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)，規格選項請見 [執行階段 OpenAPI](/zh-Hant/reference/api/openapi)。
:::

Spine 是透過 Go 程式碼註冊建構函式、路由與攔截器的網頁框架。從註冊程式碼就能看出由哪個處理器接收請求，以及在呼叫前後執行哪些工作。

本頁依功能劃分的 `src/user` 範例使用[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中以 `--layout legacy` 建立的 `my-app`。CLI `v0.4.2` 預設產生依角色劃分的 `layered-v1` 結構。兩種布局都使用 Spine `v0.6.5` 與 Echo 平台 `v0.1.0`。

如果是第一次使用，請從[第一個應用程式](/zh-Hant/learn/getting-started/first-app)開始，透過 CLI 建立專案並確認 `GET /health` 的回應。本篇介紹設定應用程式時會用到的核心概念。

## 設定與執行應用程式

在 CLI 建立的專案中，應用程式的設定程式碼集中放在 `internal/application/application.go` 的 `BuildApplication()`。`main.go` 依照 `BuildApplication` → `Validate` → `Run` 的順序，先設定及驗證應用程式，再執行。

以下是自行實作使用者功能後的註冊範例。範例省略了 `UserController` 與攔截器的實作，請勿用這段程式碼覆寫產生的檔案。

```go
func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New(echoplatform.Option())

    // 註冊建構函式後，無論註冊順序如何，都會解析相依性。
    app.Constructor(NewUserRepository, NewUserService, NewUserController)

    // 依執行順序註冊攔截器。
    app.InterceptorFor(boot.InterceptorHTTP, &TxInterceptor{}, &LoggingInterceptor{})

    // 將處理器連結至 HTTP 方法與路徑。
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
// 建構函式參數即相依性宣告
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

// 註冊後自動解析相依性圖
app.Constructor(NewUserRepository, NewUserService, NewUserController)
```

### 2. 攔截器管線

攔截器在控制器呼叫前後，執行身分驗證、交易與記錄日誌等共通工作。以下範例展示三個自行實作的攔截器的註冊順序。

```go
app.Interceptor(
    &TxInterceptor{},      // 1. 開始交易
    &AuthInterceptor{},    // 2. 檢查身分驗證
    &LoggingInterceptor{}, // 3. 記錄日誌
)

```

`PreHandle` 依註冊順序執行。控制器返回後的 `PostHandle`、處理回應前的 `BeforeResponse`，以及處理回應後的 `AfterCompletion`，則依反向順序執行。發生錯誤時的呼叫條件，請參閱[攔截器](/zh-Hant/learn/tutorial/4-interceptor)。

### 3. 明確的路由註冊

使用 `app.Route` 將 HTTP 方法、路徑與處理器連結起來。為各項功能建立註冊函式，就能集中管理相關路由。

```go
// 在同一處管理所有路由
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
// 函式簽章即 API 規格
func (c *UserController) GetUser(
    ctx context.Context,      // 情境
    q query.Values,           // 查詢參數
) (httpx.Response[UserResponse], error) {     // 回應型別
    user, err := c.svc.Get(ctx, q.Int("id", 0))
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}

// 自動繫結 DTO
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,    // JSON body → 結構體（指標）
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
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

安裝 CLI 後，請依照[第一個應用程式](/zh-Hant/learn/getting-started/first-app)建立專案並確認 HTTP 回應。若找不到指令，請參閱[安裝說明](/zh-Hant/learn/getting-started/installation)中的路徑設定。
