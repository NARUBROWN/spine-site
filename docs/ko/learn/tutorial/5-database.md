# 데이터베이스 연결

::: warning v0.7.0 미리보기 입력 API 전환
이 페이지의 기존 API 설명과 예제는 안정 버전 `v0.6.5` 기준입니다. `v0.7.0-preview.1`부터 출처별 Path, Query, Header DTO를 지원하며 `query.Values`, `header.Values`와 해당 생성/조회 API, `query.Pagination`, `path.Int`, `path.String`, `path.Boolean`은 Deprecated입니다.

새 DTO 방식은 `v0.6.5`에 그대로 적용할 수 없습니다. 미리보기에서도 한 핸들러 안에서 새 DTO와 Deprecated 입력을 혼용하면 부팅 시 거부합니다. 기존 본문 DTO와 context는 계속 함께 사용할 수 있습니다.

적용 버전과 전환 예제는 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview), 명세 옵션은 [런타임 OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

Bun으로 MySQL에 연결하고, 생성된 `GET /user/:id`가 데이터베이스에서 사용자를 조회하도록 확장합니다. 테이블을 만드는 마이그레이션과 저장소의 기본 쿼리도 함께 작성합니다.

이 페이지의 기능별 `src/user` 예제는 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)에서 `--layout legacy`로 생성한 `my-app`을 기준으로 합니다. CLI `v0.4.2`의 기본 `new`는 역할별 `layered-v1` 구조를 생성합니다. 두 레이아웃 모두 Spine `v0.6.5`와 Echo 플랫폼 `v0.1.0`을 사용합니다.

## CLI 프로젝트 준비

[CLI 설치와 첫 앱](/ko/learn/tutorial/1-project-structure)과 [프로젝트 구조](/ko/learn/tutorial/1-project-structure)의 `example.com/my-app`에서 이어갑니다. 접속할 MySQL 데이터베이스와 테이블을 만들 권한이 있는 계정이 필요합니다. 명령은 프로젝트 루트에서 실행합니다.

사용자 리소스가 아직 없다면 생성할 파일을 확인한 뒤 적용합니다. 이미 만든 리소스는 다시 생성하지 않습니다.

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

CLI는 사용자 리소스의 기본 파일과 등록 코드를 생성합니다. Bun 의존성, 데이터베이스 연결, 모델, 마이그레이션은 아래 단계에서 직접 추가합니다. 생성된 `main.go`는 유지합니다.

생성된 GET 핸들러는 요청의 ID만 반환합니다. 저장소를 작성한 뒤 서비스와 컨트롤러를 연결해야 실제 조회가 가능합니다. 저장, 수정, 삭제 메서드는 저장소에만 추가하며 이 문서에서는 해당 HTTP 경로를 구현하지 않습니다.

## Bun으로 쿼리 작성

