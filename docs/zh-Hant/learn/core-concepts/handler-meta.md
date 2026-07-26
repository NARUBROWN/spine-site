# HandlerMeta

`HandlerMeta` 是已驗證的路由處理器中繼資料，包含控制器型別、方法、路徑參數鍵順序與路由攔截器。

```go
type HandlerMeta struct {
    ControllerType reflect.Type
    Method         reflect.Method
    PathKeys       []string
    Interceptors   []core.Interceptor
}
```

```go
app.Route("GET", "/users/:id", (*UserController).Get,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

啟動時，Spine 會驗證函式是否為方法運算式、接收者是否為指標，並擷取方法名稱與控制器型別。Router 匹配後回傳這份中繼資料；`PathKeys` 讓 Pipeline 按宣告順序繫結 `path.Int`、`path.String` 等參數，再執行攔截器並呼叫控制器。

這能在啟動階段發現設定錯誤，並讓路由與實際處理器的關係保持明確。
