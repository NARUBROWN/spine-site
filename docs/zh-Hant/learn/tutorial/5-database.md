# 資料庫連接

使用 Bun 連線到資料庫。

## 準備 CLI 專案

繼續使用[第一個應用程式](/zh-Hant/learn/getting-started/first-app)和[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中的 `example.com/my-app`。如果使用者資源尚未產生，先檢查並套用計畫：

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

先查看文字預覽中的產生檔案，再執行一般產生指令。已有此資源時跳過產生步驟。

CLI 只產生資源骨架及註冊程式碼，不提供 Bun、資料庫連線、模型或遷移產生器。以下檔案和依賴需要手動加入，保留產生的 `main.go`。

以下存放庫程式碼用於擴充 `src/user/user_repository.go`。產生的服務和控制器預設只是回傳 ID 的 GET 骨架；需要手動連接這些存放庫方法，才能提供實際資料庫查詢或 CRUD。


## 什麼是 Bun？

[Bun](https://bun.uptrace.dev/) 是一個輕量級的 Go ORM。

- SQL 友善－查詢直觀
- 類型安全性－編譯時驗證
- 快速性能 - 最小反射

Spine 不會強制執行特定的 ORM，但建議與 Bun 結合使用。

## 安裝

```bash
# Bun Core
go get github.com/uptrace/bun@v1.2.16

# MySQL 驅動程式 + 方言
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# 如果你使用 PostgreSQL
# 去取得 github.com/uptrace/bun/dialect/pgdialect
# 去取得 github.com/jackc/pgx/v5/stdlib
```

## 資料庫連接

### 寫一個串聯函數

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

`NewDB` 在應用程式執行時由 DI 建立時檢查連線。建構函式只支援一個回傳值。`BuildApplication` 只註冊提供者，不直接連線資料庫，使靜態檢查和產生的驗證測試不依賴資料庫。

### 註冊 Spine

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

## PostgreSQL 連接

PostgreSQL 程式碼用於替換 MySQL 的 `src/database/db.go`。只選擇一種，並相應調整 DSN 和遷移 SQL。`sql.Open` 本身不會驗證實際連線。

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

## 使用環境變數

使用環境變數而不是硬編碼。

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

## 實體定義

這是映射到資料庫表的結構。

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

### Bun 標籤

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

### 使用bun.IDB介面

使用 `bun.IDB` 將接受 `*bun.DB` 和 `bun.Tx`。

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

### 創造

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

### 刪除

```go
func (r *UserRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().
        Model((*entity.User)(nil)).
        Where("id = ?", id).
        Exec(ctx)

    return err
}
```

## 將產生的 GET 連接到資料庫

用以下程式碼替換 `src/user/user_controller.go`，並加入 `src/user/user_read.go`。保留產生的 `GET /user/:id` 路由及建構函式註冊。介面回傳已儲存的使用者，不存在的 ID 回傳 HTTP 404。完成此步驟後，產生的 ID 回應才會變為實際資料庫查詢。

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

## 遷移

### 建立遷移文件

將 SQL 檔案放在 `cmd/migrate/migrations` 中。遷移作為獨立程式手動加入；沒有 `spine migrate` 指令。準備資料庫後再明確執行。

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

### 遷移執行程式碼

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

### 執行

```bash
# 運行遷移
go run ./cmd/migrate

# 運行伺服器
spine dev
```

## 整體結構

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

## 與 Spine 集成

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

### 加入

```go
// SELECT * FROM users JOIN 訂單 ON users.id =orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

關聯查詢範例需要定義 `Orders` 關聯欄位、實體及 Bun 關聯標籤，以上基本 User 模型尚未包含這些定義。

## 主要摘要

|概念|描述 |
|------|------|
| **bun.IDB** |接受 DB 和 Tx 的介面 |
| **實體** |對應到表格的 Go 結構 |
| **儲存庫** |資料存取層|
| **遷移** |使用 SQL 文件進行架构管理 |

## 驗證

執行靜態契約和本機 Go 檢查。`verify` 通過不代表實際資料庫連線、遷移或 CRUD 已驗證。請準備 DSN 和測試資料庫，另行驗證連線與查詢。

```sh
go mod tidy
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

## 後續步驟

- [教學：事務](/zh-Hant/learn/tutorial/6-transaction) — 事務攔截器
- [教學：錯誤處理](/zh-Hant/learn/tutorial/7-error-handling) — 如何使用 httperr
