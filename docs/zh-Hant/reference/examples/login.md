# JWT 登入範例

::: info
此範例使用 `v0.7.1` 控制器和路由攔截器。舊註冊方式請參閱[路由遷移](/zh-Hant/learn/migration/preview-controller-routes)。
:::

建立註冊和登入 API，並使用登入時核發的 JWT 查詢自己的資訊。驗證攔截器只套用於 `/me`，因此註冊和登入請求不需要權杖。

## 開始前的準備

完成 [CLI 安裝](/zh-Hant/learn/getting-started/installation)後，使用 CLI `v0.4.3` 以上版本建立專案。手動新增 JWT 程式碼並安裝 `github.com/golang-jwt/jwt/v5`。

此範例為了說明驗證流程，使用記憶體儲存庫、明文密碼比對，以及寫死在程式碼中的 JWT 密鑰。伺服器結束後，註冊資訊就會消失。套用於實際服務前，必須使用密碼雜湊，並透過環境變數管理 JWT 密鑰。

## 1. 建立專案

準備基本應用程式和 JWT 相依套件。後續命令均在 `login-example/` 中執行。

以下指令使用正式相依套件通道。請在 `go.mod` 中確認所選版本。

```sh
spine new login-example --layout legacy --module example.com/login-example --channel main --no-interactive
cd login-example
spine doctor
go get github.com/golang-jwt/jwt/v5@v5.3.1
```

### 檔案配置

接下來會在 `src/` 下新增四個檔案，並取代產生的 `internal/application/application.go`。根目錄的 `main.go` 和 `spine.toml` 繼續沿用。

```text
login-example/
├── go.mod
├── go.sum
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    ├── controller/auth_controller.go
    ├── interceptor/auth_interceptor.go
    ├── model/user.go
    └── store/user_store.go
```

## 2. 定義使用者模型、請求和回應

建立 `src/model/user.go`。`Password` 的 `json:"-"` 標籤可防止密碼出現在 JSON 回應中。

```go
// src/model/user.go
package model

type User struct {
    ID       int64  `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"` // 從 JSON 回應中排除
    Name     string `json:"name"`
}

type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type LoginResponse struct {
    Token string `json:"token"`
    User  User   `json:"user"`
}

type SignupRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
    Name     string `json:"name"`
}
```

## 3. 新增使用者儲存庫

建立 `src/store/user_store.go`。它將使用者儲存在記憶體中，並依電子郵件和 ID 查詢使用者。以相同電子郵件再次註冊時，會回傳錯誤。

```go
// src/store/user_store.go
package store

import (
    "errors"
    "example.com/login-example/src/model"
    "sync"
)

type UserStore struct {
    mu     sync.RWMutex
    users  map[int64]*model.User
    nextID int64
}

func NewUserStore() *UserStore {
    return &UserStore{
        users:  make(map[int64]*model.User),
        nextID: 1,
    }
}

func (s *UserStore) Create(email, password, name string) (*model.User, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    // 檢查電子郵件是否重複
    for _, u := range s.users {
        if u.Email == email {
            return nil, errors.New("email already exists")
        }
    }

    user := &model.User{
        ID:       s.nextID,
        Email:    email,
        Password: password,
        Name:     name,
    }
    s.users[s.nextID] = user
    s.nextID++

    return user, nil
}

func (s *UserStore) FindByEmail(email string) (*model.User, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    for _, u := range s.users {
        if u.Email == email {
            return u, nil
        }
    }
    return nil, errors.New("user not found")
}

