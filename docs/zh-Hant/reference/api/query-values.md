# query.Values

`query.Values` 是由 `QueryValuesResolver` 注入控制器的查詢參數讀取器。

```go
page := q.Int("page", 1)
keyword := q.String("q")
```

可使用 `Get`、`String`、`Int`、`GetBoolByKey` 和 `Has`。它適合篩選與搜尋；標準分頁使用 `query.Pagination`。
