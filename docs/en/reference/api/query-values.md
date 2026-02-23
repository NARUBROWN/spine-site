# query.Values

API Reference for query.Values helper.

## Overview

`query.Values` provides a read-only view of all HTTP query parameters. If declared as a parameter in a Controller signature, `QueryValuesResolver` automatically injects the values.

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## Struct Definition

```go
type Values struct {
    values map[string][]string
}
```

## Constructor

### NewValues

```go
func NewValues(values map[string][]string) Values
```

Creates a new `Values` instance. Generally not called directly, used internally by `QueryValuesResolver`.

**Parameters**
- `values` - Query parameter map

**Returns**
- `Values` - Values instance

## Methods

### Get

```go
func (q Values) Get(key string) string
```

Returns the first value for the specified key.

**Parameters**
- `key` - Query parameter key

**Returns**
- `string` - Value. Empty string if key is missing.

**Example**
```go
// GET /users?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String

```go
func (q Values) String(key string) string
```

Returns the first value for the specified key as a string. Has the same implementation as `Get()`.

**Parameters**
- `key` - Query parameter key

**Returns**
- `string` - Value. Empty string if key is missing.

**Example**
```go
// GET /users?status=active&name=john
q.String("status")  // "active"
q.String("name")    // "john"
q.String("missing") // ""
```

### Int

```go
func (q Values) Int(key string, def int64) int64
```

Parses the value of the specified key as an integer. Internally, it calls `Get()` to retrieve the value and then converts it using `strconv.ParseInt()`.

**Parameters**
- `key` - Query parameter key
- `def` - Default value to return on parse failure or missing key

**Returns**
- `int64` - Parsed integer or default value

**Example**
```go
// GET /users?page=3&size=20
q.Int("page", 1)    // 3
q.Int("size", 10)   // 20
q.Int("offset", 0)  // 0 (key missing)

// GET /users?page=abc
q.Int("page", 1)    // 1 (parse failed)
```

### GetBoolByKey

```go
func (q Values) GetBoolByKey(key string, def bool) bool
```

Parses the value of the specified key as a boolean. Internally, it calls `Get()` and then converts the string to lowercase before evaluating.

**Values recognized as true** (Case-insensitive)
- `"true"`, `"1"`, `"yes"`, `"y"`, `"on"`

**Values recognized as false** (Case-insensitive)
- `"false"`, `"0"`, `"no"`, `"n"`, `"off"`

Values not matching any of the above will return the default value.

**Parameters**
- `key` - Query parameter key
- `def` - Default value to return on parse failure or missing key

**Returns**
- `bool` - Parsed boolean or default value

**Example**
```go
// GET /users?active=true&verified=1&premium=yes
q.GetBoolByKey("active", false)    // true
q.GetBoolByKey("verified", false)  // true
q.GetBoolByKey("premium", false)   // true
q.GetBoolByKey("deleted", false)   // false (key missing)

// GET /users?active=maybe
q.GetBoolByKey("active", false)    // false (unrecognized)
```

### Has

```go
func (q Values) Has(key string) bool
```

Checks if the specified key exists.

**Parameters**
- `key` - Query parameter key

**Returns**
- `bool` - Existence of key

**Example**
```go
// GET /users?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (key exists even if value is empty)
q.Has("missing") // false
```

## QueryValuesResolver

If the `query.Values` type is declared as a Controller parameter, `QueryValuesResolver` automatically injects the value.

```go
// internal/resolver/query_values_resolver.go
type QueryValuesResolver struct{}

func (r *QueryValuesResolver) Supports(pm ParameterMeta) bool {
    return pm.Type == reflect.TypeFor[query.Values]()
}

func (r *QueryValuesResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("Not an HTTP request context")
    }
    return query.NewValues(httpCtx.Queries()), nil
}
```

The Resolver type asserts `core.ExecutionContext` to `core.HttpRequestContext` and fetches the full query map via `Queries()`. It returns an error in non-HTTP contexts (e.g., Consumer, WebSocket).


## Usage in Controller

```go
func (c *UserController) Search(q query.Values) []User {
    status := q.String("status")
    page := q.Int("page", 1)
    size := q.Int("size", 20)
    active := q.GetBoolByKey("active", true)
    
    return c.repo.Search(status, page, size, active)
}
```

```go
func (c *ProductController) Filter(q query.Values) []Product {
    filters := make(map[string]string)
    
    if q.Has("category") {
        filters["category"] = q.String("category")
    }
    if q.Has("min_price") {
        filters["min_price"] = q.String("min_price")
    }
    
    return c.repo.FindByFilters(filters)
}
```

## See Also

- query.Pagination - Pagination Helper
- [ArgumentResolver](/en/learn/core-concepts/pipeline#parameter-resolver) - Argument Resolution
