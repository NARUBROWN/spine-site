# query.Values

::: warning v0.7.0 미리보기 입력 API 전환
이 페이지의 기존 API 설명과 예제는 안정 버전 `v0.6.5` 기준입니다. `v0.7.0-preview.1`부터 출처별 Path, Query, Header DTO를 지원하며 `query.Values`, `header.Values`와 해당 생성/조회 API, `query.Pagination`, `path.Int`, `path.String`, `path.Boolean`은 Deprecated입니다.

새 DTO 방식은 `v0.6.5`에 그대로 적용할 수 없습니다. 미리보기에서도 한 핸들러 안에서 새 DTO와 Deprecated 입력을 혼용하면 부팅 시 거부합니다. 기존 본문 DTO와 context는 계속 함께 사용할 수 있습니다.

적용 버전과 전환 예제는 [미리보기 핸들러 입력 전환](/ko/learn/migration/v0.7.0-preview), 명세 옵션은 [런타임 OpenAPI](/ko/reference/api/openapi)를 확인하세요.
:::

`query.Values`는 HTTP 쿼리 매개변수를 읽는 헬퍼입니다. 컨트롤러 매개변수에 값 타입인 `query.Values`를 선언하면 런타임이 요청의 쿼리 값을 주입합니다.

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## 공개 API

| 시그니처 | 반환값과 기본 동작 |
| --- | --- |
| `NewValues(values map[string][]string) Values` | 주어진 맵으로 생성한 값 |
| `(q Values) Get(key string) string` | 첫 번째 값. 없으면 빈 문자열 |
| `(q Values) String(key string) string` | `Get`과 같은 동작 |
| `(q Values) Int(key string, def int64) int64` | 10진수 정수. 값이 없거나 변환에 실패하면 `def` |
| `(q Values) GetBoolByKey(key string, def bool) bool` | 불리언 값. 인식할 수 없으면 `def` |
| `(q Values) Has(key string) bool` | 값과 관계없이 키가 존재하는지 여부 |

`Values`의 필드는 공개하지 않습니다. 값을 읽는 메서드만 제공하며, 값을 조회할 때는 같은 키의 첫 번째 값을 사용합니다. 반복된 값을 모두 읽어야 하는 입력 해석 코드에서는 `core.HttpRequestContext.Queries()`를 사용합니다.

## 생성자

### NewValues

```go
func NewValues(values map[string][]string) Values
```

`Values`를 생성합니다. 컨트롤러에서는 직접 호출할 필요가 없으며, 독립된 값이나 테스트 입력을 만들 때 사용할 수 있습니다.

**매개변수**

- `values` - 쿼리 매개변수 맵

**반환값**

- `Values` - 생성한 쿼리 값

## 메서드

### Get

```go
func (q Values) Get(key string) string
```

지정한 키의 첫 번째 값을 반환합니다.

**매개변수**

- `key` - 쿼리 매개변수 키

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

- `key` - 쿼리 매개변수 키

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

지정한 키의 첫 번째 값을 10진수 `int64`로 변환합니다. 키가 없거나 값이 비었거나 범위를 벗어나면 `def`를 반환합니다.

**매개변수**

- `key` - 쿼리 매개변수 키
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

지정한 키의 첫 번째 값을 불리언으로 변환합니다. 대소문자는 구분하지 않습니다.

**true로 인식되는 값** (대소문자 무시)

- `"true"`, `"1"`, `"yes"`, `"y"`, `"on"`

**false로 인식되는 값** (대소문자 무시)

- `"false"`, `"0"`, `"no"`, `"n"`, `"off"`

위에 해당하지 않는 값은 기본값을 반환합니다.

**매개변수**

- `key` - 쿼리 매개변수 키
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

- `key` - 쿼리 매개변수 키

**반환값**

- `bool` - 키 존재 여부

**예시**

```go
// GET /user?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (값이 비어도 키는 존재)
q.Has("missing") // false
```

## 컨트롤러에서 사용

[첫 앱 만들기](/ko/learn/getting-started/first-app)와 [컨트롤러](/ko/learn/tutorial/2-controller)의 `src/user` 리소스를 확장하는 예입니다. `User`, `Product`, 검색 결과 타입과 서비스의 검색 메서드는 앱에서 구현합니다. 각 핸들러는 독립된 예이므로 필요한 메서드와 라우트만 추가하십시오.

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

## 제약과 오류

- 자동 주입은 `query.Values` 값 타입을 지원합니다. `*query.Values`를 선언하지 마십시오.
- HTTP 입력에서만 자동 주입합니다. 이벤트 소비자와 WebSocket 메시지 컨텍스트에서는 `HttpRequestContext`로 타입 단언할 수 없어 입력 해석에 실패합니다.
- `Int`와 `GetBoolByKey`는 오류를 반환하지 않습니다. 잘못된 값과 생략된 값을 구분해야 한다면 `Has`와 `Get`으로 확인하고 앱에서 검증하십시오.
- `Get`과 `String`은 값이 빈 문자열인 경우와 키가 없는 경우를 구분하지 않습니다. `Has`는 `?empty=`처럼 값이 비어 있어도 `true`를 반환합니다.
- 불리언 값의 앞뒤 공백은 제거하지 않습니다. 예를 들어 `" true "`는 인식할 수 없어 `def`를 반환합니다.
- `NewValues`는 전달받은 맵을 복사하지 않습니다. 생성 후 원본 맵을 바꾸면 조회 결과도 달라집니다.

구현은 [쿼리 헬퍼](https://github.com/NARUBROWN/spine/blob/v0.6.5/pkg/query/types.go)와 [자동 주입 코드](https://github.com/NARUBROWN/spine/blob/v0.6.5/internal/resolver/query_values_resolver.go)에서 확인할 수 있습니다.

## 참고

- `query.Pagination`: 페이지 번호와 크기를 읽는 헬퍼
- [실행 파이프라인](/ko/learn/core-concepts/pipeline): 매개변수 해석 순서
