# トランザクション管理

[データベース](/ja/learn/tutorial/5-database)の CLI プロジェクト `example.com/my-app` を使います。`src/database`、`src/entity`、`src/user` を利用し、以下のトランザクションコードは手動で追加します。CLI は Bun トランザクションや outbox を生成しません。

## 実行順序

Spine v0.5.1 では `PreHandle` で開始し、`BeforeResponse` で commit または rollback します。シリアライズ・ステータス・Cookie 検証・イベント配信など、応答準備の失敗も rollback の対象になります。`AfterCompletion` は完了ログと後片付けに使います。

```text
PreHandle: begin transaction
→ Controller → response preparation → PostHandle
→ BeforeResponse: rollback on error, commit on success
→ HTTP response flush
→ AfterCompletion: logging / cleanup
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

commit・rollback のエラーは返し、実行エラーに反映させます。`log` と `errors` を含む import と、4つのメソッドを保ってください。

## 生成されたアプリに登録

`internal/application/application.go` の import に `example.com/my-app/src/interceptor` を追加します。データベースの `database.NewDB` provider と既存の health・user 登録を保ち、既存の Constructor 呼び出しに `interceptor.NewTxInterceptor` だけを追加します。以下は `BuildApplication()` 内の登録部分です。

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

typed-nil の `(*interceptor.TxInterceptor)(nil)` は DI が生成したインスタンスに解決されます。`NewTxInterceptor` は値を1つ返します。HTTP には `boot.InterceptorHTTP` を指定します。`app.Interceptor(...)` は WebSocket メッセージにも適用されます。特定ルートだけに適用する場合はグローバル登録を省き、その `app.Route` に `route.WithInterceptors((*interceptor.TxInterceptor)(nil))` を渡します。

## リクエストのトランザクションを渡す

以下の POST は `src/user` に手動追加する例です。生成された `UserController.service` と `UserService.repository` を使用します。リクエスト DTO はポインタで受け取ります。`spine.Ctx` は `github.com/NARUBROWN/spine/pkg/spine` から import し、アプリのルートパッケージと衝突する場合は `spinectx` を alias にします。

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

サービスは `bun.IDB` をリポジトリに渡します。`*bun.DB` と `bun.Tx` は両方このインターフェースを実装しますが、リクエストの tx がコンストラクタに再注入されることはありません。`Save(ctx, db, user)` を次の形で追加・調整します。

既存の `Save` メソッドを次の実装に置き換えます。同名のメソッドを追加で宣言しないでください。

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

`src/user/user_route.go` の `Register` に POST を手動で追加します。既存の GET 登録は保ちます。

```go
app.Route("POST", "/user", (*UserController).Create)
```

## 1つのリクエストで複数の書き込みとrollback

単一作成と同じトランザクションで複数ユーザーを保存します。`src/user/user_batch.go` を追加し、`src/user/user_route.go` の `Register` に以下のPOSTを追加します。2回目のINSERTがemailの重複で失敗した場合、最初のINSERTもrollbackされる必要があります。

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

## 読み取りリクエストを除外

読み取りを除外する場合は `PreHandle` の先頭に次の条件を追加します。`BeforeResponse` もトランザクションがない場合を扱う必要があります。tx が必須のハンドラーを除外しないでください。

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## 検証と実行

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
spine doctor
spine inspect
spine contract check
spine verify
spine dev
```

契約・ローカル検査の成功は、実際の DB commit・rollback の証明ではありません。実行にはデータベースの手順で設定した `DATABASE_URL` とマイグレーションが必要です。実際の DB で成功時の保存、失敗時の rollback、commit・rollback エラーを別に確認します。

## 実際のDBで確認

データベースの手順でマイグレーションを実行し、アプリを起動します。以下は空のテストDBを前提とします。最初のリクエストはHTTP 201を返し、応答のIDをGETすると保存済みユーザーを取得できます。batchは2件目のemailが重複するためHTTP 500です。DBエラーを通常のエラーで返すため、内部のSQLエラーは応答に公開されません。

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

DBクライアントで以下のSELECTがそれぞれ1と0になることを確認します。2つ目の0は、エラーより前のINSERTもrollbackされたことを示します。その後、一意のemailで再度リクエストするとHTTP 201で保存できる必要があります。

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 原子性の境界

DB commit は broker への発行や実際の socket write と原子的ではありません。イベント発行後に commit が失敗し、commit 後に応答送信が失敗する可能性があります。業務データと outbox を同じ DB トランザクションに保存し、別 relay で発行し、コンシューマーは安定したイベント ID で重複を処理します。

- [Interceptor API](/ja/reference/api/interceptor)
- [Database](/ja/learn/tutorial/5-database)
