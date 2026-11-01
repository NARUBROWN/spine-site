# 介紹

## 什麼是脊椎？

Spine 是**不隱藏請求流程的 Go Web 框架**。

明確執行管道揭示如何解釋請求、執行順序、何時調用業務邏輯以及如何在回應中完成請求。

在 CLI 產生的 `internal/application/application.go` 中組裝應用程式。以下範例加入使用者功能；保留產生的 `main.go` 中 `BuildApplication` → `Validate` → `Run` 的順序。

以下註冊片段假設使用者型別和攔截器已手動實作。CLI 的 `resource user` 產生 `src/user` 中的 `UserController.Get`，路由為 `GET /user/:id`。在產生的專案中，保留 `BuildApplication` 內檢查錯誤的 `user.Register(app)` 呼叫，不要重複註冊相同的建構函式或路由。產生和修改步驟見[專案結構](/zh-Hant/learn/tutorial/1-project-structure)。

```go
func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()

    // 註冊相依性 — 順序不限，只要註冊建構函式即可自動解析
    app.Constructor(NewUserRepository, NewUserService, NewUserController)

    // 攔截器－執行順序在程式碼中可見
    app.InterceptorFor(boot.InterceptorHTTP, &TxInterceptor{}, &LoggingInterceptor{})

    // 路線 — 哪個方法是哪一條路線一目了然。
    app.Route("GET", "/users", (*UserController).GetUser)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 為什麼是脊椎？

### 沒有隱藏的魔法

Spring Boot 中為 `@Autowired`，NestJS 中為 `@Injectable`。
方便，但很難看到裡面發生了什麼。

脊柱不一樣。

- **無註解** — 純 Go 程式碼
- **沒有模組定義** - DI 只需透過註冊建構函式即可解決
- **無代理** — 堆疊追蹤非常直觀

阅读代码即可看到執行流程。

### 熟悉的結構

如果您使用過Spring或NestJS，您可以立即開始。

```
Controller → Service → Repository
```

建構函式注入、攔截器鏈和分層架構。
將熟悉的模式带入 Go。

### Go 中的效能

- 無需 JVM 預熱
- 沒有 Node.js 運行時初始化
- 編譯後的二進位檔案立即執行

針對容器和無伺服器環境進行了最佳化。

## 關鍵概念

### 1. 基於建構子的依賴注入

```go
// 建構函數參數是依賴關係的聲明
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

// 簡單註冊並自動解決依賴圖
app.Constructor(NewUserRepository, NewUserService, NewUserController)
```

### 2.攔截器管道

```go
app.Interceptor(
    &TxInterceptor{},      // 1. 開始事务
    &AuthInterceptor{},    // 2. 检查認證
    &LoggingInterceptor{}, // 3. 日志记录
)

```

**執行順序：**

```mermaid
graph LR
   Request --> Tx.Pre --> Auth.Pre --> Log.Pre --> Controller
   Controller --> Log.After --> Auth.After --> Tx.After --> Response
```

### 3.明確路由

```go
// 在一處管理您的所有路線
func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
    app.Route("PUT", "/users", (*UserController).UpdateUser)
    app.Route("DELETE", "/users", (*UserController).DeleteUser)
}
```

### 4. 類型安全處理程式

```go
// 函數簽名是API規範
func (c *UserController) GetUser(
    ctx context.Context,      // 上下文
    q query.Values,           // 查詢參數
) (httpx.Response[UserResponse], error) {     // 回應型別
    user, err := c.svc.Get(ctx, q.Int("id", 0))
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}

// DTO 自動綁定
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,    // JSON body → 结构体（指针）
) (httpx.Response[UserResponse], error) {
    user, err := c.svc.Create(ctx, req)
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}
```

## 與其他框架的比較

| |脊柱 | NestJS |春季啟動 |
|---|:---:|:---:|:---:|
| **語言** |去 |打字稿 | Java/Kotlin |
| **執行時期** |本機二進位 | Node.js | JVM |
| **IoC 容器** | ✅ | ✅ | ✅ |
| **註解/裝飾器** |沒有必要|必填|必填|
| **模組定義** |沒有必要|必填|沒有必要|
| **類型安全性** |編譯時間|執行時期|編譯時間|

## 你準備好開始了嗎？

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

先安裝 CLI，再按照[第一個應用程式](/zh-Hant/learn/getting-started/first-app)檢查變更計畫並產生專案。
