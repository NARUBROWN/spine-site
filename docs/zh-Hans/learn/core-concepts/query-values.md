# query.Values

## 概览

`query.Values` 提供显式、类型安全的查询字符串读取方式。它不会自动把所有参数映射到结构体，因此参数来源、默认值和转换规则一目了然。

```go
func (c *UserController) List(_ context.Context, q query.Values) httpx.Response[[]User] {
    page := q.Int("page", 1)
    active := q.GetBoolByKey("active", false)
    _ = page
    _ = active
    return httpx.Response[[]User]{}
}
```

## 方法

| 方法 | 说明 |
|---|---|
| `Get(key)` / `String(key)` | 读取字符串值 |
| `Int(key, def)` | 读取整数，缺失或无效时使用默认值 |
| `GetBoolByKey(key, def)` | 读取布尔值并使用默认值 |
| `Has(key)` | 判断参数是否存在 |

## 用途

适合筛选、搜索、排序和可选参数。分页场景可使用专门的 `query.Pagination`；需要自定义名称或复杂筛选时使用 `query.Values`。

## 设计原则

显式提取参数、显式声明默认值、将可选参数保持为可选。这些规则避免了隐式绑定带来的不确定性。
