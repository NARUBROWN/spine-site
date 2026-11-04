# データベース接続

::: warning v0.7.0 Preview 入力 API の移行
このページの既存 API の説明と例は安定版 `v0.6.5` を対象としています。`v0.7.0-preview.1` から入力元別の Path、Query、Header DTO を利用できます。`query.Values`、`header.Values` とその生成および取得 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` は Deprecated です。

新しい DTO 方式は `v0.6.5` にそのまま適用できません。Preview でも、同じハンドラーで新しい DTO と Deprecated な入力を混在させると起動時に拒否されます。既存のボディ DTO とコンテキストは、どちらの方式とも併用できます。

対象バージョンと移行例は [Preview ハンドラー入力の移行](/ja/learn/migration/v0.7.0-preview)、仕様の設定は [ランタイム OpenAPI](/ja/reference/api/openapi)を参照してください。
:::

BunでMySQLに接続し、生成された `GET /user/:id` を拡張してデータベースからユーザーを取得します。テーブルを作成するマイグレーションと、リポジトリの基本的なクエリも作成します。

このページの機能別 `src/user` の例は、[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で `--layout legacy` を指定して作成した `my-app` を使用します。CLI `v0.4.2` の標準レイアウトは役割別の `layered-v1` です。どちらも Spine `v0.6.5` と Echo プラットフォーム `v0.1.0` を使用します。

## CLIプロジェクトの準備

[CLIのインストールと最初のアプリ](/ja/learn/tutorial/1-project-structure)と[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で作成した `example.com/my-app` の続きです。接続先のMySQLデータベースと、テーブルを作成する権限を持つアカウントが必要です。コマンドはプロジェクトルートで実行します。

ユーザーリソースがまだない場合は、生成するファイルを確認してから適用します。すでに作成したリソースは再生成しません。

```sh
spine generate resource user --dry-run
```

```sh
spine generate resource user
```

CLIはユーザーリソースの基本ファイルと登録コードを生成します。Bunの依存関係、データベース接続、モデル、マイグレーションは、以下の手順で手動で追加します。生成された `main.go` は維持します。

生成されたGETハンドラーは、リクエストのIDだけを返します。実際にデータを取得するには、リポジトリを作成した後、サービスとコントローラーを接続する必要があります。保存、更新、削除のメソッドはリポジトリにのみ追加し、このページでは対応するHTTPルートを実装しません。

## Bunによるクエリの作成

この例では、[Bun](https://bun.uptrace.dev/)でSQLクエリを作成し、結果をGoの構造体にマッピングします。Spineは特定のORMを必須としません。

## インストール

```bash
# Bun コア
go get github.com/uptrace/bun@v1.2.16

# MySQL ドライバー + 方言
go get github.com/uptrace/bun/dialect/mysqldialect@v1.2.16
go get github.com/go-sql-driver/mysql@v1.9.3

# PostgreSQL を使用する場合
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

`NewDB` は、アプリの実行中に依存性注入(DI)によって呼び出されると、接続を確認します。`DATABASE_URL` が設定されていない場合や、接続の確認に失敗した場合は、アプリの実行を中止します。

Spineのコンストラクタは戻り値を1つだけサポートするため、`(*bun.DB, error)` を返す関数は登録しません。`BuildApplication` にはコンストラクタだけを登録します。この関数からデータベースに直接接続しないことで、静的検査と生成された検証テストをDBなしで実行できます。

### Spineへの登録

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

## PostgreSQL接続

PostgreSQLを使用する場合は、MySQL用の `src/database/db.go` を次のコードに置き換えます。2つの実装のうち一方だけを使用し、接続文字列(DSN)とマイグレーションのSQLも、選択したDBに合わせて変更してください。このPostgreSQLの例の `sql.Open` は実際の接続を確認しないため、最初のクエリで接続エラーが発生することがあります。

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


## 接続文字列の設定

上の `NewDB` は、環境変数 `DATABASE_URL` から接続文字列を読み取ります。

```go
// src/database/db.go の NewDB 内から抜粋
dsn := os.Getenv("DATABASE_URL")
if dsn == "" {
    panic("DATABASE_URL is required")
}
```

```bash
export DATABASE_URL="user:password@tcp(localhost:3306)/mydb?parseTime=true&loc=Local"
spine dev
```