이 예제는 [Bun](https://bun.uptrace.dev/)으로 SQL 쿼리를 작성하고 결과를 Go 구조체에 매핑합니다. Spine은 특정 ORM을 요구하지 않습니다.

## 설치

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


## 데이터베이스 연결

### 연결 함수 작성

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

`NewDB`는 앱 실행 중 의존성 주입(DI)으로 호출될 때 연결을 확인합니다. `DATABASE_URL`이 없거나 연결 확인에 실패하면 앱 실행을 중단합니다.

Spine 생성자는 반환값 하나만 지원하므로 `(*bun.DB, error)`를 반환하는 함수를 등록하지 않습니다. `BuildApplication`에는 생성자만 등록합니다. 이 함수에서 데이터베이스에 직접 연결하지 않아야 정적 검사와 생성된 검증 테스트를 DB 없이 실행할 수 있습니다.

### Spine에 등록

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

## PostgreSQL 연결

PostgreSQL을 사용한다면 다음 코드로 MySQL용 `src/database/db.go`를 교체합니다. 두 구현 중 하나만 사용하고, 연결 문자열(DSN)과 마이그레이션 SQL도 선택한 DB에 맞게 변경하세요. 이 PostgreSQL 예제의 `sql.Open`은 실제 연결을 확인하지 않으므로 첫 쿼리에서 연결 오류가 발생할 수 있습니다.

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


## 연결 문자열 설정

위의 `NewDB`는 환경 변수 `DATABASE_URL`에서 연결 문자열을 읽습니다.

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


## 사용자 모델 정의

`src/entity/user.go`에 `users` 테이블에 매핑할 구조체를 추가합니다.

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

### Bun 태그

| 태그 | 설명 |
|------|------|
| `pk` | 기본 키 |
| `autoincrement` | 자동 증가 |
| `notnull` | NOT NULL |
| `unique` | UNIQUE 제약 |
| `nullzero` | Go 타입의 기본값을 NULL로 처리 |
| `default:value` | 기본값 |

## 저장소 작성

### bun.IDB 인터페이스 사용

생성된 `src/user/user_repository.go`를 다음 코드로 교체하고, 이어지는 조회, 저장, 수정, 삭제 메서드를 같은 파일에 추가합니다. `bun.IDB`는 일반 연결인 `*bun.DB`와 트랜잭션인 `bun.Tx`가 모두 구현하는 인터페이스입니다.

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

### 조회

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

### 생성

```go
func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)

    return err
}
```

### 수정

```go
func (r *UserRepository) Update(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewUpdate().
        Model(user).
        WherePK().
        Exec(ctx)

    return err
}
```

### 삭제

```go
func (r *UserRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().
        Model((*entity.User)(nil)).
        Where("id = ?", id).
        Exec(ctx)

    return err
}
```


## 생성된 GET을 DB 조회에 연결

기존 `src/user/user_controller.go`를 아래 코드로 교체하고 `src/user/user_read.go`를 추가합니다. 생성된 `GET /user/:id` 경로와 생성자 등록은 유지합니다.

이제 GET은 저장된 사용자를 반환합니다. ID에 해당하는 행이 없으면 HTTP 404를, 그 밖의 데이터베이스 오류가 발생하면 HTTP 500을 반환합니다.

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

## 마이그레이션

### 마이그레이션 파일 작성

아래 SQL 파일을 `cmd/migrate/migrations`에 만듭니다. 마이그레이션은 별도 Go 프로그램으로 실행하며 `spine migrate` 명령은 없습니다. 다음 실행 단계는 기존 데이터베이스에 `users` 테이블을 추가하므로, 앞에서 설정한 `DATABASE_URL`이 예제용 DB를 가리키는지 확인하세요.

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

### 마이그레이션 실행 코드

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

### 실행

`DATABASE_URL`을 설정한 터미널에서 실행합니다. 마이그레이션이 성공하면 `Migrations applied successfully.`가 출력되고, 이후 서버를 실행할 수 있습니다.

```bash
# 마이그레이션 실행
go run ./cmd/migrate

# 서버 실행
spine dev
```


## 전체 구조

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

## 앱 등록 확인

추가한 파일을 사용할 수 있도록 앱의 등록 상태를 확인합니다. `BuildApplication()`은 앞에서 작성한 내용과 같으며, 이미 적용했다면 다시 교체할 필요가 없습니다. 저장소 생성자는 DI에서 구체 타입인 `*bun.DB`를 받습니다.

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
// DI는 구체 타입 *bun.DB를 받고 내부 쿼리 필드는 bun.IDB로 유지합니다.
func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

## 쿼리 예제

다음 코드는 저장소 메서드를 확장할 때 참고할 쿼리 구문입니다. `users`와 `ctx`는 각 메서드에서 선언해야 합니다. `age`, `status` 조건을 사용하려면 해당 열을 모델과 테이블에 먼저 추가하세요.

### 조건 조회

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

### 정렬 및 페이징

```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### 집계

```go
// SELECT COUNT(*) FROM users
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

### 조인

```go
// SELECT * FROM users JOIN orders ON users.id = orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

조인 예제의 `Orders` 관계는 별도 엔티티와 Bun 관계 태그를 정의해야 동작합니다. 위의 기본 `User` 모델에는 포함되지 않습니다.

## 검증

정적 계약과 로컬 Go 검사를 실행합니다. `verify`는 실제 DB 연결, 마이그레이션, 쿼리를 검증하지 않습니다.

```sh
go mod tidy
go mod download all
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

마이그레이션 후 `spine dev`로 앱을 실행하고 `GET /user/:id`를 요청합니다. 빈 테이블에서는 해당 ID가 없어 HTTP 404가 반환됩니다. 사용자를 저장한 뒤 조회하려면 다음 트랜잭션 튜토리얼의 POST 예제를 적용하세요.

## 다음 단계

- [튜토리얼: 트랜잭션](/ko/learn/tutorial/6-transaction): 요청 단위로 사용자를 저장하고 롤백 확인
- [튜토리얼: 오류 처리](/ko/learn/tutorial/7-error-handling): `httperr`로 HTTP 오류 반환
