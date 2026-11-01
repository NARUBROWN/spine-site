# Database Connection

Connecting to a database using Bun.

## Prepare a CLI project

Continue in `example.com/my-app` from the [first app](/en/learn/getting-started/first-app) and [project structure](/en/learn/tutorial/1-project-structure) guides. If the user resource does not exist, review and apply its generation plan:

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

Review the generated files in the text preview, then run the normal generation command. Skip generation if the resource already exists.

The CLI generates the resource skeleton and registration. Bun, database connections, models, and migrations have no generator; add the files and dependencies below manually. Keep the generated `main.go`.

Extend `src/user/user_repository.go` with the repository code below. The generated service and controller are an ID-returning GET skeleton; wire them to these repository methods yourself before expecting database-backed reads or CRUD.


## What is Bun?

[Bun](https://bun.uptrace.dev/) is a lightweight ORM for Go.

- SQL-friendly — Queries are intuitive
- Type-safe — Compile-time validation
- Fast performance — Minimized reflection

Spine does not enforce a specific ORM, but recommends combining with Bun.


## Installation

```bash
# Bun Core
go get github.com/uptrace/bun@v1.2.16

# MySQL Driver + Dialect
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# If using PostgreSQL
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```


## Connecting to Database

### Writing Connection Function

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

`NewDB` checks connectivity when DI constructs it during app execution. Constructors support exactly one return value, so do not register a function returning `(*bun.DB, error)`. `BuildApplication` only registers the provider; it does not connect to the database, allowing static checks and the generated validation test to run without a database.

### Registering in Spine

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

## PostgreSQL Connection

The PostgreSQL code replaces the MySQL `src/database/db.go`. Use one variant and adapt both the DSN and migration SQL. `sql.Open` alone does not verify a live connection.

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


## Using Environment Variables

Use environment variables instead of hardcoding.

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


## Entity Definition

Structs that map to database tables.

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

### Bun Tags

| Tag | Description |
|------|------|
| `pk` | Primary Key |
| `autoincrement` | Auto Increment |
| `notnull` | NOT NULL |
| `unique` | UNIQUE Constraint |
| `nullzero` | Treat Go zero value as NULL |
| `default:value` | Default Value |

---

## Writing Repository

### Using bun.IDB Interface

Using `bun.IDB` allows accepting both `*bun.DB` and `bun.Tx`.

```go
// src/user/user_repository.go
package user

import (
    "context"
    "example.com/my-app/src/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // Can be *bun.DB or bun.Tx
}

func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

### Reading

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

### Creating

```go
func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)
    
    return err
}
```

### Updating

```go
func (r *UserRepository) Update(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewUpdate().
        Model(user).
        WherePK().
        Exec(ctx)
    
    return err
}
```

### Deleting

```go
func (r *UserRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().
        Model((*entity.User)(nil)).
        Where("id = ?", id).
        Exec(ctx)
    
    return err
}
```


## Connect the generated GET to the database

Replace `src/user/user_controller.go` with the code below and add `src/user/user_read.go`. Keep the generated `GET /user/:id` route and constructor registrations. This returns a persisted user or HTTP 404 for an absent ID. Complete this step to replace the generated ID-only response with a real database read.

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

## Migration

### Writing Migration Files

Place the SQL files below in `cmd/migrate/migrations`. Add migrations as a separate executable; there is no `spine migrate` command. Prepare the database and run this command deliberately.

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

### Migration Execution Code

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

### Execution

```bash
# Run migrations
go run ./cmd/migrate

# Run server
spine dev
```


## Overall Structure

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

## Integrating with Spine

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

## Query Examples

### Conditional Select

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

### Sort and Pagination

```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### Aggregation

```go
// SELECT COUNT(*) FROM users
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

### Join

```go
// SELECT * FROM users JOIN orders ON users.id = orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

The join example requires an `Orders` relation field, its entity, and Bun relation tags. The basic User model above does not define them.


## Key Takeaways

| Concept | Description |
|------|------|
| **bun.IDB** | Interface accepting both DB and Tx |
| **Entity** | Go struct mapping to table |
| **Repository** | Data access layer |
| **Migration** | Schema management with SQL files |


## Verification

Run static contract and local Go checks. A passing `verify` does not establish live database connectivity, migrations, or CRUD behavior. Prepare a DSN and test database to verify connections and queries separately.

```sh
go mod tidy
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

## Next Steps

- [Tutorial: Transaction](/en/learn/tutorial/6-transaction) — Transaction Interceptor
- [Tutorial: Error Handling](/en/learn/tutorial/7-error-handling) — httperr usage