func (s *UserStore) FindByID(id int64) (*model.User, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    user, ok := s.users[id]
    if !ok {
        return nil, errors.New("user not found")
    }
    return user, nil
}
```

## 4. 新增驗證攔截器

建立 `src/interceptor/auth_interceptor.go`。它從 `Authorization: Bearer <token>` 標頭讀取 JWT，並驗證簽章和到期時間。驗證後的 `user_id` 會儲存在執行內容中，供控制器讀取。

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
    "strings"

    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/golang-jwt/jwt/v5"
)

var JWTSecret = []byte("your-secret-key") // 實際環境中請使用環境變數

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // 從 Authorization 標頭中擷取權杖
    authHeader := ctx.Header("Authorization")
    if authHeader == "" {
        return httperr.Unauthorized("토큰이 필요합니다.")
    }

    // 解析 "Bearer {token}" 格式
    parts := strings.Split(authHeader, " ")
    if len(parts) != 2 || parts[0] != "Bearer" {
        return httperr.Unauthorized("잘못된 토큰 형식입니다.")
    }

    tokenString := parts[1]

    // 驗證 JWT 權杖
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, httperr.Unauthorized("잘못된 서명 방식입니다.")
        }
        return JWTSecret, nil
    }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())

    if err != nil || !token.Valid {
        return httperr.Unauthorized("유효하지 않은 토큰입니다.")
    }

    // 從權杖中擷取使用者 ID
    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return httperr.Unauthorized("토큰 클레임을 읽을 수 없습니다.")
    }

    rawID, ok := claims["user_id"].(float64)
    if !ok || rawID <= 0 || rawID != float64(int64(rawID)) {
        return httperr.Unauthorized("Invalid user ID claim.")
    }
    userID := int64(rawID)

    // 在 ExecutionContext 中儲存使用者 ID
    ctx.Set("userID", userID)

    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```

## 5. 新增驗證控制器

建立 `src/controller/auth_controller.go`。註冊時儲存使用者；登入時確認電子郵件和密碼後核發 JWT。查詢自己的資訊時，則以攔截器儲存的使用者 ID 查詢儲存庫。

```go
// src/controller/auth_controller.go
package controller

import (
    "time"

    "example.com/login-example/src/interceptor"
    "example.com/login-example/src/model"
    "example.com/login-example/src/store"

    "github.com/NARUBROWN/spine/pkg/api"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/golang-jwt/jwt/v5"
)

type AuthController struct {
    userStore *store.UserStore
}

func (*AuthController) Constructor(userStore *store.UserStore) *AuthController {
    return &AuthController{userStore: userStore}
}

func (c *AuthController) RegisterRoutes(r *api.Registry) {
    r.POST("/signup", c.Signup)
    r.POST("/login", c.Login)
    r.GET("/me", c.GetMe, api.Interceptors(&interceptor.AuthInterceptor{}))
}

// 註冊帳號 — 無須身分驗證
func (c *AuthController) Signup(req *model.SignupRequest) (httpx.Response[model.User], error) {
    if req.Email == "" || req.Password == "" || req.Name == "" {
        return httpx.Response[model.User]{}, httperr.BadRequest("모든 필드를 입력해주세요.")
    }

    user, err := c.userStore.Create(req.Email, req.Password, req.Name)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.BadRequest(err.Error())
    }

    return httpx.Response[model.User]{Body: *user}, nil
}

// 登入 — 無須身分驗證
func (c *AuthController) Login(req *model.LoginRequest) (httpx.Response[model.LoginResponse], error) {
    if req.Email == "" || req.Password == "" {
        return httpx.Response[model.LoginResponse]{}, httperr.BadRequest("이메일과 비밀번호를 입력해주세요.")
    }

    user, err := c.userStore.FindByEmail(req.Email)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // 檢查密碼（實際應用中使用 bcrypt 等比較雜湊）
    if user.Password != req.Password {
        return httpx.Response[model.LoginResponse]{}, httperr.Unauthorized("이메일 또는 비밀번호가 일치하지 않습니다.")
    }

    // 產生 JWT 權杖
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(interceptor.JWTSecret)
    if err != nil {
        return httpx.Response[model.LoginResponse]{}, err
    }

    return httpx.Response[model.LoginResponse]{
        Body: model.LoginResponse{
            Token: tokenString,
            User:  *user,
        },
    }, nil
}

// 查詢我的資訊 — 需要身分驗證
func (c *AuthController) GetMe(ctx spinectx.Ctx) (httpx.Response[model.User], error) {
    // 讀取 AuthInterceptor 儲存的 userID
    userIDValue, ok := ctx.Get("userID")
    if !ok {
        return httpx.Response[model.User]{}, httperr.Unauthorized("인증 정보를 찾을 수 없습니다.")
    }

    userID, valid := userIDValue.(int64)
    if !valid {
        return httpx.Response[model.User]{}, httperr.Unauthorized("invalid authentication context")
    }
    user, err := c.userStore.FindByID(userID)
    if err != nil {
        return httpx.Response[model.User]{}, httperr.NotFound("사용자를 찾을 수 없습니다.")
    }

    return httpx.Response[model.User]{Body: *user}, nil
}
```

