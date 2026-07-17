# query.Values

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
