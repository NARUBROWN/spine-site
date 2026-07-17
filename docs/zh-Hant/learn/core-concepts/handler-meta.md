# HandlerMeta

`HandlerMeta` 是已驗證的路由處理器中繼資料，包含控制器型別、方法、路由攔截器與參數資訊。

```go
app.Route("GET", "/users/:id", (*UserController).Get,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

啟動時，Spine 會驗證函式是否為方法運算式、接收者是否為指標，並擷取方法名稱與控制器型別。Router 匹配後回傳這份中繼資料，Pipeline 再據以解析參數、執行攔截器並呼叫控制器。

這能在啟動階段發現設定錯誤，並讓路由與實際處理器的關係保持明確。
