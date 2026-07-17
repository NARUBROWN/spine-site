# データベース接続

Bunを使用してデータベースに接続する。


## Bunとは？

[Bun](https://bun.uptrace.dev/)はGoのための軽量ORMです。

- SQLフレンドリー — クエリが直感的
- タイプセーフ — コンパイル時の検証
- 高速なパフォーマンス — リフレクションを最小化

Spineは特定のORMを強制しませんが、Bunとの組み合わせを推奨します。


## インストール


```bash
# Bun コア
go get github.com/uptrace/bun

# MySQL ドライバー + 方言
go get github.com/uptrace/bun/dialect/mysqldialect
go get github.com/go-sql-driver/mysql

# PostgreSQLを使用する場合
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```


## データベース接続

### 接続関数の作成


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
    // MySQL 接続
    sqldb, err := sql.Open("mysql", 
        "user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local",
    )
    if err != nil {
        panic(err)
    }
    
    // 接続確認
    if err := sqldb.Ping(); err != nil {
        panic(err)
    }
    
    // Bun DB 作成
    db := bun.NewDB(sqldb, mysqldialect.New())
    
    return db
}
```

### Spineに登録


```go
// main.go
func main() {
    app := spine.New()
    
    app.Constructor(
        NewDB,  // *bun.DB を作成
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

## PostgreSQL 接続


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


## 環境変数の使用

ハードコーディングの代わりに環境変数を使用してください。


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


## Entityの定義

データベースのテーブルとマッピングされる構造体です。


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

### Bun タグ

| タグ | 説明 |
|------|------|
| `pk` | プライマリーキー |
| `autoincrement` | 自動インクリメント |
| `notnull` | NOT NULL |
| `unique` | UNIQUE 制約 |
| `nullzero` | Goのゼロ値をNULLとして処理 |
| `default:value` | デフォルト値 |

---

## Repositoryの作成

### bun.IDB インターフェースの使用

`bun.IDB`を使用すると、`*bun.DB` と `*bun.Tx` の両方を受け入れることができます。


```go
// repository/user_repository.go
package repository

import (
    "context"
    "myapp/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // *bun.DB または *bun.Tx の両方が可能
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 照会


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

### 作成


```go
func (r *UserRepository) Save(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewInsert().
        Model(user).
        Exec(ctx)
    
    return err
}
```

### 修正


```go
func (r *UserRepository) Update(ctx context.Context, user *entity.User) error {
    _, err := r.db.NewUpdate().
        Model(user).
        WherePK().
        Exec(ctx)
    
    return err
}
```

### 削除


```go
func (r *UserRepository) Delete(ctx context.Context, id int) error {
    _, err := r.db.NewDelete().
        Model((*entity.User)(nil)).
        Where("id = ?", id).
        Exec(ctx)
    
    return err
}
```


## マイグレーション

### マイグレーションファイルの作成


```
sql
-- migrations/001_create_users.up.sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```


```
sql
-- migrations/001_create_users.down.sql
DROP TABLE IF EXISTS users;
```

### マイグレーション実行コード


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
    // CLI フラグ
    migrateOnly := flag.Bool("migrate", false, "Run migrations and exit")
    flag.Parse()

    db := NewDB()

    // マイグレーションのみ実行
    if *migrateOnly {
        if err := runMigrations(context.Background(), db); err != nil {
            fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
            os.Exit(1)
        }
        fmt.Println("Migrations applied successfully.")
        return
    }

    // サーバー開始
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

    // マイグレーションテーブル作成
    if err := migrator.Init(ctx); err != nil {
        return err
    }

    // マイグレーション実行
    if _, err := migrator.Migrate(ctx); err != nil {
        return err
    }
    
    return nil
}
```

### 実行


```bash
# マイグレーション実行
go run . -migrate

# サーバー実行
go run .
```


## 全体構造

```
myapp/
├── main.go
├── db.go                    # DB 接続
├── entity/
│   └── user.go              # テーブルマッピング
├── repository/
│   └── user_repository.go   # データアクセス
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

## Spineとの統合


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
// bun.IDBを受け取るので *bun.DB が自動注入される
func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

## クエリの例

### 条件付き照会


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

### ソートとページング


```go
// ORDER BY created_at DESC LIMIT 10 OFFSET 20
err := r.db.NewSelect().
    Model(&users).
    Order("created_at DESC").
    Limit(10).
    Offset(20).
    Scan(ctx)
```

### 集計


```go
// SELECT COUNT(*) FROM users
count, err := r.db.NewSelect().
    Model((*entity.User)(nil)).
    Count(ctx)
```

### ジョイン


```go
// SELECT * FROM users JOIN orders ON users.id = orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```


## 要点のまとめ

| 概念 | 説明 |
|------|------|
| **bun.IDB** | DBとTxの両方を受け入れるインターフェース |
| **Entity** | テーブルとマッピングされるGoの構造体 |
| **Repository** | データアクセスレイヤー |
| **Migration** | SQLファイルでスキーマを管理 |


## 次のステップ

- [チュートリアル: トランザクション](/ja/learn/tutorial/6-transaction) — トランザクションインターセプター
- [チュートリアル: エラー処理](/ja/learn/tutorial/7-error-handling) — httperrの使い方