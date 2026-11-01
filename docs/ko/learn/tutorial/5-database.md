# 데이터베이스 연결

Bun을 사용하여 데이터베이스에 연결하기.


## CLI 프로젝트 준비

[CLI 설치와 첫 앱](/ko/learn/getting-started/first-app), [프로젝트 구조](/ko/learn/tutorial/1-project-structure)의 `example.com/my-app`에서 이어갑니다. 사용자 리소스가 아직 없다면 다음 계획을 검토하고 적용합니다.

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

텍스트 미리보기에서 생성 파일을 확인한 뒤 일반 생성 명령을 실행합니다. 이미 만든 리소스라면 다시 생성하지 않습니다.

CLI는 사용자 리소스 골격과 등록만 생성합니다. Bun·DB 연결·모델·마이그레이션 생성기는 지원하지 않으므로 아래 파일과 의존성은 직접 추가합니다. 생성된 `main.go`는 유지합니다.

아래 저장소 코드는 `src/user/user_repository.go`를 확장합니다. 생성된 서비스와 컨트롤러는 기본적으로 ID를 반환하는 GET 골격이므로 실제 조회·CRUD를 제공하려면 서비스와 핸들러도 직접 연결해야 합니다.


## Bun이란?

[Bun](https://bun.uptrace.dev/)은 Go를 위한 경량 ORM입니다.

- SQL 친화적 — 쿼리가 직관적
- 타입 안전 — 컴파일 타임 검증
- 빠른 성능 — 리플렉션 최소화

Spine은 특정 ORM을 강제하지 않지만, Bun과의 조합을 권장합니다.


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

`NewDB`는 DI가 실제 앱 실행 중 생성할 때 연결을 확인합니다. 생성자는 반환값 하나만 지원하므로 `(*bun.DB, error)`를 반환하는 함수를 등록하지 않습니다. `BuildApplication`에는 생성자만 등록하고 직접 연결하지 않아 정적 검사와 생성된 검증 테스트가 DB를 요구하지 않게 합니다.

### Spine에 등록

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

## PostgreSQL 연결

PostgreSQL 코드는 MySQL용 `src/database/db.go`의 대안입니다. 둘 중 하나만 사용하고 DSN과 마이그레이션 SQL도 선택한 DB에 맞게 변경하세요. `sql.Open` 자체는 실제 연결을 확인하지 않습니다.

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


## 환경 변수 사용

하드코딩 대신 환경 변수를 사용하세요.

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


## Entity 정의

데이터베이스 테이블과 매핑되는 구조체입니다.

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
| `pk` | Primary Key |
| `autoincrement` | 자동 증가 |
| `notnull` | NOT NULL |
| `unique` | UNIQUE 제약 |
| `nullzero` | Go 제로값을 NULL로 처리 |
| `default:value` | 기본값 |

---

## Repository 작성

### bun.IDB 인터페이스 사용

`bun.IDB`를 사용하면 `*bun.DB`와 `bun.Tx` 모두 수용할 수 있습니다.

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

기존 `src/user/user_controller.go`를 아래 코드로 교체하고 `src/user/user_read.go`를 추가합니다. 생성된 `GET /user/:id` 경로와 생성자 등록은 유지합니다. 저장된 사용자를 반환하며, 없는 ID는 HTTP 404입니다. 생성된 ID 반환 골격과 실제 DB 조회를 구분하기 위해 이 단계를 완료하세요.

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

아래 SQL 파일을 `cmd/migrate/migrations`에 만듭니다. 마이그레이션은 별도 실행 파일로 직접 추가하며 `spine migrate` 명령은 없습니다. DB를 준비한 뒤 의도적으로 실행하세요.

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

## Spine과 통합

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

## 쿼리 예제

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

조인 예제의 `Orders` 관계는 별도 엔티티와 Bun relation 태그를 정의해야 동작합니다. 위의 기본 User 모델에는 포함되지 않습니다.


## 핵심 정리

| 개념 | 설명 |
|------|------|
| **bun.IDB** | DB와 Tx 모두 수용하는 인터페이스 |
| **Entity** | 테이블과 매핑되는 Go 구조체 |
| **Repository** | 데이터 접근 계층 |
| **Migration** | SQL 파일로 스키마 관리 |


## 검증

정적 계약과 로컬 Go 검증을 실행합니다. `verify` 성공은 실제 DB 연결·마이그레이션·CRUD 검증을 뜻하지 않습니다. DSN과 테스트 DB를 준비해 연결과 쿼리를 별도로 확인하세요.

```sh
go mod tidy
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

## 다음 단계

- [튜토리얼: 트랜잭션](/ko/learn/tutorial/6-transaction) — 트랜잭션 인터셉터
- [튜토리얼: 에러 처리](/ko/learn/tutorial/7-error-handling) — httperr 사용법