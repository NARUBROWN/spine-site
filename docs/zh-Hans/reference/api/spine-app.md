# spine.App

## 概览

`spine.App` 是 Spine 应用的入口。它用于注册构造函数、路由、拦截器和传输协议，然后通过 `Run` 启动应用。

```go
app := spine.New()
app.Constructor(NewUserService, NewUserController)
app.Interceptor(&LoggingInterceptor{})
app.Route("GET", "/users", (*UserController).List)
app.Run(boot.Options{Address: ":8080"})
```

## 主要方法

| 方法 | 用途 |
|---|---|
| `New()` | 创建应用实例 |
| `Constructor(...)` | 注册容器构造函数 |
| `Route(method, path, handler, options...)` | 注册 HTTP 路由 |
| `Interceptor(...)` | 注册全局拦截器 |
| `Transport(...)` / `RegisterTransport(...)` | 配置传输适配器 |
| `Consumers(...)` | 注册消息消费者 |
| `WebSocket(...)` | 注册 WebSocket 处理器 |
| `Run(options)` | 启动所有已配置组件 |

## 路由与选项

```go
app.Route("GET", "/users/:id", (*UserController).Get,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

处理器必须是指针接收者的方法表达式。路由选项可加入仅作用于该路由的拦截器。

## boot.Options

`boot.Options` 设置监听地址、优雅关闭、HTTP 选项及恢复中间件。

```go
app.Run(boot.Options{
    Address: ":8080",
    EnableGracefulShutdown: true,
    ShutdownTimeout: 10 * time.Second,
    HTTP: &boot.HTTPOptions{},
})
```

## 事件与消息

应用可注册 Kafka、RabbitMQ 等传输，以及消费者处理器。控制器可通过注入的事件总线发布领域事件；消费者使用相同的执行管道处理事件。

## 启动顺序

Spine 在启动时收集构造函数和路由、验证处理器、解析依赖并预热控制器。这样可以在服务接收请求前发现配置错误。
