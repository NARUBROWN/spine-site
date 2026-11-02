# query.Values

`query.Values` is a helper for reading HTTP query parameters. When you declare the value type `query.Values` as a controller parameter, the runtime injects the request's query values.

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## Public API

| Signature | Return value and default behavior |
| --- | --- |
| `NewValues(values map[string][]string) Values` | Values created from the supplied map |
| `(q Values) Get(key string) string` | First value, or an empty string if absent |
| `(q Values) String(key string) string` | Same behavior as `Get` |
| `(q Values) Int(key string, def int64) int64` | Decimal integer. Returns `def` if the value is absent or conversion fails |
| `(q Values) GetBoolByKey(key string, def bool) bool` | Boolean value. Returns `def` if unrecognized |
| `(q Values) Has(key string) bool` | Whether the key exists, regardless of its value |

The fields of `Values` are not exported. It provides only methods for reading values, and uses the first value for each key. Use `core.HttpRequestContext.Queries()` in input resolution code that needs to read all repeated values.

## Constructor

### NewValues

```go
func NewValues(values map[string][]string) Values
```

Creates `Values`. You do not need to call it directly in controllers. You can use it to create standalone values or test inputs.

**Parameters**

- `values` - Map of query parameters

**Returns**

- `Values` - The query values created

## Methods

### Get

```go
func (q Values) Get(key string) string
```

Returns the first value for the specified key.

**Parameters**

- `key` - Query parameter key

**Returns**

- `string` - Value, or an empty string if the key is absent

**Example**

```go
// GET /user?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String

```go
func (q Values) String(key string) string
```

Returns the first value for the specified key as a string. It has the same implementation as `Get()`.

**Parameters**

- `key` - Query parameter key

**Returns**

- `string` - Value, or an empty string if the key is absent

**Example**

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

Converts the first value for the specified key to a decimal `int64`. Returns `def` if the key is absent, the value is empty, or the value is out of range.

**Parameters**

- `key` - Query parameter key
- `def` - Default value returned when parsing fails or the key is absent

**Returns**

- `int64` - Parsed integer or default value

**Example**

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

Converts the first value for the specified key to a boolean. Case-insensitive.

**Values recognized as true** (case-insensitive)

- `"true"`, `"1"`, `"yes"`, `"y"`, `"on"`

**Values recognized as false** (case-insensitive)

- `"false"`, `"0"`, `"no"`, `"n"`, `"off"`

Other values return the default.

**Parameters**

- `key` - Query parameter key
- `def` - Default value returned when parsing fails or the key is absent

**Returns**

- `bool` - Parsed boolean or default value

**Example**

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

Checks whether the specified key exists.

**Parameters**

- `key` - Query parameter key

**Returns**

- `bool` - Whether the key exists

**Example**

```go
// GET /user?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (값이 비어도 키는 존재)
q.Has("missing") // false
```

## Using Values in controllers

These examples extend the `src/user` resource from [Create your first app](/en/learn/getting-started/first-app) and [Controllers](/en/learn/tutorial/2-controller). Implement `User`, `Product`, the search result types, and the services' search methods in your application. Each handler is an independent example, so add only the methods and routes you need.

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

## Constraints and errors

- Automatic injection supports the value type `query.Values`. Do not declare `*query.Values`.
- Automatic injection is supported only for HTTP inputs. Event consumer and WebSocket message contexts cannot be asserted to `HttpRequestContext`, so input resolution fails.
- `Int` and `GetBoolByKey` do not return errors. If you need to distinguish invalid values from omitted values, check with `Has` and `Get` and validate them in your application.
- `Get` and `String` do not distinguish an empty string value from an absent key. `Has` returns `true` even when the value is empty, as in `?empty=`.
- Leading and trailing whitespace is not removed from boolean values. For example, `" true "` is unrecognized and returns `def`.
- `NewValues` does not copy the supplied map. Changing the original map after construction also changes lookup results.

For the implementation, see the [query helper](https://github.com/NARUBROWN/spine/blob/v0.6.0/pkg/query/types.go) and [automatic injection code](https://github.com/NARUBROWN/spine/blob/v0.6.0/internal/resolver/query_values_resolver.go).

## See also

- `query.Pagination`: Helper for reading the page number and size
- [Execution pipeline](/en/learn/core-concepts/pipeline): Parameter resolution order
