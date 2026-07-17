# JWT 登录示例

本示例展示注册、登录和需要认证的“我的信息”端点。

## 安装依赖

```bash
go get github.com/NARUBROWN/spine
go get github.com/golang-jwt/jwt/v5
```

## 路由与认证

```go
app.Route("POST", "/signup", (*AuthController).Signup)
app.Route("POST", "/login", (*AuthController).Login)
app.Route("GET", "/me", (*AuthController).Me,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

`AuthInterceptor` 从 `Authorization: Bearer <token>` 读取令牌、验证 JWT，并把当前用户放入执行上下文。`/signup` 与 `/login` 公开，`/me` 仅在认证成功后执行。

## 测试

```bash
curl -X POST http://localhost:8080/signup -d '{"email":"alice@example.com","password":"secret"}'
curl -X POST http://localhost:8080/login -d '{"email":"alice@example.com","password":"secret"}'
curl http://localhost:8080/me -H 'Authorization: Bearer <token>'
```

路由级拦截器让认证逻辑与控制器用例分离。
