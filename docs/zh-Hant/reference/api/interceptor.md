# core.Interceptor

攔截器在控制器呼叫前後插入驗證、記錄、計時和交易等橫切邏輯。

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

- `PreHandle`：控制器前執行；回傳錯誤可中止管線。
- `PostHandle`：控制器與回傳值處理成功後執行。
- `AfterCompletion`：成功、失敗或中止時都會執行。

```go
app.Interceptor(&LoggingInterceptor{})
app.Route("GET", "/me", (*UserController).Me,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

全域攔截器涵蓋所有路由，路由攔截器只涵蓋指定路由。前置階段依註冊順序執行，後置階段反向執行。
