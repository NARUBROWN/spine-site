# Interceptor API

::: info 0.7.5
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

## 執行順序 {#order}

```text
Global PreHandle
→ Route selection
→ Route PreHandle
→ Input binding and validator
→ Handler
→ Response preparation and success hooks
→ PostHandle (reverse)
→ BeforeResponse (reverse)
→ Error rendering and response flush
→ AfterCompletion (reverse)
→ Store and multipart cleanup
```

全域與路由 PreHandle 均在本文綁定前執行，可在解析前拒絕認證失敗的請求。PostHandle 用於成功後處理。BeforeResponse 僅對 PreHandle 成功的攔截器逆序執行，並接收序列化、Cookie 與狀態碼驗證錯誤。在此提交或回滾並回傳失敗。未執行到 PreHandle 的攔截器也可能收到 AfterCompletion，應先檢查資源是否存在。

## 契約 {#contract}

```go
import (
	"github.com/NARUBROWN/spine/core"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type Interceptor interface {
	PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error
	PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta)
	BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error
	AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error)
}
```

## 套用範圍 {#scope}

```go
app.Constructor(constructor.Interceptor(&AuthInterceptor{}))
app.InterceptorFor(boot.InterceptorHTTP, (*AuthInterceptor)(nil))
```

```go
func (*UserController) RegisterRoutes(r *api.Registry) {
	auth := (*AuthInterceptor)(nil)
	audit := (*AuditInterceptor)(nil)
	users := r.Group("/users", api.Interceptors(auth))
	users.GET("/", func() httpx.Response[[]int64] {
		return httpx.Response[[]int64]{Body: []int64{1}}
	})
	users.DELETE("/:id", func() httpx.Response[struct{}] {
		return httpx.Response[struct{}]{Options: httpx.ResponseOptions{Status: 204}}
	}, api.Interceptors(audit))
	r.GET("/profile", func() httpx.Response[string] {
		return httpx.Response[string]{Body: "profile"}
	}, api.Interceptors(auth))
}
```

使用此範例前，將 Auth 和 Audit 攔截器註冊到 DI。避免在全域與路由重複套用同一策略。角色註冊用於 DI，套用範圍另行指定。群組與子群組繼承選項，路由選項追加其後。全域範圍為 InterceptorHTTP、InterceptorWebSocket、InterceptorAll；All 與 app.Interceptor 作用於 HTTP 與 WS 訊息。

## 錯誤與交易 {#errors}

處理器與攔截器同時失敗時，HTTP 回應優先使用攔截器錯誤。最後一個失敗的 BeforeResponse 決定回應，先前錯誤仍保留給完成鉤子。HTTPError 僅允許 400～599；一般錯誤或無效狀態回傳隱藏內部詳情的 500。DB 提交、事件發布與通訊端傳送不屬於同一個原子交易。

[完整範例](/zh-Hant/learn/tutorial/4-interceptor) | [交易](/zh-Hant/learn/tutorial/6-transaction)
