# 資料庫連接

使用 Bun 連線到資料庫。

## 包子是什麼？

[Bun](https://bun.uptrace.dev/) 是一個輕量級的 Go ORM。

- SQL 友善－查詢直觀
- 類型安全性－編譯時驗證
- 快速性能 - 最小反射

Spine 不會強制執行特定的 ORM，但建議與 Bun 結合使用。

＃＃ 安裝

```bash
# 包子芯
go get github.com/uptrace/bun

# MySQL 驅動程式 + 方言
go get github.com/uptrace/bun/dialect/mysqldialect
go get github.com/go-sql-driver/mysql

# 如果你使用 PostgreSQL
# 去取得 github.com/uptrace/bun/dialect/pgdialect
# 去取得 github.com/jackc/pgx/v5/stdlib
```

## 資料庫連接

### 寫一個串聯函數

```go
// 資料庫Go
package main

import (
    "database/sql"

    "github.com/uptrace/bun"
    "github.com/uptrace/bun/dialect/mysqldialect"
    _ "github.com/go-sql-driver/mysql"
)

func NewDB() *bun.DB {
    // MySQL連接
    sqldb, err := sql.Open("mysql", 
        "user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local",
    )
    if err != nil {
        panic(err)
    }
    
    // 檢查連接
    if err := sqldb.Ping(); err != nil {
        panic(err)
    }
    
    // Bun DB 創建
    db := bun.NewDB(sqldb, mysqldialect.New())
    
    return db
}
```

### 註冊 Spine

```go
// 主機程式
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

## PostgreSQL 連接

```go
// 資料庫Go
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

## 使用環境變數

使用環境變數而不是硬編碼。

```go
// 資料庫Go
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

## 實體定義

這是映射到資料庫表的結構。

```go
// 實體/使用者.go
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

### 麵包標籤

|標籤 |描述 |
|------|------|
| `pk` | `pk`主鍵 |
| `autoincrement` | `autoincrement`自動增加 |
| `notnull` | `notnull`不為空|
| `unique` | `unique`獨特的製藥|
| `nullzero` | `nullzero` Go 將零值視為 NULL |
| `default:value` | `default:value`預設 |

---

## 建立儲存庫

### 使用bun.IDB接口

使用 `bun.IDB` 將接受 `*bun.DB` 和 `*bun.Tx`。

```go
// 儲存庫/user_repository.go
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

＃＃＃ 查看

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

＃＃＃ 創造

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

＃＃＃ 刪除

```go
func (r *UserRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().
        Model((*entity.User)(nil)).
        Where("id = ?", id).
        Exec(ctx)
    
    return err
}
```

## 遷移

### 建立遷移文件

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

### 遷移執行程式碼

```go
// 主機程式
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

//去：嵌入遷移/*.sql
var sqlMigrations embed.FS

func main() {
    // CLI 標誌
    migrateOnly := flag.Bool("migrate", false, "Run migrations and exit")
    flag.Parse()

    db := NewDB()

    // 僅運行遷移
    if *migrateOnly {
        if err := runMigrations(context.Background(), db); err != nil {
            fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
            os.Exit(1)
        }
        fmt.Println("Migrations applied successfully.")
        return
    }

    // 啟動伺服器
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

    // 建立遷移表
    if err := migrator.Init(ctx); err != nil {
        return err
    }

    // 運行遷移
    if _, err := migrator.Migrate(ctx); err != nil {
        return err
    }
    
    return nil
}
```

＃＃＃ 執行

```bash
# 運行遷移
go run . -migrate

# 運行伺服器
go run .
```

## 整體結構

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

## 與 Spine 集成

```go
// 主機程式
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
// 儲存庫/user_repository.go
// 由於收到了bun.IDB，因此會自動注入*bun.DB。
func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

## 查詢範例

### 條件查找

```go
// 名稱類似於“%alice%”的地方
err := r.db.NewSelect().
    Model(&users).
    Where("name LIKE ?", "%alice%").
    Scan(ctx)

// 其中年齡 > 20 且狀態 = '活躍'
err := r.db.NewSelect().
    Model(&users).
    Where("age > ?", 20).
    Where("status = ?", "active").
    Scan(ctx)

// 哪裡 id 在 (1, 2, 3)
err := r.db.NewSelect().
    Model(&users).
    Where("id IN (?)", bun.In([]int{1, 2, 3})).
    Scan(ctx)
```

### 排序和分頁

```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### 計數

```go
// 從使用者中選擇 COUNT(*) 個
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

＃＃＃ 加入

```go
// SELECT * FROM users JOIN 訂單 ON users.id =orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

## 主要摘要

|概念|描述 |
|------|------|
| **bun.IDB** |接受 DB 和 Tx 的介面 |
| **實體** |對應到表格的 Go 結構 |
| **儲存庫** |資料存取層|
| **迁移** |使用 SQL 文件进行架构管理 |

## 後續步驟

- [教學：事務](/zh-Hant/learn/tutorial/6-transaction) — 事務攔截器
- [教學：錯誤處理](/zh-Hant/learn/tutorial/7-error-handling) — 如何使用 httperr
