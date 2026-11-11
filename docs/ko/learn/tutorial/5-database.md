# 데이터베이스 연결

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

Bun으로 MySQL을 조회하는 독립 프로젝트입니다. 이전 단일 main.go에 합치지 않습니다.

## 프로젝트 준비

Go 1.26 이상과 MySQL이 필요합니다. example.com/my-app 아래 표시된 파일을 직접 만듭니다. CLI가 DB 연결이나 마이그레이션을 생성한다고 가정하지 않습니다.

```sh
go mod init example.com/my-app
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
go get github.com/uptrace/bun@v1.2.16 github.com/uptrace/bun/dialect/mysqldialect@v1.2.16 github.com/go-sql-driver/mysql@v1.9.3
```

## DB 생성 함수

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

NewDB는 DI 준비 때 연결을 확인합니다. 반환값은 *bun.DB 하나이며 초기화 패닉은 준비 실패로 처리됩니다. 임의 DI Close는 자동 호출하지 않습니다. 연결 종료는 앱 소유자 책임이며 운영용 자원 관리자는 이 예제 범위 밖입니다.

## 사용자 모델

```go
// src/entity/user.go
package entity

type User struct {
	ID    int64  `bun:",pk,autoincrement" json:"id"`
	Name  string `bun:",notnull" json:"name"`
	Email string `bun:",unique,notnull" json:"email"`
}
```

## 저장소와 서비스

FindByID는 DB 연결을, Save는 명시적인 bun.IDB 인자를 사용합니다. 다음 장에서 요청 트랜잭션을 전달합니다. 공유 서비스와 저장소는 표준 context.Context를 받고, HTTP 핸들러가 spine.Ctx에서 표준 컨텍스트를 꺼냅니다.

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

## 조회 컨트롤러

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

sql.ErrNoRows는 404, 다른 일반 오류는 내부 원문을 숨긴 500입니다.

## 앱 조립

BuildApplication에서 playground.New와 WithValidator를 연결합니다. DB는 Custom 함수로, 나머지는 역할 표식으로 등록합니다. Validate 성공은 DB 연결 성공을 뜻하지 않으며 Run의 준비 단계에서 생성자를 실행합니다.

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

## 테이블과 요청

SQL을 migrations/001_users.sql로 저장하고 예제 테이블이 없는 DB에 적용합니다. 새 테이블 기준 요청 결과는 200, 404, 400입니다. 코드 컴파일과 실제 DB 접속 및 쿼리 검증은 별개입니다.

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
# 다른 터미널
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/999999
curl -i http://localhost:8080/users/not-a-number
```

## 다음 단계

[트랜잭션](/ko/learn/tutorial/6-transaction) / [입력 검증](/ko/learn/tutorial/7-error-handling)
