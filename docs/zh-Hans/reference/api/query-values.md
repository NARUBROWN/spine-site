# query.Values

`query.Values` 是用于读取 HTTP 查询参数的辅助类型。在控制器参数中声明值类型 `query.Values`，运行时便会注入请求的查询值。

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## 公开 API

| 签名 | 返回值和默认行为 |
| --- | --- |
| `NewValues(values map[string][]string) Values` | 使用给定映射创建的值 |
| `(q Values) Get(key string) string` | 第一个值。不存在时返回空字符串 |
| `(q Values) String(key string) string` | 与 `Get` 的行为相同 |
| `(q Values) Int(key string, def int64) int64` | 十进制整数。值不存在或转换失败时返回 `def` |
| `(q Values) GetBoolByKey(key string, def bool) bool` | 布尔值。无法识别时返回 `def` |
| `(q Values) Has(key string) bool` | 判断键是否存在，与值无关 |

`Values` 不公开字段，仅提供读取值的方法，查询时使用同一键的第一个值。在需要读取所有重复值的输入解析代码中，请使用 `core.HttpRequestContext.Queries()`。

## 构造函数

### NewValues

```go
func NewValues(values map[string][]string) Values
```

创建 `Values`。控制器中无需直接调用；可用于创建独立的值或测试输入。

**参数**

- `values` - 查询参数映射

**返回值**

- `Values` - 创建的查询值

## 方法

### Get

```go
func (q Values) Get(key string) string
```

返回指定键的第一个值。

**参数**

- `key` - 查询参数键

**返回值**

- `string` - 值。键不存在时返回空字符串

**示例**

```go
// GET /user?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String

```go
func (q Values) String(key string) string
```

以字符串形式返回指定键的第一个值。与 `Get()` 的实现相同。

**参数**

- `key` - 查询参数键

**返回值**

- `string` - 值。键不存在时返回空字符串

**示例**

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

将指定键的第一个值转换为十进制 `int64`。键不存在、值为空或超出范围时，返回 `def`。

**参数**

- `key` - 查询参数键
- `def` - 解析失败或键不存在时返回的默认值

**返回值**

- `int64` - 解析后的整数或默认值

**示例**

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

将指定键的第一个值转换为布尔值。不区分大小写。

**识别为 true 的值**（不区分大小写）

- `"true"`、`"1"`、`"yes"`、`"y"`、`"on"`

**识别为 false 的值**（不区分大小写）

- `"false"`、`"0"`、`"no"`、`"n"`、`"off"`

不属于上述情况的值返回默认值。

**参数**

- `key` - 查询参数键
- `def` - 解析失败或键不存在时返回的默认值

**返回值**

- `bool` - 解析后的布尔值或默认值

**示例**

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

检查指定键是否存在。

**参数**

- `key` - 查询参数键

**返回值**

- `bool` - 键是否存在

**示例**

```go
// GET /user?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (값이 비어도 키는 존재)
q.Has("missing") // false
```

## 在控制器中使用

以下示例扩展了[创建第一个应用](/zh-Hans/learn/getting-started/first-app)和[控制器](/zh-Hans/learn/tutorial/2-controller)中的 `src/user` 资源。`User`、`Product`、搜索结果类型和服务的搜索方法由应用实现。各处理器是独立示例，请仅添加所需的方法和路由。

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

## 约束和错误

- 自动注入支持 `query.Values` 值类型。请勿声明 `*query.Values`。
- 仅在 HTTP 输入中自动注入。在事件消费者和 WebSocket 消息上下文中，无法类型断言为 `HttpRequestContext`，因此输入解析会失败。
- `Int` 和 `GetBoolByKey` 不返回错误。如果需要区分无效值和省略的值，请使用 `Has` 和 `Get` 检查，并在应用中验证。
- `Get` 和 `String` 不区分空字符串值和键不存在的情况。即使像 `?empty=` 这样值为空，`Has` 也会返回 `true`。
- 不会移除布尔值首尾的空格。例如，`" true "` 无法识别，会返回 `def`。
- `NewValues` 不会复制传入的映射。创建后修改原始映射，查询结果也会改变。

实现可在[查询辅助类型](https://github.com/NARUBROWN/spine/blob/v0.5.1/pkg/query/types.go)和[自动注入代码](https://github.com/NARUBROWN/spine/blob/v0.5.1/internal/resolver/query_values_resolver.go)中查看。

## 参考

- `query.Pagination`：读取页码和每页数量的辅助类型
- [执行流水线](/zh-Hans/learn/core-concepts/pipeline)：参数解析顺序
