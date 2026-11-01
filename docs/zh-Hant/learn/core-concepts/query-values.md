# query.Values

先依[第一個應用程式](/zh-Hant/learn/getting-started/first-app)使用 CLI 建立專案，再依[控制器](/zh-Hant/learn/tutorial/2-controller)產生 `src/user`。應用程式處理函式範例手動擴充 `src/user` 中的同一個 `package user`。`User`、搜尋與分頁回應型別、服務的搜尋方法都需自行實作，CLI 不會產生。Product、Order 範例也是相同的功能擴充。各處理函式是獨立替代方案，只加入需要的方法與路由。成功結果用 `httpx.Response[T]` 包裝，並匯入 `httpx` 與 `query`。

```go
import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)
```

`query.Values` 提供明確、型別安全的查詢字串讀取方式。

```go
page := q.Int("page", 1)
active := q.GetBoolByKey("active", false)
```

| 方法 | 說明 |
|---|---|
| `Get(key)` / `String(key)` | 讀取字串 |
| `Int(key, def)` | 讀取整數並指定預設值 |
| `GetBoolByKey(key, def)` | 讀取布林值 |
| `Has(key)` | 判斷參數是否存在 |

它適合篩選、搜尋與可選參數；標準分頁可使用 `query.Pagination`。明確提取與明確預設值能避免隱式繫結造成的不確定性。
