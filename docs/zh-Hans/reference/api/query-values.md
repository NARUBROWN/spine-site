# query.Values

先按[第一个应用](/zh-Hans/learn/getting-started/first-app)使用 CLI 创建项目，再按[控制器](/zh-Hans/learn/tutorial/2-controller)生成 `src/user`。应用处理函数示例手动扩展 `src/user` 中的同一个 `package user`。`User`、搜索和分页响应类型、服务的搜索方法都需自行实现，CLI 不会生成。Product、Order 示例也是同样的功能扩展。各处理函数是独立替代方案，只添加需要的方法和路由。成功结果用 `httpx.Response[T]` 包装，并导入 `httpx` 与 `query`。

```go
import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)
```

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
