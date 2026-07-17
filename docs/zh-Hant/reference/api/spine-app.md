# spine.App

`spine.App` 是 Spine 應用程式的入口，用來註冊建構函式、路由、攔截器與傳輸協定，最後以 `Run` 啟動。

```go
app := spine.New()
app.Constructor(NewUserService, NewUserController)
app.Interceptor(&LoggingInterceptor{})
app.Route("GET", "/users", (*UserController).List)
app.Run(boot.Options{Address: ":8080"})
```

| 方法 | 用途 |
|---|---|
| `New()` | 建立應用程式執行個體 |
| `Constructor(...)` | 註冊容器建構函式 |
| `Route(...)` | 註冊 HTTP 路由 |
| `Interceptor(...)` | 註冊全域攔截器 |
| `Consumers(...)` | 註冊訊息消費者 |
| `WebSocket(...)` | 註冊 WebSocket 處理器 |
| `Run(options)` | 啟動已設定的元件 |

`boot.Options` 可設定監聽位址、優雅關閉、HTTP 選項與復原中介軟體。Spine 啟動時會驗證處理器、解析相依性並預熱控制器，讓設定錯誤在接收請求前暴露。
