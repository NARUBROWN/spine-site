# 事务管理

继续使用[数据库](/zh-Hans/learn/tutorial/5-database)中的 CLI 项目 `example.com/my-app`。沿用 `src/database`、`src/entity` 和 `src/user`，手动添加以下事务代码。CLI 不提供 Bun 事务或 outbox 生成器。

## 执行顺序

Spine v0.5.1 在 `PreHandle` 中开启事务，在 `BeforeResponse` 中提交或回滚。响应序列化、状态码、Cookie 验证和事件派发等响应准备失败也能触发回滚。`AfterCompletion` 用于完成后的日志与清理。

```text
PreHandle: begin transaction
→ Controller → response preparation → PostHandle
→ BeforeResponse: rollback on error, commit on success
→ HTTP response flush
→ AfterCompletion: logging / cleanup
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

必须返回提交或回滚错误，以便计入最终执行错误。保留包含 `log`、`errors` 的导入以及四个拦截器方法。

## 注册到生成的应用

向 `internal/application/application.go` 的导入添加 `example.com/my-app/src/interceptor`。保留数据库教程中的 `database.NewDB` provider 以及 health、user 注册，只在现有 Constructor 调用中添加 `interceptor.NewTxInterceptor`。下面是 `BuildApplication()` 内的注册片段。

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

typed-nil `(*interceptor.TxInterceptor)(nil)` 会解析为 DI 创建的拦截器实例。`NewTxInterceptor` 返回一个值。HTTP 事务使用 `boot.InterceptorHTTP`，因为 `app.Interceptor(...)` 也作用于 WebSocket 消息。只作用于指定路由时，省略全局拦截器注册，并向该 `app.Route` 传入 `route.WithInterceptors((*interceptor.TxInterceptor)(nil))`。

## 将请求事务传给仓储

下面的 POST 示例手动扩展 `src/user`，使用生成的 `UserController.service` 和 `UserService.repository` 字段。请求 DTO 必须通过指针接收。`spine.Ctx` 来自 `github.com/NARUBROWN/spine/pkg/spine`，与根包重名时使用 `spinectx` 别名。

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

服务将 `bun.IDB` 传给仓储。`*bun.DB` 与 `bun.Tx` 都实现此接口，但请求事务不会重新注入构造函数。按下方方式添加或调整仓储的 `Save(ctx, db, user)`。

用下面的实现替换已有的 `Save` 方法，不要再声明同名方法。

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

在 `src/user/user_route.go` 的 `Register` 中手动添加 POST 路由，保留现有 GET 注册。

```go
app.Route("POST", "/user", (*UserController).Create)
```

## 同一请求中的多次写入与 rollback

使用与单个创建相同的事务保存多个用户。添加 `src/user/user_batch.go`，并在 `src/user/user_route.go` 的 `Register` 中注册下面的 POST 路由。如果第二次 INSERT 因 email 重复失败，第一次 INSERT 也必须 rollback。

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

要跳过读取请求，在 `PreHandle` 开头添加以下条件。`BeforeResponse` 也必须处理没有事务的情况。不要跳过必须使用事务的处理函数。

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

契约与本地检查通过并不能证明真实数据库提交或回滚成功。运行应用需要数据库教程中的 `DATABASE_URL` 与迁移。请在真实数据库上单独验证成功保存、失败回滚及提交和回滚错误的处理。

## 使用真实数据库验证

先按数据库教程运行迁移，再启动应用。以下请求假设测试数据库为空。第一次请求返回 HTTP 201，使用响应中的 ID 发起 GET 可读取保存的用户。batch 的第二个 email 重复，因此返回 HTTP 500。本例将数据库错误作为普通错误返回，响应不会泄露内部 SQL 错误。

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

通过数据库客户端确认下面 SELECT 的结果分别为 1 和 0。第二个结果为 0 才能说明错误发生前的第一次 INSERT 也已 rollback。随后使用唯一 email 请求，仍应返回 HTTP 201 并保存成功。

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 原子性边界

数据库提交与 broker 发布或实际 socket write 不是一个原子事务。事件发布后仍可能提交失败，提交后仍可能响应发送失败。将业务变更与 outbox 记录存入同一数据库事务，由独立 relay 发布，消费者使用稳定的事件 ID 去重。

- [Interceptor API](/zh-Hans/reference/api/interceptor)
- [Database](/zh-Hans/learn/tutorial/5-database)
