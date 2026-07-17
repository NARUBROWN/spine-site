# CRUD 示例

## 概览

本示例展示使用 Controller、Service、Repository 与 Bun ORM 构建用户 CRUD API。

## 结构

```
app/
├── controller/user_controller.go
├── service/user_service.go
├── repository/user_repository.go
├── model/user.go
└── main.go
```

控制器声明路由处理器，服务承载用例，仓储负责数据访问。通过构造函数注册这些层：

```go
app.Constructor(NewDB, NewUserRepository, NewUserService, NewUserController)
app.Route("POST", "/users", (*UserController).Create)
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).Get)
app.Route("PUT", "/users/:id", (*UserController).Update)
app.Route("DELETE", "/users/:id", (*UserController).Delete)
```

## API 测试

```bash
curl -X POST http://localhost:8080/users -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
curl http://localhost:8080/users
curl http://localhost:8080/users/1
curl -X DELETE http://localhost:8080/users/1
```

找不到用户时返回 `httperr.NotFound`；邮箱重复时返回 `httperr.BadRequest`。

## 要点

控制器不直接处理 HTTP 写入，依赖通过构造函数表达，分层边界保持清晰。
