# 攔截器

攔截器用於驗證、日誌、指標、交易和其他橫切邏輯。Spine v0.5.1 的介面包含四個生命週期方法。

## 實作日誌攔截器

```go
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
app.Interceptor(&interceptor.LoggingInterceptor{})

app.InterceptorFor(
	boot.InterceptorHTTP,
	corsInterceptor,
)

app.Route(
	"GET",
	"/users/:id",
	(*UserController).GetUser,
	route.WithInterceptors(&interceptor.AuthInterceptor{}),
)
```

`app.Interceptor` 涵蓋 HTTP 和 WebSocket。只需要 HTTP 或 WebSocket 時使用 `InterceptorFor`；路由專用策略繼續用 `route.WithInterceptors`。

同一指標實例在多個範圍重複註冊會合併範圍並執行一次；同型別的不同指標實例獨立執行。需要共享狀態時重用同一指標，需要獨立策略時建立不同實例。

## 安全 CORS 設定

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
	AllowOrigins:     []string{"https://app.example.com"},
	AllowMethods:     []string{"GET", "POST"},
	AllowHeaders:     []string{"Authorization", "Content-Type"},
	AllowCredentials: true,
})
if err != nil {
	log.Fatal(err)
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
	return i.verify(token)
}
```

以 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 或 WebSocket 路由攔截器註冊。連線槽位先保留，接著執行 `PreHandshake`，最後才 upgrade；因此未驗證握手也受 `MaxConnections` 限制。

## 下一步

- [交易管理](/zh-Hant/learn/tutorial/6-transaction)
- [`core.Interceptor` API](/zh-Hant/reference/api/interceptor)
- [目前版本](/zh-Hant/community/changelog)
