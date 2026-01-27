# 데이터베이스 연결

Bun을 사용하여 데이터베이스에 연결하기.


## Bun이란?

[Bun](https://bun.uptrace.dev/)은 Go를 위한 경량 ORM입니다.

- SQL 친화적 — 쿼리가 직관적
- 타입 안전 — 컴파일 타임 검증
- 빠른 성능 — 리플렉션 최소화

Spine은 특정 ORM을 강제하지 않지만, Bun과의 조합을 권장합니다.


## 설치

```bash
# Bun 코어
go get github.com/uptrace/bun

# MySQL 드라이버 + 방언
go get github.com/uptrace/bun/dialect/mysqldialect
go get github.com/go-sql-driver/mysql

# PostgreSQL을 사용한다면
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```


## 데이터베이스 연결

### 연결 함수 작성

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
    // MySQL 연결
    sqldb, err := sql.Open("mysql", 
        "user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local",
    )
    if err != nil {
        panic(err)
    }
    
    // 연결 확인
    if err := sqldb.Ping(); err != nil {
        panic(err)
    }
    
    // Bun DB 생성
    db := bun.NewDB(sqldb, mysqldialect.New())
    
    return db
}
```

### Spine에 등록

```go
// main.go
func main() {
    app := spine.New()
    
    app.Constructor(
        NewDB,  // *bun.DB 생성
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

## PostgreSQL 연결

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


## 환경 변수 사용

하드코딩 대신 환경 변수를 사용하세요.

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


## Entity 정의

데이터베이스 테이블과 매핑되는 구조체입니다.

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

`bun.IDB`를 사용하면 `*bun.DB`와 `*bun.Tx` 모두 수용할 수 있습니다.

```go
// repository/user_repository.go
package repository

import (
    "context"
    "myapp/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // *bun.DB 또는 *bun.Tx 모두 가능
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 조회

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


## 마이그레이션

### 마이그레이션 파일 작성

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

### 마이그레이션 실행 코드

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
    // CLI 플래그
    migrateOnly := flag.Bool("migrate", false, "Run migrations and exit")
    flag.Parse()

    db := NewDB()

    // 마이그레이션만 실행
    if *migrateOnly {
        if err := runMigrations(context.Background(), db); err != nil {
            fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
            os.Exit(1)
        }
        fmt.Println("Migrations applied successfully.")
        return
    }

    // 서버 시작
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

    // 마이그레이션 테이블 생성
    if err := migrator.Init(ctx); err != nil {
        return err
    }

    // 마이그레이션 실행
    if _, err := migrator.Migrate(ctx); err != nil {
        return err
    }
    
    return nil
}
```

### 실행

```bash
# 마이그레이션 실행
go run . -migrate

# 서버 실행
go run .
```


## 전체 구조

```
myapp/
├── main.go
├── db.go                    # DB 연결
├── entity/
│   └── user.go              # 테이블 매핑
├── repository/
│   └── user_repository.go   # 데이터 접근
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

## Spine과 통합

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
// bun.IDB를 받으므로 *bun.DB가 자동 주입됨
func NewUserRepository(db bun.IDB) *UserRepository {
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


## 핵심 정리

| 개념 | 설명 |
|------|------|
| **bun.IDB** | DB와 Tx 모두 수용하는 인터페이스 |
| **Entity** | 테이블과 매핑되는 Go 구조체 |
| **Repository** | 데이터 접근 계층 |
| **Migration** | SQL 파일로 스키마 관리 |


## 다음 단계

- [튜토리얼: 트랜잭션](/ko/learn/tutorial/6-transaction) — 트랜잭션 인터셉터
- [튜토리얼: 에러 처리](/ko/learn/tutorial/7-error-handling) — httperr 사용법