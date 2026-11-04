# 資料庫連線

::: warning v0.7.0 Preview 輸入 API 移轉
本頁既有 API 說明與範例以穩定版 `v0.6.5` 為基準。自 `v0.7.0-preview.1` 起，可依輸入來源使用獨立的 Path、Query 與 Header DTO。`query.Values`、`header.Values` 及其建構與讀取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均標記為 Deprecated。

新的 DTO 方式無法直接用於 `v0.6.5`。在 Preview 中，同一處理器混用新 DTO 與 Deprecated 輸入也會在啟動時遭到拒絕。既有本文 DTO 與情境仍可搭配任一方式使用。

適用版本與移轉範例請見 [Preview 處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)，規格選項請見 [執行階段 OpenAPI](/zh-Hant/reference/api/openapi)。
:::

使用 Bun 連線至 MySQL，並擴充產生的 `GET /user/:id`，讓它從資料庫查詢使用者。同時撰寫建立資料表的遷移檔與儲存庫的基本查詢。

本頁依功能劃分的 `src/user` 範例使用[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中以 `--layout legacy` 建立的 `my-app`。CLI `v0.4.2` 預設產生依角色劃分的 `layered-v1` 結構。兩種布局都使用 Spine `v0.6.5` 與 Echo 平台 `v0.1.0`。

## 準備 CLI 專案

接續 [安裝 CLI 與第一個應用程式](/zh-Hant/learn/tutorial/1-project-structure)和[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中的 `example.com/my-app`。您需要可連線的 MySQL 資料庫，以及具備建立資料表權限的帳號。請在專案根目錄執行命令。

若尚未建立使用者資源，先確認將產生的檔案，再套用變更。已建立的資源不必重新產生。

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

CLI 會產生使用者資源的基本檔案與註冊程式碼。Bun 相依套件、資料庫連線、模型與遷移將在以下步驟中自行新增。請保留產生的 `main.go`。

產生的 GET 處理器只會回傳請求中的 ID。撰寫儲存庫後，還需要串接服務與控制器，才能實際查詢資料。儲存、修改與刪除方法只會新增至儲存庫，本文件不會實作對應的 HTTP 路徑。

## 使用 Bun 撰寫查詢

此範例使用 [Bun](https://bun.uptrace.dev/) 撰寫 SQL 查詢，並將結果對應至 Go 結構。Spine 不要求使用特定 ORM。

## 安裝

```bash
# Bun 核心
go get github.com/uptrace/bun@v1.2.16

# MySQL 驅動程式 + 方言
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# 如果使用 PostgreSQL
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```


## 資料庫連線

### 撰寫連線函式

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

`NewDB` 在應用程式執行期間由相依性注入（DI）呼叫時，會檢查連線。若未設定 `DATABASE_URL` 或連線檢查失敗，就會停止應用程式。

Spine 建構函式只支援一個回傳值，因此不要註冊回傳 `(*bun.DB, error)` 的函式。只在 `BuildApplication` 中註冊建構函式。請勿在此函式中直接連線至資料庫，這樣才能在沒有 DB 的情況下執行靜態檢查與產生的驗證測試。

### 在 Spine 中註冊

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

## PostgreSQL 連線

若使用 PostgreSQL，請以以下程式碼取代 MySQL 版的 `src/database/db.go`。兩種實作只能擇一使用，連線字串（DSN）與遷移 SQL 也需要配合所選的 DB 修改。此 PostgreSQL 範例的 `sql.Open` 不會檢查實際連線，因此可能在第一次查詢時才發生連線錯誤。

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


## 設定連線字串

上方的 `NewDB` 從環境變數 `DATABASE_URL` 讀取連線字串。

```go
// 節錄自 src/database/db.go 中的 NewDB
dsn := os.Getenv("DATABASE_URL")
if dsn == "" {
    panic("DATABASE_URL is required")
}
```

```bash
export DATABASE_URL="user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local"
spine dev
```


## 定義使用者模型

在 `src/entity/user.go` 中新增對應 `users` 資料表的結構。

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

| 標籤 | 說明 |
|------|------|
| `pk` | 主索引鍵 |
| `autoincrement` | 自動遞增 |
| `notnull` | NOT NULL |
| `unique` | UNIQUE 限制 |
| `nullzero` | 將 Go 型別的預設值視為 NULL |
| `default:value` | 預設值 |

## 撰寫儲存庫

### 使用 bun.IDB 介面

以以下程式碼取代產生的 `src/user/user_repository.go`，再將後續的查詢、儲存、修改與刪除方法新增至同一個檔案。`bun.IDB` 是一般連線 `*bun.DB` 與交易 `bun.Tx` 都有實作的介面。

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

### 查詢

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

### 建立

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


## 將產生的 GET 串接至 DB 查詢

以以下程式碼取代既有的 `src/user/user_controller.go`，並新增 `src/user/user_read.go`。保留產生的 `GET /user/:id` 路徑與建構函式註冊。

現在 GET 會回傳已儲存的使用者。若沒有符合 ID 的資料列，則回傳 HTTP 404；若發生其他資料庫錯誤，則回傳 HTTP 500。

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

### 撰寫遷移檔

在 `cmd/migrate/migrations` 中建立以下 SQL 檔案。遷移由獨立的 Go 程式執行，並沒有 `spine migrate` 命令。下一個執行步驟會在既有資料庫中新增 `users` 資料表，因此請確認先前設定的 `DATABASE_URL` 指向範例用 DB。

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

### 執行遷移的程式碼

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

在已設定 `DATABASE_URL` 的終端機中執行。遷移成功後會輸出 `Migrations applied successfully.`，接著即可啟動伺服器。

```bash
# 執行移轉
go run ./cmd/migrate

# 啟動伺服器
spine dev
```


## 完整結構

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

## 確認應用程式註冊

確認應用程式的註冊狀態，讓新增的檔案能夠使用。`BuildApplication()` 與先前撰寫的內容相同；若已套用，就不需要再次取代。儲存庫建構函式透過 DI 接收具體型別 `*bun.DB`。

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
// DI 接收具體型別 *bun.DB，內部查詢欄位維持為 bun.IDB。
func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

## 查詢範例

以下程式碼是在擴充儲存庫方法時可參考的查詢語法。`users` 與 `ctx` 必須在各方法中宣告。若要使用 `age`、`status` 條件，請先在模型與資料表中新增對應欄位。

### 條件查詢

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

### 排序與分頁

```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### 彙總

```go
// SELECT COUNT(*) FROM users
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

### 聯結

```go
// SELECT * FROM users JOIN orders ON users.id = orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

聯結範例中的 `Orders` 關聯必須另外定義實體與 Bun 關聯標籤才能運作。上方的基本 `User` 模型並未包含這些定義。

## 驗證

執行靜態契約與本機 Go 檢查。`verify` 不會驗證實際的 DB 連線、遷移與查詢。

```sh
go mod tidy
go mod download all
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

遷移後，以 `spine dev` 啟動應用程式，並傳送 `GET /user/:id` 請求。空資料表中沒有對應的 ID，因此會回傳 HTTP 404。若要先儲存使用者再查詢，請套用下一篇交易教學中的 POST 範例。

## 下一步

- [教學：交易](/zh-Hant/learn/tutorial/6-transaction)：以請求為單位儲存使用者並確認回滾
- [教學：錯誤處理](/zh-Hant/learn/tutorial/7-error-handling)：使用 `httperr` 回傳 HTTP 錯誤
