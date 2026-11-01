# 事务管理

将一次 HTTP 请求中执行的多个 INSERT 合并到同一个事务。编写拦截器，在请求成功时提交，中途失败时连同之前的 INSERT 一并回滚。

在[数据库](/zh-Hans/learn/tutorial/5-database)教程的 `example.com/my-app` 项目上继续操作。请先准备 `src/database`、`src/entity`、`src/user` 和迁移。以下事务代码需要手动添加，CLI 不提供 Bun 事务或 outbox 生成器。

## 执行顺序

在 Spine v0.5.1 中，在 `PreHandle` 中启动事务，并在 `BeforeResponse` 中提交或回滚。响应序列化、状态码和 Cookie 验证、事件发布等响应准备过程中发生的错误，也会触发回滚。`AfterCompletion` 用于在完成后记录日志或清理资源。

```text
PreHandle: 启动事务
→ 控制器 → 响应准备 → PostHandle
→ BeforeResponse: 有错误则回滚，否则提交
→ 发送 HTTP 响应
→ AfterCompletion: 记录日志并清理资源
```

## 实现拦截器

```go
// src/interceptor/tx_interceptor.go
package interceptor

import (
    "errors"
    "log"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct{ db *bun.DB }

func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Context() == nil {
        return errors.New("execution context has no request context")
    }
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TxInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    value, ok := ctx.Get("tx")
    if !ok {
        return nil
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return errors.New("transaction has unexpected type")
    }
    if executionErr != nil {
        return tx.Rollback()
    }
    return tx.Commit()
}

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[TX] %s %s: %v", ctx.Method(), ctx.Path(), err)
    }
}
```

必须返回 `Commit()` 和 `Rollback()` 的错误，才能将其计入最终执行错误。请保留包含 `log` 和 `errors` 的 import，以及全部四个拦截器方法。

## 注册到生成的应用

在 `internal/application/application.go` 的 import 块中添加 `example.com/my-app/src/interceptor`。保留数据库教程中注册的 `database.NewDB`，以及 health 和 user 注册，并在现有的 `app.Constructor` 调用中添加 `interceptor.NewTxInterceptor`。以下代码是 `BuildApplication()` 中的注册部分。

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

`(*interceptor.TxInterceptor)(nil)` 指定拦截器类型。Spine 通过 DI 创建该类型的实例，`NewTxInterceptor` 必须只返回一个值。

若只应用于 HTTP 请求，请按上例使用 `boot.InterceptorHTTP`。`app.Interceptor(...)` 也会应用于 WebSocket 消息。若只应用于特定路由，请省略全局注册，并在相应的 `app.Route` 中指定 `route.WithInterceptors((*interceptor.TxInterceptor)(nil))` 选项。

## 将请求事务传递给仓储

添加 `src/user/user_create.go`，使用请求中的事务保存用户。这里使用生成的 `UserController` 的 `service` 字段和 `UserService` 的 `repository` 字段。

请求 DTO 通过指针接收。`spine.Ctx` 来自 `github.com/NARUBROWN/spine/pkg/spine`。以下代码使用别名 `spinectx`，以免与应用根包重名。

```go
// src/user/user_create.go
package user

import (
    "context"
    "errors"
    "net/http"

    "example.com/my-app/src/entity"
    "github.com/NARUBROWN/spine/pkg/httpx"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

type CreateUserRequest struct {
    Name string `json:"name"`
    Email string `json:"email"`
}

func (c *UserController) Create(ctx context.Context, values spinectx.Ctx, req *CreateUserRequest) (httpx.Response[*entity.User], error) {
    value, ok := values.Get("tx")
    if !ok {
        return httpx.Response[*entity.User]{}, errors.New("transaction is missing")
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return httpx.Response[*entity.User]{}, errors.New("transaction has unexpected type")
    }
    user, err := c.service.Create(ctx, tx, req)
    if err != nil {
        return httpx.Response[*entity.User]{}, err
    }
    return httpx.Response[*entity.User]{
        Body: user,
        Options: httpx.ResponseOptions{Status: http.StatusCreated},
    }, nil
}

func (s *UserService) Create(ctx context.Context, db bun.IDB, req *CreateUserRequest) (*entity.User, error) {
    user := &entity.User{Name: req.Name, Email: req.Email}
    if err := s.repository.Save(ctx, db, user); err != nil {
        return nil, err
    }
    if err := db.NewSelect().Model(user).WherePK().Scan(ctx); err != nil {
        return nil, err
    }
    return user, nil
}
```

