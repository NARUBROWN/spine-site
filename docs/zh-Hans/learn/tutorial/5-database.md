# 数据库连接

::: info
本教程的 `legacy` 布局使用兼容的 `app.Route`。新控制器请参阅[路由迁移](/zh-Hans/learn/migration/preview-controller-routes)，输入兼容规则请参阅[输入迁移](/zh-Hans/learn/migration/v0.7.1-preview)，规范选项请参阅 [OpenAPI](/zh-Hans/reference/api/openapi)。
:::

使用 Bun 连接 MySQL，并扩展生成的 `GET /user/:id`，使其从数据库查询用户。同时编写用于建表的迁移和仓储的基本查询。

本页的 `src/user` 示例使用[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中通过 `--layout legacy` 创建的应用。默认 `layered-v1` 布局按角色划分目录。

## 准备 CLI 项目

在 [CLI 安装与第一个应用](/zh-Hans/learn/tutorial/1-project-structure)和[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中的 `example.com/my-app` 项目上继续操作。需要一个可连接的 MySQL 数据库，以及有权创建表的账号。所有命令均在项目根目录执行。

如果尚未创建用户资源，先查看将要生成的文件，再应用变更。已创建的资源无需再次生成。

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

CLI 会生成用户资源的基本文件和注册代码。Bun 依赖、数据库连接、模型和迁移需要在以下步骤中手动添加。保留生成的 `main.go`。

生成的 GET 处理器只返回请求中的 ID。编写仓储后，还需要连接服务和控制器，才能执行实际查询。保存、修改和删除方法仅添加到仓储，本教程不实现相应的 HTTP 路由。

## 使用 Bun 编写查询

本示例使用 [Bun](https://bun.uptrace.dev/) 编写 SQL 查询，并将结果映射到 Go 结构体。Spine 不要求使用特定 ORM。

## 安装

```bash
# Bun 核心
go get github.com/uptrace/bun@v1.2.16

# MySQL 驱动 + 方言
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# 如果使用 PostgreSQL
# go get github.com/uptrace/bun/dialect/pgdialect@v1.2.16
# go get github.com/jackc/pgx/v5/stdlib@v5.12.0
```

请让 Bun 核心和所用方言保持相同版本。版本不一致会导致初始化失败。


## 数据库连接

### 编写连接函数

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

`NewDB` 在应用运行期间通过依赖注入（DI）调用时检查连接。如果未设置 `DATABASE_URL`，或连接检查失败，应用将停止运行。

Spine 构造函数只支持一个返回值，因此不要注册返回 `(*bun.DB, error)` 的函数。在 `BuildApplication` 中只注册构造函数。不要在该函数中直接连接数据库，这样静态检查和生成的验证测试才能在没有数据库的情况下运行。

### 注册到 Spine

```go
// internal/application/application.go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
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
    app := spine.New(echoplatform.Option())
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

## 连接 PostgreSQL

如果使用 PostgreSQL，请用以下代码替换 MySQL 版本的 `src/database/db.go`。两种实现只能选择一种，连接字符串（DSN）和迁移 SQL 也需要根据所选数据库调整。此 PostgreSQL 示例中的 `sql.Open` 不会检查实际连接，因此可能在执行第一个查询时出现连接错误。

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


## 设置连接字符串

上述 `NewDB` 从环境变量 `DATABASE_URL` 读取连接字符串。

```go
// 摘自 src/database/db.go 中的 NewDB
dsn := os.Getenv("DATABASE_URL")
if dsn == "" {
    panic("DATABASE_URL is required")
}
```

```bash
export DATABASE_URL="user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local"
spine dev
```


## 定义用户模型

在 `src/entity/user.go` 中添加映射到 `users` 表的结构体。

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

| 标签 | 说明 |
|------|------|
| `pk` | 主键 |
| `autoincrement` | 自增 |
| `notnull` | NOT NULL |
| `unique` | UNIQUE 约束 |
| `nullzero` | 将 Go 类型的零值视为 NULL |
| `default:value` | 默认值 |

## 编写仓储

### 使用 bun.IDB 接口

用以下代码替换生成的 `src/user/user_repository.go`，并在同一文件中添加后续的查询、保存、修改和删除方法。`bun.IDB` 是普通连接 `*bun.DB` 和事务 `bun.Tx` 都实现的接口。

```go
// src/user/user_repository.go
package user

import (
    "context"
    "example.com/my-app/src/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // *bun.DB 或 bun.Tx 均可
}

func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 查询

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

### 创建

```go
func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)

    return err
}
```

### 修改

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


## 将生成的 GET 连接到数据库查询

用以下代码替换现有的 `src/user/user_controller.go`，并添加 `src/user/user_read.go`。保留生成的 `GET /user/:id` 路由和构造函数注册。

现在 GET 会返回已保存的用户。如果没有与 ID 对应的记录，则返回 HTTP 404；如果发生其他数据库错误，则返回 HTTP 500。

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
    "github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{ service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) Get(ctx context.Context, id input.Path[int64]) (httpx.Response[*entity.User], error) {
    user, err := c.service.FindByID(ctx, *id)
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

### 编写迁移文件

在 `cmd/migrate/migrations` 中创建以下 SQL 文件。迁移通过独立的 Go 程序执行，不存在 `spine migrate` 命令。接下来的执行步骤会向现有数据库添加 `users` 表，因此请确认之前设置的 `DATABASE_URL` 指向示例数据库。

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

在已设置 `DATABASE_URL` 的终端中执行。迁移成功后会输出 `Migrations applied successfully.`，随后即可启动服务器。

```bash
# 运行迁移
go run ./cmd/migrate

# 启动服务器
spine dev
```


## 完整结构

```text
my-app/
├── go.mod
├── go.sum
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

## 检查应用注册

检查应用的注册配置，确保能够使用新增文件。`BuildApplication()` 与前面编写的内容相同，如果已经应用，无需再次替换。仓储构造函数通过 DI 接收具体类型 `*bun.DB`。

```go
// internal/application/application.go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
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
    app := spine.New(echoplatform.Option())
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
// DI 接收具体类型 *bun.DB，内部查询字段保持为 bun.IDB。
func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

## 查询示例

以下查询语句可作为扩展仓储方法时的参考。`users` 和 `ctx` 需要在各方法中声明。如果要使用 `age` 和 `status` 条件，请先向模型和表中添加相应的列。

### 条件查询

```go
// WHERE name LIKE '%alice%'
err := r.db.NewSelect().
    Model(&users).
    Where("name LIKE ?", "%alice%").
    Scan(ctx)

// WHERE age > 20 AND status = 'active'
err := r.db.NewSelect().
    Model(&users).
    Where("age > ?", 20).
    Where("status = ?", "active").
    Scan(ctx)

// WHERE id IN (1, 2, 3)
err := r.db.NewSelect().
    Model(&users).
    Where("id IN (?)", bun.In([]int{1, 2, 3})).
    Scan(ctx)
```

### 排序与分页

```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### 聚合

```go
// SELECT COUNT(*) FROM users
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

### 连接查询

```go
// Load the Orders relation configured on User.
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

连接查询示例中的 `Orders` 关系需要另行定义实体和 Bun 关系标签才能工作。上面的基本 `User` 模型不包含此关系。 根据关联类型，Bun 可能执行单独的查询，因此不要假设此调用总是生成单个 SQL JOIN。

## 验证

执行静态契约检查和本地 Go 检查。`verify` 不会验证实际数据库连接、迁移或查询。

```sh
go mod tidy
go mod download all
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

迁移完成后，使用 `spine dev` 运行应用，并请求 `GET /user/:id`。如果表为空，由于不存在对应的 ID，将返回 HTTP 404。若要先保存用户再查询，请应用下一篇事务教程中的 POST 示例。

## 下一步

- [教程：事务](/zh-Hans/learn/tutorial/6-transaction)：在请求中保存用户并检查回滚
- [教程：错误处理](/zh-Hans/learn/tutorial/7-error-handling)：使用 `httperr` 返回 HTTP 错误
