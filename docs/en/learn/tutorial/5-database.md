# Database Connection

Connecting to a database using Bun.

## What is Bun?

[Bun](https://bun.uptrace.dev/) is a lightweight ORM for Go.

- SQL-friendly — Queries are intuitive
- Type-safe — Compile-time validation
- Fast performance — Minimized reflection

Spine does not enforce a specific ORM, but recommends combining with Bun.


## Installation

```bash
# Bun Core
go get github.com/uptrace/bun

# MySQL Driver + Dialect
go get github.com/uptrace/bun/dialect/mysqldialect
go get github.com/go-sql-driver/mysql

# If using PostgreSQL
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```


## Connecting to Database

### Writing Connection Function

```go
// db.go
package main

import (
    "database/sql"

    "github.com/uptrace/bun"
    "github.com/uptrace/bun/dialect/mysqldialect"
    _ "github.com/go-sql-driver/mysql"
)

func NewDB() *bun.DB {
    // MySQL Connection
    sqldb, err := sql.Open("mysql", 
        "user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local",
    )
    if err != nil {
        panic(err)
    }
    
    // Check Connection
    if err := sqldb.Ping(); err != nil {
        panic(err)
    }
    
    // Create Bun DB
    db := bun.NewDB(sqldb, mysqldialect.New())
    
    return db
}
```

### Registering in Spine

```go
// main.go
func main() {
    app := spine.New()
    
    app.Constructor(
        NewDB,  // Creates *bun.DB
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

## PostgreSQL Connection

```go
// db.go
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


## Using Environment Variables

Use environment variables instead of hardcoding.

```go
// db.go
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


## Entity Definition

Structs that map to database tables.

```go
// entity/user.go
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

Using `bun.IDB` allows accepting both `*bun.DB` and `*bun.Tx`.

```go
// repository/user_repository.go
package repository

import (
    "context"
    "myapp/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // Can be *bun.DB or *bun.Tx
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### Reading

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


## Migration

### Writing Migration Files

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

### Migration Execution Code

```go
// main.go
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

//go:embed migrations/*.sql
var sqlMigrations embed.FS

func main() {
    // CLI Flags
    migrateOnly := flag.Bool("migrate", false, "Run migrations and exit")
    flag.Parse()

    db := NewDB()

    // Run migrations only
    if *migrateOnly {
        if err := runMigrations(context.Background(), db); err != nil {
            fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
            os.Exit(1)
        }
        fmt.Println("Migrations applied successfully.")
        return
    }

    // Start Server
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

    // Create migration table
    if err := migrator.Init(ctx); err != nil {
        return err
    }

    // Execute migration
    if _, err := migrator.Migrate(ctx); err != nil {
        return err
    }
    
    return nil
}
```

### Execution

```bash
// Run Migrations
go run . -migrate

// Run Server
go run .
```


## Overall Structure

```
myapp/
├── main.go
├── db.go                    # DB Connection
├── entity/
│   └── user.go              # Table Mapping
├── repository/
│   └── user_repository.go   # Data Access
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

## Integrating with Spine

```go
// main.go
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
// repository/user_repository.go
// Accepts bun.IDB, so *bun.DB is automatically injected
func NewUserRepository(db bun.IDB) *UserRepository {
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


## Key Takeaways

| Concept | Description |
|------|------|
| **bun.IDB** | Interface accepting both DB and Tx |
| **Entity** | Go struct mapping to table |
| **Repository** | Data access layer |
| **Migration** | Schema management with SQL files |


## Next Steps

- [Tutorial: Transaction](/en/learn/tutorial/6-transaction) — Transaction Interceptor
- [Tutorial: Error Handling](/en/learn/tutorial/7-error-handling) — httperr usage
