# query.Values

[첫 번째 앱](/ko/learn/getting-started/first-app)에서 CLI로 프로젝트를 만들고 [컨트롤러](/ko/learn/tutorial/2-controller)에서 `src/user` 리소스를 생성한 뒤 이어갑니다. 앱 핸들러 예제는 `src/user`의 같은 `package user`를 직접 확장합니다. `User`, 검색·페이지 응답 타입과 서비스의 검색 메서드는 예제에 맞게 직접 구현하며 CLI가 생성하지 않습니다. Product·Order 예제도 같은 방식의 기능 확장입니다. 각 핸들러는 독립된 대안이므로 필요한 메서드와 라우트만 추가하세요. 성공 응답은 `httpx.Response[T]`로 감싸며, 아래 핸들러에서는 `httpx`와 `query` 패키지를 import합니다.

```go
import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)
```

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

지정한 키의 첫 번째 값을 반환합니다.

**매개변수**
- `key` - 쿼리 파라미터 키

**반환값**
- `string` - 값. 키가 없으면 빈 문자열

**예시**
```go
// GET /user?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String

```go
func (q Values) String(key string) string
```

지정한 키의 첫 번째 값을 문자열로 반환합니다. `Get()`과 동일한 구현입니다.

**매개변수**
- `key` - 쿼리 파라미터 키

**반환값**
- `string` - 값. 키가 없으면 빈 문자열

**예시**
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

지정한 키의 값을 정수로 파싱합니다. 내부적으로 `Get()`을 호출하여 값을 가져온 뒤 `strconv.ParseInt`로 변환합니다.

**매개변수**
- `key` - 쿼리 파라미터 키
- `def` - 파싱 실패 또는 키가 없을 때 반환할 기본값

**반환값**
- `int64` - 파싱된 정수 또는 기본값

**예시**
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

지정한 키의 값을 불리언으로 파싱합니다. 내부적으로 `Get()`을 호출한 뒤 소문자로 변환하여 판별합니다.

**true로 인식되는 값** (대소문자 무시)
- `"true"`, `"1"`, `"yes"`, `"y"`, `"on"`

**false로 인식되는 값** (대소문자 무시)
- `"false"`, `"0"`, `"no"`, `"n"`, `"off"`

위에 해당하지 않는 값은 기본값을 반환합니다.

**매개변수**
- `key` - 쿼리 파라미터 키
- `def` - 파싱 실패 또는 키가 없을 때 반환할 기본값

**반환값**
- `bool` - 파싱된 불리언 또는 기본값

**예시**
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

지정한 키가 존재하는지 확인합니다.

**매개변수**
- `key` - 쿼리 파라미터 키

**반환값**
- `bool` - 키 존재 여부

**예시**
```go
// GET /user?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (값이 비어도 키는 존재)
q.Has("missing") // false
```


## QueryValuesResolver

`query.Values` 타입을 Controller 파라미터로 선언하면 `QueryValuesResolver`가 자동으로 값을 생성합니다.

```go
// internal/resolver/query_values_resolver.go
type QueryValuesResolver struct{}

func (r *QueryValuesResolver) Supports(pm ParameterMeta) bool {
    return pm.Type == reflect.TypeFor[query.Values]()
}

func (r *QueryValuesResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
        return nil, fmt.Errorf("HTTP 요청 컨텍스트가 아닙니다")
    }
    return query.NewValues(httpCtx.Queries()), nil
}
```

Resolver는 `core.ExecutionContext`를 `core.HttpRequestContext`로 타입 단언한 뒤 `Queries()`로 전체 쿼리 맵을 가져옵니다. HTTP 요청이 아닌 컨텍스트(Consumer, WebSocket)에서는 에러를 반환합니다.


## Controller에서 사용

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

## 참고

- query.Pagination - 페이지네이션 헬퍼
- [ArgumentResolver](/ko/learn/core-concepts/pipeline) - 파라미터 해석