## 6. 註冊建構函式和驗證路由

以下列程式碼取代整個 `internal/application/application.go`。註冊儲存庫和控制器的建構函式，並僅在 `/me` 連接驗證攔截器。產生在根目錄的 `main.go` 會依序執行 `BuildApplication`、`Validate`、`Run`。

```go
// internal/application/application.go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "time"

    "example.com/login-example/src/controller"
    "example.com/login-example/src/store"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New(echoplatform.Option())
    app.Constructor(store.NewUserStore, constructor.Controller(&controller.AuthController{}))

    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders: []string{"Content-Type", "Authorization"},
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 7. 驗證並啟動伺服器

在專案根目錄整理格式，檢查相依套件和程式碼，然後啟動伺服器。

```sh
gofmt -w src internal/application
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

`contract check` 檢查靜態契約。`verify` 檢查靜態契約，並執行 gofmt、go vet 和 Go 測試。接著透過 HTTP 請求確認實際的註冊、登入和身分驗證。

## 8. 確認註冊和驗證請求

保持伺服器執行，在另一個終端機依序傳送以下請求。新啟動的伺服器中，第一位註冊者的 ID 為 `1`。

### 註冊

```bash
curl -X POST http://localhost:8080/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234", "name": "Alice"}'
```

回應會傳回 HTTP 200 和註冊的使用者資訊，不包含密碼。

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

### 登入

```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "1234"}'
```

回應會傳回 HTTP 200 和 JWT。以下範例回應省略了部分權杖內容。請求 `/me` 時，請使用實際回應中的 `token` 值。

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "name": "Alice"
  }
}
```

### 不帶權杖查詢自己的資訊

不帶驗證標頭請求 `/me`。

```bash
curl http://localhost:8080/me
```

回應會傳回 HTTP 401 和以下錯誤訊息。

```json
{
  "message": "토큰이 필요합니다."
}
```

### 使用權杖查詢自己的資訊

完整複製登入回應中的 `token` 值。先執行以下 `read` 命令，在等待輸入時貼上權杖並按 Enter。接著使用 `curl` 命令請求 `/me`。

```sh
read -r TOKEN
curl http://localhost:8080/me \
  -H "Authorization: Bearer $TOKEN"
```

權杖有效時，會收到 HTTP 200 和該使用者的資訊。

```json
{
  "id": 1,
  "email": "alice@example.com",
  "name": "Alice"
}
```

## 驗證攔截器的執行順序

CORS 攔截器會在所有路由執行。驗證攔截器會在 `/me` 驗證權杖，再將使用者 ID 傳給控制器。

```
POST /signup (公開)
   │
   ├─→ CORS.PreHandle (全域)
   ├─→ AuthController.Signup
   └─→ Response 200

POST /login (公開)
   │
   ├─→ CORS.PreHandle (全域)
   ├─→ AuthController.Login
   └─→ Response 200 + JWT 權杖

GET /me (受保護)
   │
   ├─→ CORS.PreHandle (全域)
   ├─→ Auth.PreHandle (路由) ← 驗證權杖
   │       │
   │       ├─ 無權杖 → 401 Unauthorized
   │       └─ 權杖有效 → ctx.Set("userID", ...)
   │
   ├─→ AuthController.GetMe
   └─→ Response 200 + 使用者資訊
```

## 各路由的驗證範圍

| 路由 | 方法 | 攔截器 | 說明 |
|--------|--------|----------|------|
| `/signup` | POST | CORS | 不帶權杖註冊 |
| `/login` | POST | CORS | 不帶權杖登入後核發 JWT |
| `/me` | GET | CORS, Auth | 驗證 JWT 後查詢自己的資訊 |

## 下一步

請在[攔截器 API](/zh-Hant/reference/api/interceptor)中確認執行順序和各方法的職責。若要持久儲存使用者資訊，請參閱[連接資料庫](/zh-Hant/learn/tutorial/5-database)。
