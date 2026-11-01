# 交易管理

繼續使用[資料庫](/zh-Hant/learn/tutorial/5-database)中的 CLI 專案 `example.com/my-app`。沿用 `src/database`、`src/entity` 和 `src/user`，手動加入以下交易程式碼。CLI 不提供 Bun 交易或 outbox 產生器。

## 執行順序

Spine v0.5.1 在 `PreHandle` 中開始交易，在 `BeforeResponse` 中提交或回復。回應序列化、狀態碼、Cookie 驗證與事件派送等準備失敗也能觸發回復。`AfterCompletion` 用於完成後的日誌與清理。

```text
PreHandle: begin transaction
→ Controller → response preparation → PostHandle
→ BeforeResponse: rollback on error, commit on success
→ HTTP response flush
→ AfterCompletion: logging / cleanup
```

## 實作攔截器

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

必須回傳提交或回復錯誤，以便計入最終執行錯誤。保留包含 `log`、`errors` 的匯入以及四個攔截器方法。

## 註冊到產生的應用程式

向 `internal/application/application.go` 的匯入加入 `example.com/my-app/src/interceptor`。保留資料庫教學中的 `database.NewDB` provider 與 health、user 註冊，只在現有 Constructor 呼叫中加入 `interceptor.NewTxInterceptor`。下方是 `BuildApplication()` 內的註冊片段。

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

typed-nil `(*interceptor.TxInterceptor)(nil)` 會解析為 DI 建立的攔截器實例。`NewTxInterceptor` 回傳一個值。HTTP 交易使用 `boot.InterceptorHTTP`，因為 `app.Interceptor(...)` 也會作用於 WebSocket 訊息。只作用於指定路由時，省略全域攔截器註冊，並向該 `app.Route` 傳入 `route.WithInterceptors((*interceptor.TxInterceptor)(nil))`。

## 將請求交易傳給儲存庫

以下 POST 範例手動擴充 `src/user`，使用產生的 `UserController.service` 與 `UserService.repository` 欄位。請求 DTO 必須透過指標接收。`spine.Ctx` 來自 `github.com/NARUBROWN/spine/pkg/spine`，與根套件重名時使用 `spinectx` 別名。

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

服務將 `bun.IDB` 傳給儲存庫。`*bun.DB` 與 `bun.Tx` 都實作此介面，但請求交易不會重新注入建構子。依下方方式加入或調整儲存庫的 `Save(ctx, db, user)`。

用以下實作替換已有的 `Save` 方法，不要再宣告同名方法。

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

在 `src/user/user_route.go` 的 `Register` 中手動加入 POST 路由，保留現有 GET 註冊。

```go
app.Route("POST", "/user", (*UserController).Create)
```

## 同一請求中的多次寫入與 rollback

使用與單筆建立相同的交易儲存多個使用者。加入 `src/user/user_batch.go`，並在 `src/user/user_route.go` 的 `Register` 中註冊以下 POST 路由。如果第二次 INSERT 因 email 重複失敗，第一次 INSERT 也必須 rollback。

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

## 排除讀取請求

要略過讀取請求，在 `PreHandle` 開頭加入以下條件。`BeforeResponse` 也必須處理沒有交易的情況。不要略過必須使用交易的處理函式。

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## 驗證與執行

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
spine doctor
spine inspect
spine contract check
spine verify
spine dev
```

契約與本機檢查通過不代表真實資料庫提交或回復成功。執行應用程式需要資料庫教學中的 `DATABASE_URL` 與遷移。請在真實資料庫上另外驗證成功儲存、失敗回復及提交和回復錯誤的處理。

## 使用實際資料庫驗證

先依資料庫教學執行遷移，再啟動應用程式。以下請求假設測試資料庫為空。第一次請求回傳 HTTP 201，使用回應中的 ID 發起 GET 可讀取儲存的使用者。batch 的第二個 email 重複，因此回傳 HTTP 500。本例將資料庫錯誤作為一般錯誤回傳，回應不會洩漏內部 SQL 錯誤。

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

透過資料庫用戶端確認以下 SELECT 的結果分別為 1 和 0。第二個結果為 0 才能說明錯誤發生前的第一次 INSERT 也已 rollback。之後使用唯一 email 請求，仍應回傳 HTTP 201 並儲存成功。

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 原子性邊界

資料庫提交與 broker 發布或實際 socket write 並不是同一個原子交易。事件發布後仍可能提交失敗，提交後仍可能回應傳送失敗。將業務變更與 outbox 記錄存入同一個資料庫交易，由獨立 relay 發布，消費者使用穩定的事件 ID 去除重複。

- [Interceptor API](/zh-Hant/reference/api/interceptor)
- [Database](/zh-Hant/learn/tutorial/5-database)
