# 交易管理

將單一 HTTP 請求中執行的多次 INSERT 包在同一個交易中。撰寫攔截器，在請求成功時提交，若中途失敗則將先前的 INSERT 一併回滾。

本頁依功能劃分的 `src/user` 範例使用[專案結構](/zh-Hant/learn/tutorial/1-project-structure)中以 `--layout legacy` 建立的 `my-app`。CLI `v0.4.0` 預設產生依角色劃分的 `layered-v1` 結構。兩種布局都使用 Spine `v0.6.0` 與 Echo 平台 `v0.1.0`。

接續[資料庫](/zh-Hant/learn/tutorial/5-database)中的 `example.com/my-app`。請先準備 `src/database`、`src/entity`、`src/user` 與遷移。以下交易程式碼需要自行新增，CLI 並未提供 Bun 交易或 outbox 產生器。

## 執行順序

在 Spine v0.6.0 中，於 `PreHandle` 開始交易，並在 `BeforeResponse` 提交或回滾。回應序列化、狀態碼與 Cookie 驗證、事件發布等回應準備過程中發生的錯誤，也屬於回滾條件。`AfterCompletion` 用於在完成後記錄日誌或清理資源。

```text
PreHandle: 開始交易
→ 控制器 → 準備回應 → PostHandle
→ BeforeResponse: 若有錯誤則回滾，否則提交
→ 傳送 HTTP 回應
→ AfterCompletion: 記錄日誌與清理資源
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

必須回傳 `Commit()` 與 `Rollback()` 的錯誤，才能將其反映在最終執行錯誤中。請保留包含 `log`、`errors` 的 import，以及全部四個攔截器方法。

## 在產生的應用程式中註冊

在 `internal/application/application.go` 的 import 區塊中新增 `example.com/my-app/src/interceptor`。保留資料庫教學中註冊的 `database.NewDB` 以及 health、user 註冊，並在既有的 `app.Constructor` 呼叫中新增 `interceptor.NewTxInterceptor`。以下程式碼是 `BuildApplication()` 中的註冊部分。

```go
app.Constructor(
    NewHealthController,
    database.NewDB,
    interceptor.NewTxInterceptor,
)
app.InterceptorFor(boot.InterceptorHTTP, (*interceptor.TxInterceptor)(nil))
```

`(*interceptor.TxInterceptor)(nil)` 用來指定攔截器型別。Spine 透過 DI 建立此型別的執行個體，而 `NewTxInterceptor` 必須只回傳一個值。

若只要套用至 HTTP 請求，請如上使用 `boot.InterceptorHTTP`。`app.Interceptor(...)` 也會套用至 WebSocket 訊息。若只要套用至特定路由，請省略全域註冊，並在對應的 `app.Route` 指定 `route.WithInterceptors((*interceptor.TxInterceptor)(nil))` 選項。

## 將請求的交易傳遞至儲存庫

新增 `src/user/user_create.go`，使用請求的交易儲存使用者。此處使用產生的 `UserController` 中的 `service` 欄位，以及 `UserService` 中的 `repository` 欄位。

請求 DTO 以指標接收。`spine.Ctx` 來自 `github.com/NARUBROWN/spine/pkg/spine`。以下程式碼使用 `spinectx` 別名，避免與應用程式根套件同名。

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

服務以 `bun.IDB` 接收請求的交易，再將其傳遞至儲存庫。雖然 `*bun.DB` 與 `bun.Tx` 實作相同介面，但請求的交易不會自動重新注入儲存庫建構函式。

以以下實作取代 `src/user/user_repository.go` 中既有的 `Save` 方法。請勿額外宣告同名方法。

```go
// src/user/user_repository.go
func (r *UserRepository) Save(ctx context.Context, db bun.IDB, user *entity.User) error {
    _, err := db.NewInsert().Model(user).Exec(ctx)
    return err
}
```

在 `src/user/user_route.go` 的 `Register` 中自行新增 POST 路由。請保留既有的 GET 註冊。

```go
app.Route("POST", "/user", (*UserController).Create)
```

## 合併多次寫入並確認回滾

這次在單一請求中儲存多位使用者。建立 `src/user/user_batch.go`，並在 `src/user/user_route.go` 的 `Register` 中新增下方的 POST 路由。若第二次 INSERT 因電子郵件重複而失敗，第一次 INSERT 也應回滾。

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

若不想在讀取請求中開始交易，請在 `PreHandle` 開頭加入以下條件。`BeforeResponse` 也需要處理沒有交易的情況，上方實作已包含此處理。請勿將使用交易的控制器列為排除對象。

```go
if ctx.Method() == "GET" || ctx.Method() == "HEAD" || ctx.Method() == "OPTIONS" {
    return nil
}
```

## 驗證與執行

```bash
gofmt -w src/interceptor/tx_interceptor.go src/user/user_create.go src/user/user_batch.go src/user/user_repository.go src/user/user_route.go internal/application/application.go
go mod tidy
go mod download all
spine doctor
spine inspect
spine contract check
spine verify
spine dev
```

契約與本機檢查無法確認實際 DB 的提交與回滾。執行應用程式前，需要完成資料庫教學中的 `DATABASE_URL` 設定與遷移。下一步將確認成功請求的儲存，以及失敗請求的回滾。若提交與回滾本身失敗，其錯誤處理仍須另外確認。

## 在實際 DB 中確認

依照資料庫教學執行遷移並啟動應用程式後，在另一個終端機傳送以下請求。範例中的 GET 假設新建測試 DB 的第一位使用者 ID 為 1。若使用既有 DB，請以 POST 回應中的 ID 修改 GET 路徑。

第一個 POST 會以 HTTP 201 儲存使用者，再以回應中的 ID 傳送 GET，便會回傳同一位使用者。`/user/batch` 請求因第二個電子郵件重複而失敗，回傳 HTTP 500。由於 DB 錯誤以一般錯誤回傳，回應不會暴露內部 SQL 錯誤。

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

請在 DB 用戶端中確認以下 SELECT 的結果分別為 1 與 0。第二個結果若為 0，代表失敗前執行的第一次 INSERT 也已回滾。最後的 Bob 請求使用未重複的電子郵件，因此應再次以 HTTP 201 儲存成功。

```sql
SELECT COUNT(*) FROM users WHERE email = 'alice@example.com';
SELECT COUNT(*) FROM users WHERE email = 'rollback@example.com';
```

## 原子性邊界

DB 提交、訊息代理的事件發布，以及通訊端的回應傳送，無法包在同一個原子交易中。發布事件後 DB 提交可能失敗，提交後也可能發生回應傳送失敗。

若必須同時保證 DB 變更與事件記錄，請在同一個 DB 交易中儲存 outbox 紀錄，再由獨立的傳遞工作發布事件。重新傳送時也使用相同的事件 ID，消費者則必須以此 ID 判斷是否重複。

- [Interceptor API](/zh-Hant/reference/api/interceptor)
- [資料庫連線](/zh-Hant/learn/tutorial/5-database)
