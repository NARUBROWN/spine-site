# 攔截器

攔截器用於驗證、日誌、指標、交易和其他橫切邏輯。Spine v0.5.1 的介面包含四個生命週期方法。

## 從 CLI 專案開始

使用[第一個應用程式](/zh-Hant/learn/getting-started/first-app)和[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中的 `example.com/my-app`。如果使用者資源尚未產生，在專案根目錄中執行：

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

先查看文字預覽中的產生檔案，再執行一般產生指令。已有此資源時跳過產生步驟。

CLI 產生 `src/user`，並在 `BuildApplication` 中呼叫 `user.Register(app)`。CLI 不提供攔截器產生器；以下的 `src/interceptor` 檔案、驗證邏輯和額外控制器方法需要手動實作。在 `internal/application/application.go` 中註冊全域策略，在 `src/user/user_route.go` 中加入路由策略，保留根目錄 `main.go` 的建構、驗證和執行流程。


## 實作日誌攔截器

```go
// src/interceptor/logging_interceptor.go
package interceptor

import (
	"log"

	"github.com/NARUBROWN/spine/core"
)

type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
) error {
	log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
	return nil
}

func (i *LoggingInterceptor) PostHandle(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
) {
	log.Printf("[READY] %s %s", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) BeforeResponse(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
	executionErr error,
) error {
	return nil
}

func (i *LoggingInterceptor) AfterCompletion(
	ctx core.ExecutionContext,
	meta core.HandlerMeta,
	err error,
) {
	if err != nil {
		log.Printf("[ERR] %s %s: %v", ctx.Method(), ctx.Path(), err)
	}
}
```

`BeforeResponse` 是可失敗的提交點；`AfterCompletion` 只用於不會改變結果的觀察與清理。

## 全域、路由與傳輸範圍

```go
// internal/application/application.go
package application

import (
    "os"

    "example.com/my-app/src/interceptor"
    "example.com/my-app/src/user"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)
    app.Interceptor(&interceptor.LoggingInterceptor{})
    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins:     []string{"https://app.example.com"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Authorization", "Content-Type"},
        AllowCredentials: true,
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)

    if err := user.Register(app); err != nil {
        return nil, boot.Options{}, err
    }

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

```go
// 등록 위치별 정책 예시
app.Interceptor(&interceptor.LoggingInterceptor{})

app.InterceptorFor(
	boot.InterceptorHTTP,
	corsInterceptor,
)

app.Route(
	"GET",
	"/user/:id",
	(*UserController).Get,
	route.WithInterceptors(&interceptor.AuthInterceptor{}),
)
```

`app.Interceptor` 涵蓋 HTTP 和 WebSocket。只需要 HTTP 或 WebSocket 時使用 `InterceptorFor`；路由專用策略繼續用 `route.WithInterceptors`。

同一指標實例在多個範圍重複註冊會合併範圍並執行一次；同型別的不同指標實例獨立執行。需要共享狀態時重用同一指標，需要獨立策略時建立不同實例。

CORS 程式碼放在 `BuildApplication` 中，並匯入 `github.com/NARUBROWN/spine/interceptor/cors`。路由片段放在 `src/user/user_route.go`；`AuthInterceptor` 需要先手動實作四個生命週期方法。全域 HTTP `PreHandle` 執行時路由尚未解析，`HandlerMeta` 可能為空。

## 可執行的本機驗證範例

建立以下驗證檔案，並替換產生的使用者路由檔案。保留 `BuildApplication` 中的 `user.Register(app)`，不要重複註冊。`demo-token` 是公開的本機示範 token，實際應用程式需要替換為自己的驗證策略。

```go
// src/interceptor/auth_interceptor.go
package interceptor

import (
    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
)

type AuthInterceptor struct{}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Header("Authorization") != "Bearer demo-token" {
        return httperr.Unauthorized("invalid demo token")
    }
    ctx.Set("currentUser", map[string]string{"id": "1", "name": "Alice"})
    return nil
}

func (i *AuthInterceptor) PostHandle(core.ExecutionContext, core.HandlerMeta) {}

func (i *AuthInterceptor) BeforeResponse(core.ExecutionContext, core.HandlerMeta, error) error {
    return nil
}

func (i *AuthInterceptor) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error) {}

```

```go
// src/user/user_route.go
package user

import (
    "example.com/my-app/src/interceptor"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/route"
)

func Register(app spine.App) error {
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    app.Route(
        "GET",
        "/user/:id",
        (*UserController).Get,
        route.WithInterceptors(&interceptor.AuthInterceptor{}),
    )
    return nil
}
```

## 安全 CORS 設定

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
	AllowOrigins:     []string{"https://app.example.com"},
	AllowMethods:     []string{"GET", "POST"},
	AllowHeaders:     []string{"Authorization", "Content-Type"},
	AllowCredentials: true,
})
if err != nil {
	return nil, boot.Options{}, err
}

app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
```

帶憑證的 CORS 不能使用 `"*"` 來源。`NewValidated` 會在啟動前回傳結構化錯誤；舊的 `cors.New` 只用於原始碼相容，並在寫入回應標頭前回報無效策略。

## WebSocket 握手驗證

訊息級 `PreHandle` 對每則 WebSocket 訊息執行，不能取代 upgrade 前驗證。保護連線時實作可選介面：

```go
func (i *AuthInterceptor) PreHandshake(
	ctx core.WebSocketHandshakeContext,
	meta core.HandlerMeta,
) error {
	token := ctx.Header("Authorization")
	if token == "" {
		return httperr.Unauthorized("missing credentials")
	}
	if token != "Bearer demo-token" {
        return httperr.Unauthorized("invalid demo token")
    }
    return nil
}
```

以 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 或 WebSocket 路由攔截器註冊。連線槽位先保留，接著執行 `PreHandshake`，最後才 upgrade；因此未驗證握手也受 `MaxConnections` 限制。

## 驗證契約

在專案根目錄中執行。靜態契約和本機 Go 驗證與實際 HTTP、WebSocket 驗證和資料庫 E2E 檢查是獨立的。

```sh
gofmt -w src/interceptor/*.go src/user/user_route.go internal/application/application.go
spine contract check
spine verify
spine dev
```

在另一個終端機中檢查。health 回傳 HTTP 200，沒有 token 的使用者請求回傳 401，帶有示範 token 的請求回傳 200，並包含已設定 origin 的 CORS 回應標頭。

```bash
curl -i http://localhost:8080/health
curl -i http://localhost:8080/user/1
curl -i http://localhost:8080/user/1 \
  -H 'Authorization: Bearer demo-token' \
  -H 'Origin: https://app.example.com'
```

## 下一步

- [交易管理](/zh-Hant/learn/tutorial/6-transaction)
- [`core.Interceptor` API](/zh-Hant/reference/api/interceptor)
- [目前版本](/zh-Hant/community/changelog)
