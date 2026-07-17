# query.Values

## 概览

`query.Values` 是由 `QueryValuesResolver` 注入到控制器的查询参数读取器。

```go
func (c *UserController) List(_ context.Context, q query.Values) httpx.Response[[]User] {
    return httpx.Response[[]User]{Body: c.service.List(q.Int("page", 1))}
}
```

## 构造与方法

`NewValues(url.Values)` 创建实例。可使用：

- `Get(key)`、`String(key)` 读取字符串；
- `Int(key, def)` 读取整数并指定默认值；
- `GetBoolByKey(key, def)` 读取布尔值；
- `Has(key)` 检查参数是否存在。

它适合筛选与搜索；标准分页使用 `query.Pagination`。
