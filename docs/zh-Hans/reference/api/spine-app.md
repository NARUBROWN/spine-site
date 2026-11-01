# spine.App

## 在CLI项目中使用API

以[第一个应用](/zh-Hans/learn/getting-started/first-app)中CLI生成的项目为基础。将注册代码放在 `internal/application/application.go` 的 `BuildApplication` 中。`Run` 示例用于生成的 `main.go`，先检查 `Validate` 返回的错误。

```sh
spine doctor
spine contract check
spine verify
```


## 概览

`spine.App` 是应用入口，负责注册依赖、HTTP 路由、拦截器、消息消费者、WebSocket 和自定义传输，并在启动前验证完整配置。

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
| `New()` | 创建应用实例 |
| `Constructor(constructors...)` | 注册容器构造函数 |
| `Route(method, path, handler, options...)` | 注册 HTTP 路由 |
| `Interceptor(interceptors...)` | 为 HTTP 与 WebSocket 注册全局拦截器 |
| `InterceptorFor(scope, interceptors...)` | 仅为选定传输范围注册全局拦截器 |
| `Transport(fn)` | 扩展内置 HTTP 传输 |
| `RegisterTransport(transport)` | 注册独立自定义传输 |
| `Validate(options)` | 不打开网络连接，汇总配置问题 |
| `Run(options)` | 完成预检、预热和传输就绪检查后运行应用 |
| `Consumers()` | 返回消息消费者注册表 |
| `WebSocket()` | 返回 WebSocket 注册表 |

## 拦截器范围

```go
app.Interceptor(&MetricsInterceptor{}) // HTTP + WebSocket
app.InterceptorFor(boot.InterceptorHTTP, &CORSInterceptor{})
app.InterceptorFor(boot.InterceptorWebSocket, &WSAuthInterceptor{})
```

可用范围是 `boot.InterceptorHTTP`、`boot.InterceptorWebSocket` 和 `boot.InterceptorAll`。同一指针实例在多个范围注册时会合并并只执行一次；不同指针实例即使类型相同也会独立执行。

## 配置验证与启动

`Validate` 返回的配置错误可用 `errors.As(err, *boot.ConfigError)` 检查，并遍历 `Issues` 的 `Path`、`Code`、`Message` 与 `Hint`。`Code` 适合部署自动化；不要解析面向人的消息。

`Run` 会执行同一无网络预检，然后预热控制器和消费者、执行 Kafka 协议握手、验证 RabbitMQ 拓扑连接并初始化自定义传输。HTTP listener 只在这些步骤全部成功后启动。负数 `ShutdownTimeout` 无效；优雅关闭会等待消费者和传输完成。

完整选项与安全默认值见[安全配置参考](/zh-Hans/reference/security-configuration)。
