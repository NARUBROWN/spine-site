# query.Values

`query.Values` 是讀取 HTTP 查詢參數的輔助工具。將值型別 `query.Values` 宣告為控制器參數時，執行階段會注入請求的查詢值。

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## 公開 API

| 簽章 | 回傳值與預設行為 |
| --- | --- |
| `NewValues(values map[string][]string) Values` | 以傳入映射建立的值 |
| `(q Values) Get(key string) string` | 第一個值，若不存在則為空字串 |
| `(q Values) String(key string) string` | 與 `Get` 相同 |
| `(q Values) Int(key string, def int64) int64` | 十進位整數，若值不存在或轉換失敗則回傳 `def` |
| `(q Values) GetBoolByKey(key string, def bool) bool` | 布林值，若無法辨識則回傳 `def` |
| `(q Values) Has(key string) bool` | 索引鍵是否存在，與值無關 |

`Values` 不公開欄位，只提供讀取值的方法。查詢值時，使用同一索引鍵的第一個值。若輸入解析程式碼需要讀取所有重複值，請使用 `core.HttpRequestContext.Queries()`。

## 建構函式

### NewValues

```go
func NewValues(values map[string][]string) Values
```

建立 `Values`。控制器中不必直接呼叫，可用於建立獨立的值或測試輸入。

**參數**

- `values` - 查詢參數映射

**回傳值**

- `Values` - 建立的查詢值

## 方法

### Get

```go
func (q Values) Get(key string) string
```

回傳指定索引鍵的第一個值。

**參數**

- `key` - 查詢參數的索引鍵

**回傳值**

- `string` - 值，若索引鍵不存在則為空字串

**範例**

```go
// GET /user?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String

```go
func (q Values) String(key string) string
```

以字串回傳指定索引鍵的第一個值，實作與 `Get()` 相同。

**參數**

- `key` - 查詢參數的索引鍵

**回傳值**

- `string` - 值，若索引鍵不存在則為空字串

**範例**

```go
// GET /user?status=active&name=john
q.String("status")  // "active"
q.String("name")    // "john"
q.String("missing") // ""
```

### Int

```go
func (q Values) Int(key string, def int64) int64
```

將指定索引鍵的第一個值轉換為十進位 `int64`。若索引鍵不存在、值為空或超出範圍，則回傳 `def`。

**參數**

- `key` - 查詢參數的索引鍵
- `def` - 解析失敗或索引鍵不存在時回傳的預設值

**回傳值**

- `int64` - 解析後的整數或預設值

**範例**

```go
// GET /user?page=3&size=20
q.Int("page", 1)    // 3
q.Int("size", 10)   // 20
q.Int("offset", 0)  // 0 (키 없음)

// GET /user?page=abc
q.Int("page", 1)    // 1 (파싱 실패)
```

### GetBoolByKey

```go
func (q Values) GetBoolByKey(key string, def bool) bool
```

將指定索引鍵的第一個值轉換為布林值，不區分大小寫。

**辨識為 true 的值**（不區分大小寫）

- `"true"`、`"1"`、`"yes"`、`"y"`、`"on"`

**辨識為 false 的值**（不區分大小寫）

- `"false"`、`"0"`、`"no"`、`"n"`、`"off"`

不屬於上述值時，回傳預設值。

**參數**

- `key` - 查詢參數的索引鍵
- `def` - 解析失敗或索引鍵不存在時回傳的預設值

**回傳值**

- `bool` - 解析後的布林值或預設值

**範例**

```go
// GET /user?active=true&verified=1&premium=yes
q.GetBoolByKey("active", false)    // true
q.GetBoolByKey("verified", false)  // true
q.GetBoolByKey("premium", false)   // true
q.GetBoolByKey("deleted", false)   // false (키 없음)

// GET /user?active=maybe
q.GetBoolByKey("active", false)    // false (인식 불가)
```

### Has

```go
func (q Values) Has(key string) bool
```

確認指定索引鍵是否存在。

**參數**

- `key` - 查詢參數的索引鍵

**回傳值**

- `bool` - 索引鍵是否存在

**範例**

```go
// GET /user?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (값이 비어도 키는 존재)
q.Has("missing") // false
```

## 在控制器中使用

以下範例擴充[建立第一個應用程式](/zh-Hant/learn/getting-started/first-app)與[控制器](/zh-Hant/learn/tutorial/2-controller)中的 `src/user` 資源。`User`、`Product`、搜尋結果型別與服務的搜尋方法由應用程式實作。各處理器都是獨立範例，請只加入所需的方法與路由。

```go
import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)
```

```go
func (c *UserController) Search(q query.Values) httpx.Response[[]User] {
    status := q.String("status")
    page := q.Int("page", 1)
    size := q.Int("size", 20)
    active := q.GetBoolByKey("active", true)

    return httpx.Response[[]User]{Body: c.service.Search(status, page, size, active)}
}
```

```go
func (c *ProductController) Filter(q query.Values) httpx.Response[[]Product] {
    filters := make(map[string]string)

    if q.Has("category") {
        filters["category"] = q.String("category")
    }
    if q.Has("min_price") {
        filters["min_price"] = q.String("min_price")
    }

    return httpx.Response[[]Product]{Body: c.service.FindByFilters(filters)}
}
```

## 限制與錯誤

- 自動注入支援 `query.Values` 值型別，請勿宣告 `*query.Values`。
- 只會在 HTTP 輸入中自動注入。事件消費者與 WebSocket 訊息內容無法型別斷言為 `HttpRequestContext`，因此輸入解析會失敗。
- `Int` 與 `GetBoolByKey` 不回傳錯誤。若須區分無效值與省略值，請透過 `Has` 與 `Get` 確認，並在應用程式中驗證。
- `Get` 與 `String` 不區分空字串值與索引鍵不存在的情況。即使像 `?empty=` 一樣值為空，`Has` 也會回傳 `true`。
- 不會移除布林值前後的空白。例如，`" true "` 無法辨識，會回傳 `def`。
- `NewValues` 不會複製傳入的映射。建立後若修改原始映射，查詢結果也會改變。

實作可在[查詢輔助工具](https://github.com/NARUBROWN/spine/blob/v0.6.5/pkg/query/types.go)與[自動注入程式碼](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/resolver/query_values_resolver.go)中查看。

## 參考

- `query.Pagination`：讀取頁碼與每頁筆數的輔助工具
- [執行管線](/zh-Hant/learn/core-concepts/pipeline)：參數解析流程
