# トランザクション管理

1つのHTTPリクエストで実行する複数のINSERTを、1つのトランザクションにまとめます。リクエストが成功したらコミットし、途中で失敗したら先に実行したINSERTもロールバックするインターセプターを作成します。

このページの機能別 `src/user` の例は、[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で `--layout legacy` を指定して作成した `my-app` を使用します。CLI `v0.4.0` の標準レイアウトは役割別の `layered-v1` です。どちらも Spine `v0.6.0` と Echo プラットフォーム `v0.1.0` を使用します。

[データベース](/ja/learn/tutorial/5-database)の `example.com/my-app` の続きです。先に `src/database`、`src/entity`、`src/user` とマイグレーションを準備してください。以下のトランザクションのコードは手動で追加します。CLIにはBunのトランザクションやoutboxの生成機能はありません。

## 実行順序

Spine v0.6.0では、`PreHandle` でトランザクションを開始し、`BeforeResponse` でコミットまたはロールバックします。レスポンスのシリアライズ、ステータスコードとCookieの検証、イベントの発行など、レスポンスの準備中に発生したエラーもロールバックの条件に含まれます。`AfterCompletion` は、完了後にログを記録したり、リソースを解放したりする際に使用します。

```text
PreHandle: トランザクション開始
→ コントローラー → レスポンスの準備 → PostHandle
→ BeforeResponse: エラーがあればロールバック、なければコミット
→ HTTPレスポンス送信
→ AfterCompletion: ログの記録とリソースの解放
```

## インターセプターの実装

```go
// src/interceptor/tx_interceptor.go
package interceptor

import (
    "errors"
    "log"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct{ db *bun.DB }

func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    if ctx.Context() == nil {
        return errors.New("execution context has no request context")
    }
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TxInterceptor) BeforeResponse(ctx core.ExecutionContext, meta core.HandlerMeta, executionErr error) error {
    value, ok := ctx.Get("tx")
    if !ok {
        return nil
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return errors.New("transaction has unexpected type")
    }
    if executionErr != nil {
        return tx.Rollback()
    }
    return tx.Commit()
}

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[TX] %s %s: %v", ctx.Method(), ctx.Path(), err)
    }
}
```

`Commit()` と `Rollback()` のエラーを返すことで、最終的な実行エラーに反映されます。`log` と `errors` を含むimportと、インターセプターの4つのメソッドをすべて維持してください。

## 生成されたアプリへの登録

`internal/application/application.go` のimportブロックに `example.com/my-app/src/interceptor` を追加します。データベースのチュートリアルで登録した `database.NewDB` とhealth、userの登録を維持し、既存の `app.Constructor` 呼び出しに `interceptor.NewTxInterceptor` を追加してください。次のコードは、`BuildApplication()` 内の登録部分です。

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

`(*interceptor.TxInterceptor)(nil)` はインターセプターの型を指定します。Spineはこの型に対応するインスタンスをDIで生成します。`NewTxInterceptor` は値を1つ返す必要があります。

HTTPリクエストにだけ適用するには、上のように `boot.InterceptorHTTP` を使用してください。`app.Interceptor(...)` はWebSocketメッセージにも適用されます。特定のルートにだけ適用するには、グローバルな登録を省略し、対象の `app.Route` に `route.WithInterceptors((*interceptor.TxInterceptor)(nil))` オプションを指定します。

## リクエストのトランザクションをリポジトリに渡す

`src/user/user_create.go` を追加し、リクエストのトランザクションでユーザーを保存します。生成された `UserController` の `service` フィールドと `UserService` の `repository` フィールドを使用します。

リクエストDTOはポインタで受け取ります。`spine.Ctx` は `github.com/NARUBROWN/spine/pkg/spine` からインポートします。以下のコードでは、アプリのルートパッケージと名前が重ならないように、`spinectx` というエイリアスを使用します。

```go
// src/user/user_create.go
package user

import (
    "context"
    "errors"
    "net/http"

    "example.com/my-app/src/entity"
    "github.com/NARUBROWN/spine/pkg/httpx"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

type CreateUserRequest struct {
    Name string `json:"name"`
    Email string `json:"email"`
}

func (c *UserController) Create(ctx context.Context, values spinectx.Ctx, req *CreateUserRequest) (httpx.Response[*entity.User], error) {
    value, ok := values.Get("tx")
    if !ok {
        return httpx.Response[*entity.User]{}, errors.New("transaction is missing")
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return httpx.Response[*entity.User]{}, errors.New("transaction has unexpected type")
    }
    user, err := c.service.Create(ctx, tx, req)
    if err != nil {
        return httpx.Response[*entity.User]{}, err
    }
    return httpx.Response[*entity.User]{
        Body: user,
        Options: httpx.ResponseOptions{Status: http.StatusCreated},
    }, nil
}

func (s *UserService) Create(ctx context.Context, db bun.IDB, req *CreateUserRequest) (*entity.User, error) {
    user := &entity.User{Name: req.Name, Email: req.Email}
    if err := s.repository.Save(ctx, db, user); err != nil {
        return nil, err
    }
    if err := db.NewSelect().Model(user).WherePK().Scan(ctx); err != nil {
        return nil, err
    }
    return user, nil
}
```

サービスはリクエストのトランザクションを `bun.IDB` として受け取り、リポジトリに渡します。`*bun.DB` と `bun.Tx` は同じインターフェースを実装していますが、リクエストのトランザクションがリポジトリのコンストラクタに自動で再注入されるわけではありません。

`src/user/user_repository.go` の既存の `Save` メソッドを次の実装に置き換えます。同じ名前のメソッドを追加で宣言しないでください。

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

`src/user/user_route.go` の `Register` にPOSTルートを手動で追加します。既存のGETの登録は維持します。

```go
app.Route("POST", "/user", (*UserController).Create)
```

## 複数の書き込みをまとめてロールバックを確認

今度は1つのリクエストで複数のユーザーを保存します。`src/user/user_batch.go` を作成し、以下のPOSTルートを `src/user/user_route.go` の `Register` に追加してください。2つ目のINSERTがメールアドレスの重複で失敗したら、1つ目のINSERTもロールバックされる必要があります。

```go
// src/user/user_batch.go
package user

import (
    "context"
    "errors"
    "net/http"

    "example.com/my-app/src/entity"
    "github.com/NARUBROWN/spine/pkg/httpx"
    spinectx "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

type CreateUsersRequest struct {
    Users []CreateUserRequest `json:"users"`
}

func (c *UserController) CreateBatch(ctx context.Context, values spinectx.Ctx, req *CreateUsersRequest) (httpx.Response[[]*entity.User], error) {
    value, ok := values.Get("tx")
    if !ok {
        return httpx.Response[[]*entity.User]{}, errors.New("transaction is missing")
    }
    tx, ok := value.(bun.Tx)
    if !ok {
        return httpx.Response[[]*entity.User]{}, errors.New("transaction has unexpected type")
    }
    users := make([]*entity.User, 0, len(req.Users))
    for index := range req.Users {
        user, err := c.service.Create(ctx, tx, &req.Users[index])
        if err != nil {
            return httpx.Response[[]*entity.User]{}, err
        }
        users = append(users, user)
    }
    return httpx.Response[[]*entity.User]{
        Body: users,
        Options: httpx.ResponseOptions{Status: http.StatusCreated},
    }, nil
}
```

```go
app.Route("POST", "/user/batch", (*UserController).CreateBatch)
```

## 読み取りリクエストの除外

読み取りリクエストでトランザクションを開始しない場合は、`PreHandle` の先頭に次の条件を入れます。`BeforeResponse` もトランザクションが存在しない場合を処理する必要があります。上の実装にはこの処理が含まれています。トランザクションを使用するコントローラーは除外しないでください。

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## 検証と実行

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
go mod download all
spine-cli doctor
spine-cli inspect
spine-cli contract check
spine-cli verify
spine-cli dev
```

契約検査とローカル検査だけでは、実際のDBのコミットとロールバックを確認できません。アプリを実行するには、データベースのチュートリアルにある `DATABASE_URL` の設定とマイグレーションが必要です。次の手順で、成功したリクエストの保存と、失敗したリクエストのロールバックを確認します。コミットとロールバック自体が失敗した場合のエラー処理は、別途確認する必要があります。

## 実際のDBで確認

データベースのチュートリアルに従ってマイグレーションを実行し、アプリを起動した後、別のターミナルから以下のリクエストを送信します。このGETの例では、新しく作成したテスト用DBで最初のユーザーのIDが1であることを前提としています。既存のDBを使用する場合は、POSTレスポンスのIDに合わせてGETのパスを変更してください。

最初のPOSTはHTTP 201で保存され、レスポンスのIDでGETすると同じユーザーが返ります。`/user/batch` リクエストは、2つ目のメールアドレスが重複するためHTTP 500で失敗します。DBエラーを通常のエラーとして返すため、内部のSQLエラーはレスポンスに公開されません。

```bash
curl -i -X POST http://localhost:8080/user \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
curl -i http://localhost:8080/user/1

curl -i -X POST http://localhost:8080/user/batch \
  -H 'Content-Type: application/json' \
  -d '{"users":[{"name":"Rollback","email":"rollback@example.com"},{"name":"Duplicate","email":"alice@example.com"}]}'

curl -i -X POST http://localhost:8080/user \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bob","email":"bob@example.com"}'
```

DBクライアントで、次のSELECTの結果がそれぞれ1と0であることを確認してください。2つ目の結果が0なら、失敗する前に実行した1つ目のINSERTもロールバックされています。最後のBobのリクエストは重複しないメールアドレスを使用するため、再びHTTP 201で保存されるはずです。

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 原子性の境界

DBのコミット、ブローカーによるイベントの発行、ソケットによるレスポンス送信は、1つのアトミックなトランザクションにはまとまりません。イベントを発行した後にDBのコミットが失敗することも、コミット後にレスポンスの送信が失敗することもあります。

DBの変更とイベントの記録を一緒に保証する必要がある場合は、同じDBトランザクションでoutboxレコードを保存し、別の配信処理でイベントを発行します。再送時にも同じイベントIDを使用し、コンシューマーはこのIDで重複を判定する必要があります。

- [Interceptor API](/ja/reference/api/interceptor)
- [データベース接続](/ja/learn/tutorial/5-database)
