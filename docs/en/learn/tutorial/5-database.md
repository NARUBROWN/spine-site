# Database connections

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

This independent project queries MySQL with Bun. Do not combine it with the previous single-file main.go.

## Preparation

Use Go 1.26 or later and MySQL. Create the shown files under example.com/my-app; the CLI is not assumed to generate database connections or migrations.

```sh
go mod init example.com/my-app
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
go get github.com/uptrace/bun@v1.2.16 github.com/uptrace/bun/dialect/mysqldialect@v1.2.16 github.com/go-sql-driver/mysql@v1.9.3
```

## DB factory

```go
// src/database/db.go
package database

import (
	"context"
	"database/sql"
	_ "github.com/go-sql-driver/mysql"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/mysqldialect"
	"os"
	"time"
)

func NewDB() *bun.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		panic("DATABASE_URL is required")
	}
	sqlDB, err := sql.Open("mysql", dsn)
	if err != nil {
		panic(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		_ = sqlDB.Close()
		panic(err)
	}
	return bun.NewDB(sqlDB, mysqldialect.New())
}
```

NewDB checks the connection during DI preparation. It returns one *bun.DB; initialization panics fail preparation. Arbitrary DI Close methods are not automatic. The app owner must close connections; a production resource manager is outside this example.

## User model

```go
// src/entity/user.go
package entity

type User struct {
	ID    int64  `bun:",pk,autoincrement" json:"id"`
	Name  string `bun:",notnull" json:"name"`
	Email string `bun:",unique,notnull" json:"email"`
}
```

## Repository and service

FindByID uses the DB connection; Save accepts an explicit bun.IDB for request transactions in the next chapter. Shared services and repositories use standard context.Context, extracted from spine.Ctx by HTTP handlers.

```go
// src/repository/user_repository.go
package repository

import (
	"context"
	"example.com/my-app/src/entity"
	"github.com/uptrace/bun"
)

type UserRepository struct{ db *bun.DB }

func (*UserRepository) Constructor(db *bun.DB) *UserRepository {
	return &UserRepository{db: db}
}
func (r *UserRepository) FindByID(ctx context.Context, id int64) (*entity.User, error) {
	user := new(entity.User)
	if err := r.db.NewSelect().Model(user).Where("id = ?", id).Scan(ctx); err != nil {
		return nil, err
	}
	return user, nil
}
func (r *UserRepository) Save(ctx context.Context, runner bun.IDB, user *entity.User) error {
	_, err := runner.NewInsert().Model(user).Exec(ctx)
	return err
}
```

```go
// src/service/user_service.go
package service

import (
	"context"
	"example.com/my-app/src/entity"
	"example.com/my-app/src/repository"
	"github.com/uptrace/bun"
)

type UserService struct{ repository *repository.UserRepository }

func (*UserService) Constructor(repo *repository.UserRepository) *UserService {
	return &UserService{repository: repo}
}
func (s *UserService) Get(ctx context.Context, id int64) (*entity.User, error) {
	return s.repository.FindByID(ctx, id)
}
func (s *UserService) Create(ctx context.Context, runner bun.IDB, name, email string) (*entity.User, error) {
	user := &entity.User{Name: name, Email: email}
	if err := s.repository.Save(ctx, runner, user); err != nil {
		return nil, err
	}
	return user, nil
}
```

## Read controller

```go
// src/controller/user_controller.go
package controller

import (
	"database/sql"
	"errors"
	"example.com/my-app/src/entity"
	"example.com/my-app/src/service"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type UserPath struct {
	ID int64 `path:"id"`
}
type UserController struct{ service *service.UserService }

func (*UserController) Constructor(svc *service.UserService) *UserController {
	return &UserController{service: svc}
}
func (c *UserController) RegisterRoutes(r *api.Registry) {
	r.GET("/users/:id", c.Get)
}
func (c *UserController) Get(ctx spinectx.Ctx, path input.Path[UserPath]) (httpx.Response[*entity.User], error) {
	user, err := c.service.Get(ctx.ExecutionContext().Context(), path.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return httpx.Response[*entity.User]{}, httperr.NotFound("user not found")
	}
	return httpx.Response[*entity.User]{Body: user}, err
}
```

sql.ErrNoRows maps to 404; other ordinary errors map to a sanitized 500.

## App assembly

Connect playground.New through WithValidator in BuildApplication. Register the DB as a Custom factory and the other types by role. Validate success does not prove DB connectivity: constructors run during Run preparation.

```go
// internal/application/application.go
package application

import (
	"example.com/my-app/src/controller"
	"example.com/my-app/src/database"
	"example.com/my-app/src/repository"
	"example.com/my-app/src/service"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(
		constructor.Custom(database.NewDB),
		constructor.Repository(&repository.UserRepository{}),
		constructor.Service(&service.UserService{}),
		constructor.Controller(&controller.UserController{}),
	)
	return app, boot.Options{
		Address:                ":8080",
		HTTP:                   &boot.HTTPOptions{OpenAPI: boot.OpenAPIOptions{Enabled: true}},
		EnableGracefulShutdown: true,
	}, nil
}
```

```go
// main.go
package main

import (
	"example.com/my-app/internal/application"
	"log"
)

func main() {
	app, options, err := application.BuildApplication()
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

## Table and requests

Save the SQL as migrations/001_users.sql and apply it to a DB without the example table. With a new table, expect 200, 404 and 400. Code compilation is separate from verifying an actual DB connection and queries.

```sql
CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);
INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');
```

```sh
mysql -u app_user -p app_db < migrations/001_users.sql
export DATABASE_URL='app_user:password@tcp(127.0.0.1:3306)/app_db?parseTime=true&loc=Local'
gofmt -w main.go src internal
go mod tidy
go build ./...
go run .
#
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/999999
curl -i http://localhost:8080/users/not-a-number
```

## Next steps

[Transactions](/en/learn/tutorial/6-transaction) / [Validation](/en/learn/tutorial/7-error-handling)