服务以 `bun.IDB` 接收请求中的事务，并传递给仓储。`*bun.DB` 和 `bun.Tx` 实现相同的接口，但请求中的事务不会自动重新注入仓储构造函数。

用以下实现替换 `src/user/user_repository.go` 中现有的 `Save` 方法。不要额外声明同名方法。

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

在 `src/user/user_route.go` 的 `Register` 中手动添加 POST 路由。保留现有的 GET 注册。

```go
app.Route("POST", "/user", (*UserController).Create)
```

## 合并多次写入并检查回滚

这次在一次请求中保存多个用户。创建 `src/user/user_batch.go`，并将以下 POST 路由添加到 `src/user/user_route.go` 的 `Register` 中。如果第二个 INSERT 因邮箱重复而失败，第一个 INSERT 也应回滚。

```go
// src/user/user_batch.go
package user

import (
    "context"
    "errors"
    "net/http"

    "example.com/my-app/src/entity"
    "github.com/NARUBROWN/spine/pkg/httpx"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

type CreateUsersRequest struct {
    Users []CreateUserRequest `json:"users"`
}

func (c *UserController) CreateBatch(ctx context.Context, values spinectx.Ctx, req *CreateUsersRequest) (httpx.Response[[]*entity.User], error) {
    value, ok := values.Get("tx")
    if !ok {
        return httpx.Response[[]*entity.User]{}, errors.New("transaction is missing")
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return httpx.Response[[]*entity.User]{}, errors.New("transaction has unexpected type")
    }
    users := make([]*entity.User, 0, len(req.Users))
    for index := range req.Users {
        user, err := c.service.Create(ctx, tx, &req.Users[index])
        if err != nil {
            return httpx.Response[[]*entity.User]{}, err
        }
        users = append(users, user)
    }
    return httpx.Response[[]*entity.User]{
        Body: users,
        Options: httpx.ResponseOptions{Status: http.StatusCreated},
    }, nil
}
```

```go
app.Route("POST", "/user/batch", (*UserController).CreateBatch)
```

## 排除读取请求

如果不希望在读取请求中启动事务，请在 `PreHandle` 的开头添加以下条件。`BeforeResponse` 也必须处理不存在事务的情况，上面的实现已经包含该处理。不要将使用事务的控制器列入排除范围。

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## 验证与运行

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
spine doctor
spine inspect
spine contract check
spine verify
spine dev
```

契约检查和本地检查无法确认实际数据库中的提交与回滚。运行应用需要完成数据库教程中的 `DATABASE_URL` 设置和迁移。下一步将检查成功请求的数据保存和失败请求的回滚。如果提交或回滚本身失败，相应的错误处理需要另行检查。

## 在实际数据库中检查

按照数据库教程执行迁移并启动应用后，在另一终端中发送以下请求。示例中的 GET 假设使用新建的测试数据库，且第一个用户的 ID 为 1。如果使用现有数据库，请根据 POST 响应中的 ID 修改 GET 路径。

第一个 POST 会保存用户并返回 HTTP 201，随后使用响应中的 ID 发起 GET 请求，会返回同一用户。`/user/batch` 请求会因第二个邮箱重复而失败，返回 HTTP 500。由于数据库错误以普通错误返回，响应不会暴露内部 SQL 错误。

```bash
curl -i -X POST http://localhost:8080/user \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
curl -i http://localhost:8080/user/1

curl -i -X POST http://localhost:8080/user/batch \
  -H 'Content-Type: application/json' \
  -d '{"users":[{"name":"Rollback","email":"rollback@example.com"},{"name":"Duplicate","email":"alice@example.com"}]}'

curl -i -X POST http://localhost:8080/user \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bob","email":"bob@example.com"}'
```

在数据库客户端中，确认以下 SELECT 的结果分别为 1 和 0。如果第二个结果为 0，说明失败前执行的第一个 INSERT 也已回滚。最后的 Bob 请求使用不重复的邮箱，因此应再次保存成功并返回 HTTP 201。

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 原子性边界

数据库提交、向消息代理发布事件、通过套接字发送响应，无法合并为一个原子事务。可能在发布事件后数据库提交失败，也可能在提交后响应发送失败。

如果需要同时保证数据库变更和事件记录，请在同一个数据库事务中保存 outbox 记录，再通过独立的投递任务发布事件。重发时也应使用相同的事件 ID，消费者需要根据此 ID 判断重复事件。

- [Interceptor API](/zh-Hans/reference/api/interceptor)
- [数据库连接](/zh-Hans/learn/tutorial/5-database)
