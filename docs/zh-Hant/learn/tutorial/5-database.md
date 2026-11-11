# 資料庫連線

此獨立專案使用 Bun 查詢 MySQL，請勿與前面的單檔 main.go 合併。

## 準備

準備 Go 1.26 以上版本與 MySQL，在 example.com/my-app 建立所示檔案。不假定 CLI 自動產生資料庫連線或遷移。

```sh
go mod init example.com/my-app
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0
go get github.com/uptrace/bun@v1.2.16 github.com/uptrace/bun/dialect/mysqldialect@v1.2.16 github.com/go-sql-driver/mysql@v1.9.3
```

## 資料庫工廠

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

NewDB 在 DI 準備階段檢查連線，只回傳一個 *bun.DB，初始化 panic 導致準備失敗。不會自動呼叫任意 DI Close。應用擁有者負責關閉連線，正式環境資源管理器不在此例範圍內。

## 使用者模型

```go
// src/entity/user.go
package entity

type User struct {
	ID    int64  `bun:",pk,autoincrement" json:"id"`
	Name  string `bun:",notnull" json:"name"`
	Email string `bun:",unique,notnull" json:"email"`
}
```

## 儲存庫與服務

FindByID 使用資料庫連線，Save 明確接收 bun.IDB，以便下章傳入請求交易。共享服務與儲存庫接收標準 context.Context，由 HTTP 處理器從 spine.Ctx 取出。

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

## 查詢控制器

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
	r.GET("/users/:id", func(ctx spinectx.Ctx, path input.Path[UserPath]) (httpx.Response[*entity.User], error) {
		user, err := c.service.Get(ctx.ExecutionContext().Context(), path.ID)
		if errors.Is(err, sql.ErrNoRows) {
			return httpx.Response[*entity.User]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[*entity.User]{Body: user}, err
	})
}
```

sql.ErrNoRows 對應 404，其他一般錯誤對應隱藏內部資訊的 500。

## 應用組裝

在 BuildApplication 透過 WithValidator 連接 playground.New。資料庫使用 Custom 工廠，其他型別使用角色標記。Validate 成功不代表資料庫連線成功；建構函式在 Run 準備階段執行。

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

## 資料表與請求

將 SQL 儲存為 migrations/001_users.sql，並套用至尚無範例資料表的資料庫。新資料表的請求結果依序為 200、404、400。編譯通過與真實資料庫連線、查詢驗證是兩回事。

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

[交易](/zh-Hant/learn/tutorial/6-transaction) / [輸入驗證](/zh-Hant/learn/tutorial/7-error-handling)
