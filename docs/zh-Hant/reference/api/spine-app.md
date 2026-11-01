# spine.App

## 在CLI專案中使用API

以[第一個應用程式](/zh-Hant/learn/getting-started/first-app)中CLI產生的專案為基礎。將註冊程式碼放在 `internal/application/application.go` 的 `BuildApplication` 中。`Run` 範例用於產生的 `main.go`，先檢查 `Validate` 回傳的錯誤。

```sh
spine doctor
spine contract check
spine verify
```


## 概覽

`spine.App` 是應用程式入口，負責註冊相依性、HTTP 路由、攔截器、訊息消費者、WebSocket 和自訂傳輸，並在啟動前驗證完整設定。

```go
package application

import (
	"os"

	"github.com/NARUBROWN/spine"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
	return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

// BuildApplication은 서버 실행, 계약 검사와 오프라인 검증이 함께 사용하는 composition root입니다.
func BuildApplication() (spine.App, boot.Options, error) {
	app := spine.New()
	app.Constructor(NewHealthController)
	app.Route("GET", "/health", (*HealthController).Get)

	address := ":8080"
	if port := os.Getenv("SPINE_PORT"); port != "" {
		address = ":" + port
	}
	return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## 方法

| 方法 | 用途 |
|---|---|
| `New()` | 建立應用程式實例 |
| `Constructor(constructors...)` | 註冊容器建構函式 |
| `Route(method, path, handler, options...)` | 註冊 HTTP 路由 |
| `Interceptor(interceptors...)` | 為 HTTP 與 WebSocket 註冊全域攔截器 |
| `InterceptorFor(scope, interceptors...)` | 僅為選定傳輸範圍註冊全域攔截器 |
| `Transport(fn)` | 擴充內建 HTTP 傳輸 |
| `RegisterTransport(transport)` | 註冊獨立自訂傳輸 |
| `Validate(options)` | 不開啟網路連線，彙總設定問題 |
| `Run(options)` | 完成預檢、預熱和傳輸就緒檢查後執行應用程式 |
| `Consumers()` | 回傳訊息消費者註冊表 |
| `WebSocket()` | 回傳 WebSocket 註冊表 |

## 攔截器範圍

```go
app.Interceptor(&MetricsInterceptor{}) // HTTP + WebSocket
app.InterceptorFor(boot.InterceptorHTTP, &CORSInterceptor{})
app.InterceptorFor(boot.InterceptorWebSocket, &WSAuthInterceptor{})
```

可用範圍是 `boot.InterceptorHTTP`、`boot.InterceptorWebSocket` 和 `boot.InterceptorAll`。同一指標實例在多個範圍註冊時會合併並只執行一次；不同指標實例即使型別相同也會獨立執行。

## 設定驗證與啟動

`Validate` 回傳的設定錯誤可用 `errors.As(err, *boot.ConfigError)` 檢查，並逐一讀取 `Issues` 的 `Path`、`Code`、`Message` 與 `Hint`。`Code` 適合部署自動化；不要剖析面向人的訊息。

`Run` 會執行同一無網路預檢，接著預熱控制器和消費者、執行 Kafka 協定握手、驗證 RabbitMQ 拓撲連線並初始化自訂傳輸。HTTP listener 只在這些步驟全部成功後啟動。負數 `ShutdownTimeout` 無效；優雅關閉會等待消費者和傳輸完成。

完整選項與安全預設值請參閱[安全設定參考](/zh-Hant/reference/security-configuration)。
