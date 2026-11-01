# データベース接続

Bunを使用してデータベースに接続する。


## CLIプロジェクトの準備

[最初のアプリ](/ja/learn/getting-started/first-app)と[プロジェクト構造](/ja/learn/tutorial/1-project-structure)の `example.com/my-app` を使用します。ユーザーリソースがまだなければ、生成計画を確認して適用します。

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

テキストのプレビューで生成ファイルを確認してから通常の生成コマンドを実行します。生成済みのリソースは再生成しません。

CLIが生成するのはリソースの骨格と登録です。Bun・DB接続・モデル・マイグレーションの生成機能はないため、以下のファイルと依存関係は手動で追加します。生成された `main.go` は維持します。

以下のRepositoryコードで `src/user/user_repository.go` を拡張します。生成済みのServiceとControllerはIDを返すGETの骨格なので、DB照会やCRUDを提供するには手動で接続してください。


## Bunとは？

[Bun](https://bun.uptrace.dev/)はGoのための軽量ORMです。

- SQLフレンドリー — クエリが直感的
- タイプセーフ — コンパイル時の検証
- 高速なパフォーマンス — リフレクションを最小化

Spineは特定のORMを強制しませんが、Bunとの組み合わせを推奨します。


## インストール


```bash
# Bun コア
go get github.com/uptrace/bun@v1.2.16

# MySQL ドライバー + 方言
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# PostgreSQLを使用する場合
# go get github.com/uptrace/bun/dialect/pgdialect
# go get github.com/jackc/pgx/v5/stdlib
```


## データベース接続

### 接続関数の作成


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

`NewDB` はアプリ実行時にDIが生成するときに接続を確認します。コンストラクタの戻り値は1つだけです。`BuildApplication` では接続せず生成関数だけを登録し、静的検証と生成されたテストがDBを必要としないようにします。

### Spineに登録


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

## PostgreSQL 接続


PostgreSQLのコードはMySQL用 `src/database/db.go` の代替です。どちらか一方を使用し、DSNとマイグレーションSQLもDBに合わせます。`sql.Open` だけでは実際の接続は確認できません。

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


## 環境変数の使用

ハードコーディングの代わりに環境変数を使用してください。


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


## Entityの定義

データベースのテーブルとマッピングされる構造体です。


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

`bun.IDB`を使用すると、`*bun.DB` と `bun.Tx` の両方を受け入れることができます。


```go
// src/user/user_repository.go
package user

import (
    "context"
    "example.com/my-app/src/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // *bun.DB または bun.Tx の両方が可能
}

func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 照会


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


## 生成されたGETをDB照会に接続

既存の `src/user/user_controller.go` を以下に置き換え、`src/user/user_read.go` を追加します。生成済みの `GET /user/:id` とコンストラクタ登録は維持します。保存済みユーザーを返し、IDがなければHTTP 404です。この手順でIDを返すだけの骨格を実際のDB照会に接続します。

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

## マイグレーション

### マイグレーションファイルの作成


SQLファイルを `cmd/migrate/migrations` に配置します。マイグレーションは別の実行ファイルとして追加します。`spine migrate` コマンドはありません。DBを準備してから明示的に実行してください。

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

### マイグレーション実行コード


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

### 実行


```bash
# マイグレーション実行
go run ./cmd/migrate

# サーバー実行
spine dev
```


## 全体構造

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

## Spineとの統合


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

結合例には `Orders` の関連フィールド、Entity、Bunの関連タグが必要です。基本Userモデルには含まれていません。


## 要点のまとめ

| 概念 | 説明 |
|------|------|
| **bun.IDB** | DBとTxの両方を受け入れるインターフェース |
| **Entity** | テーブルとマッピングされるGoの構造体 |
| **Repository** | データアクセスレイヤー |
| **Migration** | SQLファイルでスキーマを管理 |


## 検証

静的契約とローカルGo検証を実行します。`verify` の成功は実際のDB接続・マイグレーション・CRUDの確認を意味しません。DSNとテストDBを用意し、接続とクエリを別途検証してください。

```sh
go mod tidy
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

## 次のステップ

- [チュートリアル: トランザクション](/ja/learn/tutorial/6-transaction) — トランザクションインターセプター
- [チュートリアル: エラー処理](/ja/learn/tutorial/7-error-handling) — httperrの使い方