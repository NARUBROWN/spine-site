# 数据库连接

使用 Bun 连接到数据库。

## 准备 CLI 项目

继续使用[第一个应用](/zh-Hans/learn/getting-started/first-app)和[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中的 `example.com/my-app`。如果用户资源尚未生成，先检查并应用计划：

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

先查看文本预览中的生成文件，再运行普通生成命令。已有此资源时跳过生成。

CLI 只生成资源骨架及注册代码，不提供 Bun、数据库连接、模型或迁移生成器。下面的文件和依赖需要手动添加，保留生成的 `main.go`。

下面的存储库代码用于扩展 `src/user/user_repository.go`。生成的服务和控制器默认只是返回 ID 的 GET 骨架；需要手动连接这些存储库方法，才能提供真实数据库查询或 CRUD。


## 什么是 Bun？

[Bun](https://bun.uptrace.dev/) 是一个轻量级的 Go ORM。

- SQL 友好——查询直观
- 类型安全——编译时验证
- 快速性能 - 最小反射

Spine 不强制执行特定的 ORM，但建议与 Bun 结合使用。

## 安装

```bash
# Bun Core
go get github.com/uptrace/bun@v1.2.16

# MySQL 驱动程序 + 方言
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# 如果你使用 PostgreSQL
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```

## 数据库连接

### 编写一个串联函数

```go
// src/database/db.go
package database

import (
    "context"
    "database/sql"
    "os"
    "time"

    _ "github.com/go-sql-driver/mysql"
    "github.com/uptrace/bun"
    "github.com/uptrace/bun/dialect/mysqldialect"
)

func NewDB() *bun.DB {
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        panic("DATABASE_URL is required")
    }
    sqldb, err := sql.Open("mysql", dsn)
    if err != nil {
        panic(err)
    }
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := sqldb.PingContext(ctx); err != nil {
        _ = sqldb.Close()
        panic(err)
    }
    return bun.NewDB(sqldb, mysqldialect.New())
}
```

`NewDB` 在应用运行时由 DI 创建时检查连接。构造函数只支持一个返回值。`BuildApplication` 只注册提供者，不直接连接数据库，使静态检查和生成的验证测试不依赖数据库。

### 注册 Spine

```go
// internal/application/application.go
package application

import (
    "os"

    "example.com/my-app/src/database"
    "example.com/my-app/src/user"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController, database.NewDB)
    app.Route("GET", "/health", (*HealthController).Get)
    if err := user.Register(app); err != nil {
        return nil, boot.Options{}, err
    }

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## PostgreSQL 连接

PostgreSQL 代码用于替换 MySQL 的 `src/database/db.go`。只选择一种，并相应调整 DSN 和迁移 SQL。`sql.Open` 本身不会验证真实连接。

```go
// src/database/db.go
package database

import (
    "database/sql"
    "os"

    _ "github.com/jackc/pgx/v5/stdlib"
    "github.com/uptrace/bun"
    "github.com/uptrace/bun/dialect/pgdialect"
)

func NewDB() *bun.DB {
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        panic("DATABASE_URL is required")
    }
    sqldb, err := sql.Open("pgx", dsn)
    if err != nil {
        panic(err)
    }
    return bun.NewDB(sqldb, pgdialect.New())
}
```

## 使用环境变量

使用环境变量而不是硬编码。

```go
// src/database/db.go의 NewDB 내부 발췌
dsn := os.Getenv("DATABASE_URL")
if dsn == "" {
    panic("DATABASE_URL is required")
}
```

```bash
export DATABASE_URL="user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local"
spine dev
```

## 实体定义

这是映射到数据库表的结构。

```go
// src/entity/user.go
package entity

import "time"

type User struct {
    ID        int64     `bun:",pk,autoincrement" json:"id"`
    Name      string    `bun:",notnull" json:"name"`
    Email     string    `bun:",unique,notnull" json:"email"`
    CreatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp" json:"created_at"`
    UpdatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp" json:"updated_at"`
}
```

### Bun 标签

|标签 |描述 |
|------|------|
| `pk` | `pk`主键 |
| `autoincrement` | `autoincrement`自动增加 |
| `notnull` | `notnull`不为空|
| `unique` | `unique`独特的制药|
| `nullzero` | `nullzero` Go 将零值视为 NULL |
| `default:value` | `default:value`默认 |

---

## 创建存储库

### 使用bun.IDB接口

使用 `bun.IDB` 将接受 `*bun.DB` 和 `bun.Tx`。

```go
// src/user/user_repository.go
package user

import (
    "context"
    "example.com/my-app/src/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // 可接受 *bun.DB 或 bun.Tx
}

func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 查看

```go
func (r *UserRepository) FindByID(ctx context.Context, id int64) (*entity.User, error) {
    user := new(entity.User)

    err := r.db.NewSelect().
        Model(user).
        Where("id = ?", id).
        Scan(ctx)

    if err != nil {
        return nil, err
    }

    return user, nil
}

func (r *UserRepository) FindAll(ctx context.Context) ([]entity.User, error) {
    var users []entity.User

    err := r.db.NewSelect().
        Model(&users).
        Scan(ctx)

    return users, err
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*entity.User, error) {
    user := new(entity.User)

    err := r.db.NewSelect().
        Model(user).
        Where("email = ?", email).
        Scan(ctx)

    return user, err
}
```

### 创造

```go
func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)

    return err
}
```

### 修正

```go
func (r *UserRepository) Update(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewUpdate().
        Model(user).
        WherePK().
        Exec(ctx)

    return err
}
```

### 删除

```go
func (r *UserRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().
        Model((*entity.User)(nil)).
        Where("id = ?", id).
        Exec(ctx)

    return err
}
```

## 将生成的 GET 连接到数据库

用以下代码替换 `src/user/user_controller.go`，并添加 `src/user/user_read.go`。保留生成的 `GET /user/:id` 路由及构造函数注册。接口返回已保存的用户，不存在的 ID 返回 HTTP 404。完成此步骤后，生成的 ID 响应才会变为真实数据库查询。

```go
// src/user/user_controller.go
package user

import (
    "context"
    "database/sql"
    "errors"

    "example.com/my-app/src/entity"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct{ service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) Get(ctx context.Context, id path.Int) (httpx.Response[*entity.User], error) {
    user, err := c.service.FindByID(ctx, id.Value)
    if errors.Is(err, sql.ErrNoRows) {
        return httpx.Response[*entity.User]{}, httperr.NotFound("user not found")
    }
    if err != nil {
        return httpx.Response[*entity.User]{}, err
    }
    return httpx.Response[*entity.User]{Body: user}, nil
}
```

```go
// src/user/user_read.go
package user

import (
    "context"

    "example.com/my-app/src/entity"
)

func (s *UserService) FindByID(ctx context.Context, id int64) (*entity.User, error) {
    return s.repository.FindByID(ctx, id)
}
```

## 迁移

### 创建迁移文件

将 SQL 文件放在 `cmd/migrate/migrations` 中。迁移作为独立程序手动添加；没有 `spine migrate` 命令。准备数据库后再明确执行。

```sql
-- cmd/migrate/migrations/001_create_users.up.sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```sql
-- cmd/migrate/migrations/001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

### 迁移执行代码

```go
// cmd/migrate/main.go
package main

import (
    "context"
    "embed"
    "log"

    "example.com/my-app/src/database"
    "github.com/uptrace/bun"
    "github.com/uptrace/bun/migrate"
)

//go:embed migrations/*.sql
var sqlMigrations embed.FS

func main() {
    db := database.NewDB()
    defer db.Close()
    if err := runMigrations(context.Background(), db); err != nil {
        log.Fatal(err)
    }
    log.Println("Migrations applied successfully.")
}

func runMigrations(ctx context.Context, db *bun.DB) error {
    migrations := migrate.NewMigrations()
    if err := migrations.Discover(sqlMigrations); err != nil {
        return err
    }
    migrator := migrate.NewMigrator(db, migrations)
    if err := migrator.Init(ctx); err != nil {
        return err
    }
    _, err := migrator.Migrate(ctx)
    return err
}
```

### 执行

```bash
# 运行迁移
go run ./cmd/migrate

# 运行服务器
spine dev
```

## 整体结构

```text
my-app/
├── go.mod
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
├── src/
│   ├── database/db.go
│   ├── entity/user.go
│   └── user/
│       ├── user_route.go
│       ├── user_repository.go
│       ├── user_service.go
│       ├── user_read.go
│       └── user_controller.go
└── cmd/migrate/
    ├── main.go
    └── migrations/
        ├── 001_create_users.up.sql
        └── 001_create_users.down.sql
```

## 与 Spine 集成

```go
// internal/application/application.go
package application

import (
    "os"

    "example.com/my-app/src/database"
    "example.com/my-app/src/user"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController, database.NewDB)
    app.Route("GET", "/health", (*HealthController).Get)
    if err := user.Register(app); err != nil {
        return nil, boot.Options{}, err
    }

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

```go
// src/user/user_repository.go
// DI는 구체 타입 *bun.DB를 받고 내부 쿼리 필드는 bun.IDB로 유지합니다.
func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

## 查询示例

### 条件查找

```go
// 名称类似于“%alice%”的地方
err := r.db.NewSelect().
    Model(&users).
    Where("name LIKE ?", "%alice%").
    Scan(ctx)

// 其中年龄 > 20 且状态 = '活跃'
err := r.db.NewSelect().
    Model(&users).
    Where("age > ?", 20).
    Where("status = ?", "active").
    Scan(ctx)

// 哪里 id 在 (1, 2, 3)
err := r.db.NewSelect().
    Model(&users).
    Where("id IN (?)", bun.In([]int{1, 2, 3})).
    Scan(ctx)
```

### 排序和分页

```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### 计数

```go
// 从用户中选择 COUNT(*) 个
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

### 加入

```go
// SELECT * FROM users JOIN 订单 ON users.id =orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

关联查询示例需要定义 `Orders` 关联字段、实体及 Bun 关联标签，以上基本 User 模型尚未包含这些定义。

## 主要摘要

|概念|描述 |
|------|------|
| **bun.IDB** |接受 DB 和 Tx 的接口 |
| **实体** |映射到表的 Go 结构 |
| **存储库** |数据访问层|
| **迁移** |使用 SQL 文件进行模式管理 |

## 验证

执行静态契约和本地 Go 检查。`verify` 通过不代表真实数据库连接、迁移或 CRUD 已验证。请准备 DSN 和测试数据库，另行验证连接与查询。

```sh
go mod tidy
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

## 后续步骤

- [教程：事务](/zh-Hans/learn/tutorial/6-transaction) — 事务拦截器
- [教程：错误处理](/zh-Hans/learn/tutorial/7-error-handling) — 如何使用 httperr
