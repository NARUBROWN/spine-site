# 数据库连接

::: info 0.7.5 API
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

此独立项目使用 Bun 查询 MySQL，不要与前面的单文件 main.go 合并。

## 准备

准备 Go 1.26 以上版本和 MySQL，在 example.com/my-app 中创建所示文件。不假定 CLI 自动生成数据库连接或迁移。

```sh
go mod init example.com/my-app
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
go get github.com/uptrace/bun@v1.2.16 github.com/uptrace/bun/dialect/mysqldialect@v1.2.16 github.com/go-sql-driver/mysql@v1.9.3
```

## 数据库工厂

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

NewDB 在 DI 准备阶段检查连接，只返回一个 *bun.DB，初始化 panic 导致准备失败。不会自动调用任意 DI Close。应用所有者负责关闭连接，生产资源管理器不在此例范围内。

## 用户模型

```go
// src/entity/user.go
package entity

type User struct {
	ID    int64  `bun:",pk,autoincrement" json:"id"`
	Name  string `bun:",notnull" json:"name"`
	Email string `bun:",unique,notnull" json:"email"`
}
```

## 仓库与服务

FindByID 使用数据库连接，Save 显式接收 bun.IDB，以便下章传入请求事务。共享服务和仓库接收标准 context.Context，由 HTTP 处理器从 spine.Ctx 中取出。

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

## 查询控制器

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

sql.ErrNoRows 对应 404，其他普通错误对应隐藏内部信息的 500。

## 应用组装

在 BuildApplication 中通过 WithValidator 连接 playground.New。数据库使用 Custom 工厂，其他类型使用角色标记。Validate 成功不代表数据库连接成功；构造函数在 Run 准备阶段执行。

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

## 表与请求

将 SQL 保存为 migrations/001_users.sql，并应用到尚无示例表的数据库。新表的请求结果依次为 200、404、400。编译通过与真实数据库连接、查询验证是两回事。

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

## 下一步

[事务](/zh-Hans/learn/tutorial/6-transaction) / [输入验证](/zh-Hans/learn/tutorial/7-error-handling)
