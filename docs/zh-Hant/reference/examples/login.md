# JWT 登入範例

本範例展示註冊、登入和需要驗證的「我的資訊」端點。

```go
app.Route("POST", "/signup", (*AuthController).Signup)
app.Route("POST", "/login", (*AuthController).Login)
app.Route("GET", "/me", (*AuthController).Me,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

`AuthInterceptor` 從 `Authorization: Bearer <token>` 讀取並驗證 JWT，然後將目前使用者放入執行上下文。公開路由不需要驗證，`/me` 只在驗證成功後執行。
