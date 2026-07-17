# 项目结构

如何构建 Spine 项目。

## 推荐结构

```
my-app/
├── main.go                  # 应用入口
├── go.mod
├── go.sum
│
├── controller/              # 控制器层
│   └── user_controller.go
│
├── service/                 # 服务层（业务逻辑）
│   └── user_service.go
│
├── repository/              # 仓储层（数据访问）
│   └── user_repository.go
│
├── entity/                  # 数据库实体
│   └── user.go
│
├── dto/                     # 请求/响应对象
│   ├── user_request.go
│   └── user_response.go
│
├── routes/                  # 路由定义
│   └── user_routes.go
│
├── interceptor/             # 拦截器
│   ├── tx_interceptor.go
│   └── logging_interceptor.go
│
└── migrations/              # 数据库迁移
    ├── 001_create_users.up.sql
    └── 001_create_users.down.sql
```

## 各层的作用

### main.go

这是应用程序的入口点。注册构造函数，设置拦截器，并注册路由。

```go
package main

import (
    "log"
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    // 1. 注册一个构造函数
    app.Constructor(
        NewDB,
        repository.NewUserRepository,
        service.NewUserService,
        controller.NewUserController,
        interceptor.NewTxInterceptor,
    )

    // 2.注册拦截器
    app.Interceptor(
        (*interceptor.TxInterceptor)(nil),
        &interceptor.LoggingInterceptor{},
    )

    // 3. 路线注册
    routes.RegisterUserRoutes(app)

    // 4.启动服务器
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

＃＃＃控制器/

接收 HTTP 请求并将其委托给服务。不包含任何业务逻辑。

```go
// 控制器/user_controller.go
package controller

import (
    "context"

    "dto"
    "service"

    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService  // 服务依赖
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// 函数签名是API规范
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[dto.UserResponse], error) {
    id := int(q.Int("id", 0))
    user, err := c.svc.Get(ctx, id)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, err
    }
    return httpx.Response[dto.UserResponse]{Body: user}, nil
}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
) (httpx.Response[dto.UserResponse], error) {
    user, err := c.svc.Create(ctx, req.Name, req.Email)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, err
    }
    return httpx.Response[dto.UserResponse]{Body: user}, nil
}
```

＃＃＃服务/

负责业务逻辑。通过存储库访问数据。

```go
// 服务/user_service.go
package service

type UserService struct {
    repo *repository.UserRepository  // 仓储依赖
}

func NewUserService(repo *repository.UserRepository) *UserService {
    return &UserService{repo: repo}
}

func (s *UserService) Get(ctx context.Context, id int) (dto.UserResponse, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return dto.UserResponse{}, err
    }
    
    return dto.UserResponse{
        ID:    int(user.ID),
        Name:  user.Name,
        Email: user.Email,
    }, nil
}

func (s *UserService) Create(ctx context.Context, name, email string) (dto.UserResponse, error) {
    user := &entity.User{Name: name, Email: email}
    
    if err := s.repo.Save(ctx, user); err != nil {
        return dto.UserResponse{}, err
    }
    
    return dto.UserResponse{
        ID:    int(user.ID),
        Name:  user.Name,
        Email: user.Email,
    }, nil
}
```

### 存储库/

负责数据库访问。 SQL 查询或 ORM 调用位于此处。

```go
// 存储库/user_repository.go
package repository

type UserRepository struct {
    db bun.IDB  // 可接受 bun.DB 或 bun.Tx
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}

func (r *UserRepository) FindByID(ctx context.Context, id int) (*entity.User, error) {
    user := new(entity.User)
    err := r.db.NewSelect().
        Model(user).
        Where("id = ?", id).
        Scan(ctx)
    return user, err
}

func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)
    return err
}
```

＃＃＃实体/

这是映射到数据库表的结构。

```go
// 实体/用户.go
package entity

type User struct {
    ID        int64     `bun:",pk,autoincrement"`
    Name      string    `bun:",notnull"`
    Email     string    `bun:",unique,notnull"`
    CreatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp"`
    UpdatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp"`
}
```

### dto/

请求/响应对象。定义 API 合约。

```go
// dto/user_request.go
package dto

type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

type UpdateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

```go
// dto/user_response.go
package dto

type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

### 路线/

在一处管理您的路线。您一眼就能看出哪条路径连接到哪条处理程序。

```go
// 路线/user_routes.go
package routes

func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).GetUser)
    app.Route("POST", "/users", (*controller.UserController).CreateUser)
    app.Route("PUT", "/users", (*controller.UserController).UpdateUser)
    app.Route("DELETE", "/users", (*controller.UserController).DeleteUser)
}
```

### 拦截器/

这是请求前/后的处理逻辑。负责事务、日志、身份验证等。

```go
// 拦截器/logging_interceptor.go
package interceptor

type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s", ctx.Method(), ctx.Path())
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```

## 依赖流

```mermaid
graph TD
    Main[main.go]

    subgraph Constructor [注册 Constructor]
        Flow1["Controller → Service → Repository → DB"]
    end

    subgraph Interceptor [注册 Interceptor]
        Flow2["Tx → Logging → ..."]
    end

    subgraph Routes [注册 Routes]
        Flow3["GET /users → UserController.GetUser<br/>POST /users → UserController.CreateUser"]
    end

    Main --> Constructor --> Flow1
    Main --> Interceptor --> Flow2
    Main --> Routes --> Flow3
```

## 核心原则

|原理|描述 |
|------|------|
| **单向依赖** |控制器→服务→存储库（禁止反向）|
| **关注点分离** |每一层只执行自己的角色|
| **构造函数注入** |所有依赖项均通过构造函数注入 |
| **接口使用** |存储库接受带有 `bun.IDB` 的 DB/Tx |

## 后续步骤

- [教程：控制器](/zh-Hans/learn/tutorial/2-controller) — 如何编写控制器
- [教程：依赖注入](/zh-Hans/learn/tutorial/3-dependency-injection) — 深化 DI
- [教程：拦截器](/zh-Hans/learn/tutorial/4-interceptor) — 事务、日志记录实现
