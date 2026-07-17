# 数据库连接

使用 Bun 连接到数据库。

## 包子是什么？

[Bun](https://bun.uptrace.dev/) 是一个轻量级的 Go ORM。

- SQL 友好——查询直观
- 类型安全——编译时验证
- 快速性能 - 最小反射

Spine 不强制执行特定的 ORM，但建议与 Bun 结合使用。

## 安装

```bash
# 包子芯
go get github.com/uptrace/bun

# MySQL 驱动程序 + 方言
go get github.com/uptrace/bun/dialect/mysqldialect
go get github.com/go-sql-driver/mysql

# 如果你使用 PostgreSQL
# 去获取 github.com/uptrace/bun/dialect/pgdialect
# 去获取 github.com/jackc/pgx/v5/stdlib
```

## 数据库连接

### 编写一个串联函数

```go
// 数据库Go
package main

import (
    "database/sql"

    "github.com/uptrace/bun"
    "github.com/uptrace/bun/dialect/mysqldialect"
    _ "github.com/go-sql-driver/mysql"
)

func NewDB() *bun.DB {
    // MySQL连接
    sqldb, err := sql.Open("mysql",
        "user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local",
    )
    if err != nil {
        panic(err)
    }

    // 检查连接
    if err := sqldb.Ping(); err != nil {
        panic(err)
    }

    // Bun DB 创建
    db := bun.NewDB(sqldb, mysqldialect.New())

    return db
}
```

### 注册 Spine

```go
// 主程序
func main() {
    app := spine.New()

    app.Constructor(
        NewDB,  // *bun.DB 创建
        // ...
    )

    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

## PostgreSQL 连接

```go
// 数据库Go
package main

import (
    "database/sql"

    "github.com/uptrace/bun"
    "github.com/uptrace/bun/dialect/pgdialect"
    _ "github.com/jackc/pgx/v5/stdlib"
)

func NewDB() *bun.DB {
    sqldb, err := sql.Open("pgx",
        "postgres://user:password@localhost:5432/mydb?sslmode=disable",
    )
    if err != nil {
        panic(err)
    }

    db := bun.NewDB(sqldb, pgdialect.New())

    return db
}
```

## 使用环境变量

使用环境变量而不是硬编码。

```go
// 数据库Go
import "os"

func NewDB() *bun.DB {
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        dsn = "user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local"
    }

    sqldb, err := sql.Open("mysql", dsn)
    if err != nil {
        panic(err)
    }

    return bun.NewDB(sqldb, mysqldialect.New())
}
```

```bash
export DATABASE_URL="user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local"
go run main.go
```

## 实体定义

这是映射到数据库表的结构。

```go
// 实体/用户.go
package entity

import "time"

type User struct {
    ID        int64     `bun:",pk,autoincrement"`
    Name      string    `bun:",notnull"`
    Email     string    `bun:",unique,notnull"`
    CreatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp"`
    UpdatedAt time.Time `bun:",nullzero,notnull,default:current_timestamp"`
}
```

### 面包标签

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

使用 `bun.IDB` 将接受 `*bun.DB` 和 `*bun.Tx`。

```go
// 存储库/user_repository.go
package repository

import (
    "context"
    "myapp/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // 可接受 *bun.DB 或 *bun.Tx
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 查看

```go
func (r *UserRepository) FindByID(ctx context.Context, id int) (*entity.User, error) {
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

## 迁移

### 创建迁移文件

```sql
-- migrations/001_create_users.up.sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```sql
-- migrations/001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

### 迁移执行代码

```go
// 主程序
package main

import (
    "context"
    "embed"
    "flag"
    "fmt"
    "os"

    "github.com/uptrace/bun"
    "github.com/uptrace/bun/migrate"
)

//去：嵌入迁移/*.sql
var sqlMigrations embed.FS

func main() {
    // CLI 标志
    migrateOnly := flag.Bool("migrate", false, "Run migrations and exit")
    flag.Parse()

    db := NewDB()

    // 仅运行迁移
    if *migrateOnly {
        if err := runMigrations(context.Background(), db); err != nil {
            fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
            os.Exit(1)
        }
        fmt.Println("Migrations applied successfully.")
        return
    }

    // 启动服务器
    app := spine.New()
    // ...
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}

func runMigrations(ctx context.Context, db *bun.DB) error {
    migrations := migrate.NewMigrations()

    if err := migrations.Discover(sqlMigrations); err != nil {
        return err
    }

    migrator := migrate.NewMigrator(db, migrations)

    // 创建迁移表
    if err := migrator.Init(ctx); err != nil {
        return err
    }

    // 运行迁移
    if _, err := migrator.Migrate(ctx); err != nil {
        return err
    }

    return nil
}
```

### 执行

```bash
# 运行迁移
go run . -migrate

# 运行服务器
go run .
```

## 整体结构

```
myapp/
├── main.go
├── db.go                    # DB 连接
├── entity/
│   └── user.go              # 表映射
├── repository/
│   └── user_repository.go   # 数据访问
├── service/
│   └── user_service.go
├── controller/
│   └── user_controller.go
├── routes/
│   └── routes.go
└── migrations/
    ├── 001_create_users.up.sql
    └── 001_create_users.down.sql
```

## 与 Spine 集成

```go
// 主程序
func main() {
    app := spine.New()

    app.Constructor(
        NewDB,                          // *bun.DB
        repository.NewUserRepository,   // bun.IDB → *UserRepository
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

```go
// 存储库/user_repository.go
// 由于收到了bun.IDB，因此会自动注入*bun.DB。
func NewUserRepository(db bun.IDB) *UserRepository {
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

## 主要摘要

|概念|描述 |
|------|------|
| **bun.IDB** |接受 DB 和 Tx 的接口 |
| **实体** |映射到表的 Go 结构 |
| **存储库** |数据访问层|
| **迁移** |使用 SQL 文件进行模式管理 |

## 后续步骤

- [教程：事务](/zh-Hans/learn/tutorial/6-transaction) — 事务拦截器
- [教程：错误处理](/zh-Hans/learn/tutorial/7-error-handling) — 如何使用 httperr
