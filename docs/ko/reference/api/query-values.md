# query.Values

query.Values 헬퍼에 대한 API 참조.

## 개요

`query.Values`는 HTTP 쿼리 파라미터 전체에 대한 읽기 전용 뷰를 제공합니다. Controller 시그니처에서 파라미터로 선언하면 `QueryValuesResolver`가 자동으로 값을 주입합니다.

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## 구조체 정의

```go
type Values struct {
    values map[string][]string
}
```

## 생성자

### NewValues

```go
func NewValues(values map[string][]string) Values
```

새로운 `Values` 인스턴스를 생성합니다. 일반적으로 직접 호출하지 않으며, `QueryValuesResolver`가 내부적으로 사용합니다.

**매개변수**
- `values` - 쿼리 파라미터 맵

**반환값**
- `Values` - Values 인스턴스

## 메서드

### Get

```go
func (q Values) Get(key string) string
```

지정한 키의 첫 번째 값을 반환합니다. `String()`의 별칭입니다.

**매개변수**
- `key` - 쿼리 파라미터 키

**반환값**
- `string` - 값. 키가 없으면 빈 문자열

**예시**
```go
// GET /users?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String

```go
func (q Values) String(key string) string
```

지정한 키의 첫 번째 값을 문자열로 반환합니다.

**매개변수**
- `key` - 쿼리 파라미터 키

**반환값**
- `string` - 값. 키가 없으면 빈 문자열

**예시**
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

지정한 키의 값을 정수로 파싱합니다.

**매개변수**
- `key` - 쿼리 파라미터 키
- `def` - 파싱 실패 또는 키가 없을 때 반환할 기본값

**반환값**
- `int64` - 파싱된 정수 또는 기본값

**예시**
```go
// GET /users?page=3&size=20
q.Int("page", 1)    // 3
q.Int("size", 10)   // 20
q.Int("offset", 0)  // 0 (키 없음)

// GET /users?page=abc
q.Int("page", 1)    // 1 (파싱 실패)
```

### GetBoolByKey

```go
func (q Values) GetBoolByKey(key string, def bool) bool
```

지정한 키의 값을 불리언으로 파싱합니다.

**true로 인식되는 값** (대소문자 무시)
- `"true"`, `"1"`, `"yes"`, `"y"`, `"on"`

**false로 인식되는 값** (대소문자 무시)
- `"false"`, `"0"`, `"no"`, `"n"`, `"off"`

**매개변수**
- `key` - 쿼리 파라미터 키
- `def` - 파싱 실패 또는 키가 없을 때 반환할 기본값

**반환값**
- `bool` - 파싱된 불리언 또는 기본값

**예시**
```go
// GET /users?active=true&verified=1&premium=yes
q.GetBoolByKey("active", false)    // true
q.GetBoolByKey("verified", false)  // true
q.GetBoolByKey("premium", false)   // true
q.GetBoolByKey("deleted", false)   // false (키 없음)

// GET /users?active=maybe
q.GetBoolByKey("active", false)    // false (인식 불가)
```

### Has

```go
func (q Values) Has(key string) bool
```

지정한 키가 존재하는지 확인합니다.

**매개변수**
- `key` - 쿼리 파라미터 키

**반환값**
- `bool` - 키 존재 여부

**예시**
```go
// GET /users?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (값이 비어도 키는 존재)
q.Has("missing") // false
```

## Controller에서 사용

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

## 참고

- [query.Pagination](/docs/api/pagination) - 페이지네이션 헬퍼
- [ArgumentResolver](/docs/concepts/argument-resolver) - 파라미터 해석