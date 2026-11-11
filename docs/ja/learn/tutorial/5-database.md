# データベース接続

Bun で MySQL を検索する独立プロジェクトです。前章の単一 main.go には結合しません。

## 準備

Go 1.26 以降と MySQL を用意し、example.com/my-app に示したファイルを作成します。CLI が DB 接続やマイグレーションを生成する前提ではありません。

```sh
go mod init example.com/my-app
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0
go get github.com/uptrace/bun@v1.2.16 github.com/uptrace/bun/dialect/mysqldialect@v1.2.16 github.com/go-sql-driver/mysql@v1.9.3
```

## DB 生成関数

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

NewDB は DI 準備時に接続を確認します。戻り値は *bun.DB 一つで、初期化パニックは準備失敗になります。任意の DI Close は自動実行しません。接続終了はアプリ所有者の責任で、運用向け資源管理はこの例の範囲外です。

## ユーザーモデル

```go
// src/entity/user.go
package entity

type User struct {
	ID    int64  `bun:",pk,autoincrement" json:"id"`
	Name  string `bun:",notnull" json:"name"`
	Email string `bun:",unique,notnull" json:"email"`
}
```

## リポジトリーとサービス

FindByID は DB 接続、Save は明示的な bun.IDB を使い、次章でリクエストのトランザクションを渡します。共有サービスとリポジトリーは標準 context.Context を受け取り、HTTP ハンドラーが spine.Ctx から取り出します。

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

## 検索コントローラー

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

sql.ErrNoRows は 404、ほかの通常エラーは詳細を隠した 500 です。

## アプリの組み立て

BuildApplication で playground.New を WithValidator に接続します。DB は Custom 関数、ほかは役割の目印で登録します。Validate 成功は DB 接続成功を意味しません。生成子は Run の準備で実行します。

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

## テーブルとリクエスト

SQL を migrations/001_users.sql に保存し、例のテーブルがない DB に適用します。新規テーブルでの結果は 200、404、400 です。コンパイルと実 DB 接続やクエリーの検証は別です。

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

## 次のステップ

[トランザクション](/ja/learn/tutorial/6-transaction) / [入力検証](/ja/learn/tutorial/7-error-handling)
