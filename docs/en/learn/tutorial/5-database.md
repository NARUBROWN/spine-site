# Connect to a database

Connect to MySQL with Bun and extend the generated `GET /user/:id` handler to look up users in the database. You will also write a migration to create the table and basic repository queries.

The feature-based `src/user` examples on this page use the `my-app` project created with `--layout legacy` in [Project Structure](/en/learn/tutorial/1-project-structure). CLI `v0.4.0` defaults to the role-based `layered-v1` layout. Both layouts use Spine `v0.6.0` and Echo platform `v0.1.0`.

## Prepare the CLI project

Continue with `example.com/my-app` from [Install the CLI and create your first app](/en/learn/tutorial/1-project-structure) and [Project structure](/en/learn/tutorial/1-project-structure). You need a MySQL database and an account with permission to create tables. Run commands from the project root.

If you have not created the user resource, review the files to be generated before applying the change. Do not generate an existing resource again.

```sh
spine-cli generate resource user --dry-run
```

```sh
spine-cli generate resource user
```

The CLI generates the basic user resource files and registration code. You will add the Bun dependencies, database connection, model, and migrations in the steps below. Keep the generated `main.go`.

The generated GET handler returns only the ID from the request. After writing the repository, connect it to the service and controller to enable database lookups. You will add save, update, and delete methods to the repository only; this tutorial does not implement their HTTP routes.

## Write queries with Bun

This example uses [Bun](https://bun.uptrace.dev/) to write SQL queries and map the results to Go structs. Spine does not require a particular ORM.

## Install dependencies

```bash
# Bun 코어
go get github.com/uptrace/bun@v1.2.16

# MySQL 드라이버 + 방언
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# PostgreSQL을 사용한다면
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```


## Connect to the database

### Write the connection function

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

`NewDB` checks the connection when dependency injection (DI) calls it at app startup. If `DATABASE_URL` is missing or the connection check fails, app startup stops.

Spine constructors support only one return value, so do not register a function that returns `(*bun.DB, error)`. Register only the constructor in `BuildApplication`. Do not connect to the database directly inside `BuildApplication`; this allows static checks and the generated verification tests to run without a database.

### Register with Spine

```go
// internal/application/application.go
package application

import (
    platform "github.com/NARUBROWN/spine-echo-platform"
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
    app := platform.New()
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

## Connect to PostgreSQL

To use PostgreSQL, replace the MySQL implementation in `src/database/db.go` with the following code. Use only one of the two implementations, and change the connection string (DSN) and migration SQL to match your database. The `sql.Open` call in this PostgreSQL example does not check the actual connection, so a connection error may occur on the first query.

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


## Set the connection string

The `NewDB` function above reads the connection string from the `DATABASE_URL` environment variable.

```go
// src/database/db.go의 NewDB 내부 발췌
dsn := os.Getenv("DATABASE_URL")
if dsn == "" {
    panic("DATABASE_URL is required")
}
```

```bash
export DATABASE_URL="user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local"
spine-cli dev
```


## Define the user model

Add a struct to `src/entity/user.go` that maps to the `users` table.

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

### Bun tags

| Tag | Description |
|------|------|
| `pk` | Primary key |
| `autoincrement` | Auto-increment |
| `notnull` | NOT NULL |
| `unique` | UNIQUE constraint |
| `nullzero` | Treat the Go type's zero value as NULL |
| `default:value` | Default value |

## Write the repository

### Use the bun.IDB interface

Replace the generated `src/user/user_repository.go` with the following code, then add the lookup, save, update, and delete methods below to the same file. `bun.IDB` is an interface implemented by both the regular connection type `*bun.DB` and the transaction type `bun.Tx`.

```go
// src/user/user_repository.go
package user

import (
    "context"
    "example.com/my-app/src/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // *bun.DB 또는 bun.Tx 모두 가능
}

func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

### Look up users

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

### Create a user

```go
func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)

    return err
}
```

### Update a user

```go
func (r *UserRepository) Update(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewUpdate().
        Model(user).
        WherePK().
        Exec(ctx)

    return err
}
```

### Delete a user

```go
func (r *UserRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().
        Model((*entity.User)(nil)).
        Where("id = ?", id).
        Exec(ctx)

    return err
}
```


## Connect the generated GET handler to the database

Replace the existing `src/user/user_controller.go` with the code below and add `src/user/user_read.go`. Keep the generated `GET /user/:id` route and constructor registration.

The GET handler now returns the stored user. It returns HTTP 404 if no row matches the ID, or HTTP 500 for any other database error.

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

## Migrations

### Write the migration files

Create the SQL files below in `cmd/migrate/migrations`. Migrations run as a separate Go program; there is no `spine-cli migrate` command. The next execution step adds a `users` table to an existing database, so check that the `DATABASE_URL` you set earlier points to a database for this example.

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

### Write the migration runner

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

### Run the migrations

Run this in the terminal where you set `DATABASE_URL`. If the migrations succeed, the program prints `Migrations applied successfully.` You can then start the server.

```bash
# 마이그레이션 실행
go run ./cmd/migrate

# 서버 실행
spine-cli dev
```


## Complete project structure

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

## Check app registration

Check the app's registrations so it can use the files you added. `BuildApplication()` is the same as the version above; you do not need to replace it again if you have already applied it. The repository constructor receives the concrete type `*bun.DB` through DI.

```go
// internal/application/application.go
package application

import (
    platform "github.com/NARUBROWN/spine-echo-platform"
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
    app := platform.New()
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

## Query examples

Use the following query syntax as a reference when extending the repository methods. Declare `users` and `ctx` in each method. To use the `age` and `status` conditions, first add those columns to the model and table.

### Filter results

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

### Sort and paginate

```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### Aggregate results

```go
// SELECT COUNT(*) FROM users
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

### Join tables

```go
// SELECT * FROM users JOIN orders ON users.id = orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

The `Orders` relationship in the join example requires a separate entity and Bun relationship tags. It is not included in the basic `User` model above.

## Verify

Run the static contract checks and local Go checks. `verify` does not test the actual database connection, migrations, or queries.

```sh
go mod tidy
go mod download all
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine-cli contract check
spine-cli verify
```

After running the migrations, start the app with `spine-cli dev` and request `GET /user/:id`. An empty table returns HTTP 404 because the ID does not exist. To save a user before looking it up, apply the POST example in the next tutorial on transactions.

## Next steps

- [Tutorial: Transactions](/en/learn/tutorial/6-transaction): Save users within a request transaction and check rollback behavior
- [Tutorial: Error handling](/en/learn/tutorial/7-error-handling): Return HTTP errors with `httperr`