## ユーザーモデルの定義

`src/entity/user.go` に、`users` テーブルにマッピングする構造体を追加します。

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

### Bunタグ

| タグ | 説明 |
|------|------|
| `pk` | 主キー |
| `autoincrement` | 自動増分 |
| `notnull` | NOT NULL |
| `unique` | UNIQUE制約 |
| `nullzero` | Goの型のゼロ値をNULLとして扱う |
| `default:value` | デフォルト値 |

## リポジトリの作成

### bun.IDBインターフェースの使用

生成された `src/user/user_repository.go` を次のコードに置き換え、続く取得、保存、更新、削除のメソッドを同じファイルに追加します。`bun.IDB` は、通常の接続である `*bun.DB` とトランザクションである `bun.Tx` の両方が実装するインターフェースです。

```go
// src/user/user_repository.go
package user

import (
    "context"
    "example.com/my-app/src/entity"

    "github.com/uptrace/bun"
)

type UserRepository struct {
    db bun.IDB  // *bun.DB と bun.Tx のどちらも使用可能
}

func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

### 取得

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

### 更新

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


## 生成されたGETをDBからの取得に接続

既存の `src/user/user_controller.go` を以下のコードに置き換え、`src/user/user_read.go` を追加します。生成された `GET /user/:id` ルートとコンストラクタの登録は維持します。

これでGETは保存されたユーザーを返します。IDに対応する行がない場合はHTTP 404を、それ以外のデータベースエラーが発生した場合はHTTP 500を返します。

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

以下のSQLファイルを `cmd/migrate/migrations` に作成します。マイグレーションは別のGoプログラムとして実行します。`spine migrate` コマンドはありません。次の実行手順では既存のデータベースに `users` テーブルを追加するため、先ほど設定した `DATABASE_URL` が例で使用するDBを指していることを確認してください。

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

### マイグレーションの実行コード

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

`DATABASE_URL` を設定したターミナルで実行します。マイグレーションに成功すると `Migrations applied successfully.` と表示され、その後サーバーを起動できます。

```bash
# マイグレーションを実行
go run ./cmd/migrate

# サーバーを起動
spine dev
```


## 全体の構造

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

## アプリの登録状態の確認

追加したファイルを使用できるように、アプリの登録状態を確認します。`BuildApplication()` は先ほど作成した内容と同じです。すでに適用している場合は、再び置き換える必要はありません。リポジトリのコンストラクタは、DIから具象型の `*bun.DB` を受け取ります。

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
// DI では具象型 *bun.DB を受け取り、内部のクエリフィールドは bun.IDB のまま保持します。
func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```

## クエリの例

次のコードは、リポジトリのメソッドを拡張する際に参考にできるクエリ構文です。`users` と `ctx` は各メソッドで宣言する必要があります。`age`、`status` の条件を使用するには、対応する列を先にモデルとテーブルに追加してください。

### 条件による取得

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

### 結合

```go
// SELECT * FROM users JOIN orders ON users.id = orders.user_id
err := r.db.NewSelect().
    Model(&users).
    Relation("Orders").
    Scan(ctx)
```

結合の例にある `Orders` リレーションを動作させるには、別のエンティティとBunのリレーションタグを定義する必要があります。上の基本的な `User` モデルには含まれていません。

## 検証

静的な契約検査とローカルのGo検査を実行します。`verify` は、実際のDB接続、マイグレーション、クエリを検証しません。

```sh
go mod tidy
go mod download all
gofmt -w src/database/db.go src/entity/user.go src/user/user_repository.go src/user/user_controller.go src/user/user_read.go cmd/migrate/main.go internal/application/application.go
spine contract check
spine verify
```

マイグレーション後、`spine dev` でアプリを起動し、`GET /user/:id` をリクエストします。空のテーブルには該当するIDが存在しないため、HTTP 404が返ります。ユーザーを保存してから取得するには、次のトランザクションのチュートリアルにあるPOSTの例を適用してください。

## 次のステップ

- [チュートリアル: トランザクション](/ja/learn/tutorial/6-transaction): リクエスト単位でユーザーを保存し、ロールバックを確認
- [チュートリアル: エラー処理](/ja/learn/tutorial/7-error-handling): `httperr` でHTTPエラーを返す
