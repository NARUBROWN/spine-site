# 第一个应用程序

5 分钟内创建用户查询 API。

## 完成的外观

```bash
curl "http://localhost:8080/users?id=1"
```

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

## 1.创建项目

```bash
mkdir hello-spine && cd hello-spine
go mod init hello-spine
go get github.com/NARUBROWN/spine
```

## 2. 项目结构

```
hello-spine/
├── main.go
├── controller/
│   └── user_controller.go
├── service/
│   └── user_service.go
└── routes/
    └── routes.go
```

## 3.编写代码

### main.go

```go
package main

import (
    "log"
    "time"

    "hello-spine/controller"
    "hello-spine/routes"
    "hello-spine/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    // 注册构造函数——以任何顺序
    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    // 路线登记
    routes.RegisterRoutes(app)

    // 启动服务器
    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```

### 服务/user_service.go

```go
package service

// UserResponse 响应结构
type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

// 用户服务 用户服务
type UserService struct {
    // 实际上，Repository是被注入的，但这里只是简单地实现了。
}

func NewUserService() *UserService {
    return &UserService{}
}

// 获取用户查找（硬编码数据）
func (s *UserService) Get(id int) (UserResponse, error) {
    // 其实去DB查一下
    users := map[int]UserResponse{
        1: {ID: 1, Name: "Alice", Email: "alice@example.com"},
        2: {ID: 2, Name: "Bob", Email: "bob@example.com"},
    }

    if user, ok := users[id]; ok {
        return user, nil
    }

    return UserResponse{}, nil
}
```

### 控制器/user_controller.go

```go
package controller

import (
    "context"

    "hello-spine/service"

    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

// NewUserController 构造函数 — 参数是依赖项
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser 用户查找处理程序
// 函数签名是API规范
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[service.UserResponse], error) {
    id := int(q.Int("id", 0))
    user, err := c.svc.Get(id)
    if err != nil {
        return httpx.Response[service.UserResponse]{}, err
    }
    return httpx.Response[service.UserResponse]{Body: user}, nil
}
```

### 路线/routes.go

```go
package routes

import (
    "hello-spine/controller"

    "github.com/NARUBROWN/spine"
)

func RegisterRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).GetUser)
}
```

## 4. 运行

```bash
go run main.go
```

```
________       _____
__  ___/__________(_)___________
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/
       /_/
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## 5. 测试

```bash
# 爱丽丝查找
curl "http://localhost:8080/users?id=1"
```

```json
{"id":1,"name":"Alice","email":"alice@example.com"}
```

```bash
# 鲍勃·查找
curl "http://localhost:8080/users?id=2"
```

```json
{"id":2,"name":"Bob","email":"bob@example.com"}
```

## 🎉 完成！

我在 5 分钟内创建了我的第一个 Spine 应用程序。

### 到目前为止我学到了什么

|概念|代码|
|------|------|
|创建应用程序 | `spine.New()` | `spine.New()`
|注册依赖项 | `app.Constructor(...)` | `app.Constructor(...)`
|路线登记| `app.Route("GET", "/users", ...)` | `app.Route("GET", "/users", ...)`
|启动服务器| `app.Run(boot.Options{...})` | `app.Run(boot.Options{...})`

### 要点

- **构造函数参数 = 依赖声明** — 无需注释
- **函数签名=API规范** — 输入输出清晰
- **在一处管理您的路线** — 查看流程

## 后续步骤

- [教程：项目结构](/zh-Hans/learn/tutorial/1-project-structure) — 获取实际的项目结构
- [教程：拦截器](/zh-Hans/learn/tutorial/4-interceptor) — 添加事务和日志记录
- [教程：数据库](/zh-Hans/learn/tutorial/5-database) — 连接 Bun ORM
