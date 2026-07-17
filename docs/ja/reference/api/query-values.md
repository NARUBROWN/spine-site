# query.Values

query.Values ヘルパーの API 参照。
## 概要
`query.Values` は、HTTP クエリーパラメータ全体の読み取り専用ビューを提供します。 Controllerシグネチャでパラメータとして宣言すると、`QueryValuesResolver`は自動的に値を注入します。

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## 構造体の定義

```go
type Values struct {
    values map[string][]string
}
```

## コンストラクタ
### NewValues


```go
func NewValues(values map[string][]string) Values
```

新しい`Values`インスタンスを作成します。通常は直接呼び出さず、`QueryValuesResolver`が内部的に使用します。
**パラメータ**
- `values` - クエリパラメータマップ
**戻り値**
- `Values` - Values インスタンス
## メソッド
### Get


```go
func (q Values) Get(key string) string
```

指定したキーの最初の値を返します。
**パラメータ**
- `key` - クエリパラメータキー
**戻り値**
- `string` - 値。キーがない場合は空の文字列
**例**
```go
// GET /users?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String


```go
func (q Values) String(key string) string
```

指定したキーの最初の値を文字列として返します。 `Get()`と同じ実装です。
**パラメータ**
- `key` - クエリパラメータキー
**戻り値**
- `string` - 値。キーがない場合は空の文字列
**例**
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

指定したキーの値を整数として解析します。内部的に`Get()`を呼び出して値を取得し、`strconv.ParseInt`に変換します。
**パラメータ**
- `key` - クエリパラメータキー
- `def` - 解析失敗またはキーがない場合に返されるデフォルト値
**戻り値**
- `int64` - 解析された整数またはデフォルト値
**例**
```go
// GET /users?page=3&size=20
q.Int("page", 1)    // 3
q.Int("size", 10)   // 20
q.Int("offset", 0) // 0 (キーなし)

// GET /users?page=abc
q.Int("page", 1) // 1 (解析失敗)
```

### GetBoolByKey


```go
func (q Values) GetBoolByKey(key string, def bool) bool
```

指定したキーの値をブーリアンとして解析します。内部的に`Get()`を呼び出してから小文字に変換して判別します。
**trueとして認識される値**（大文字と小文字を無視）- `"true"`, `"1"`, `"yes"`, `"y"`, `"on"`

**falseとして認識される値**（大文字と小文字を無視）- `"false"`, `"0"`, `"no"`, `"n"`, `"off"`

上記に該当しない値はデフォルト値を返します。
**パラメータ**
- `key` - クエリパラメータキー
- `def` - 解析失敗またはキーがない場合に返されるデフォルト値
**戻り値**
- `bool` - 解析されたブールまたはデフォルト値
**例**
```go
// GET /users?active=true&verified=1&premium=yes
q.GetBoolByKey("active", false)    // true
q.GetBoolByKey("verified", false)  // true
q.GetBoolByKey("premium", false)   // true
q.GetBoolByKey("deleted", false)   // false (キーなし)

// GET /users?active=maybe
q.GetBoolByKey("active", false)    // false (인식 불가)
```

### Has


```go
func (q Values) Has(key string) bool
```

指定したキーが存在することを確認してください。
**パラメータ**
- `key` - クエリパラメータキー
**戻り値**
- `bool` - キーが存在するかどうか
**例**
```go
// GET /users?status=active&empty=
q.Has("status")  // true
q.Has("empty") // true (値が空でもキーは存在)
q.Has("missing") // false
```


## QueryValuesResolver

`query.Values`タイプをControllerパラメータとして宣言すると、`QueryValuesResolver`は自動的に値を生成します。

```go
// internal/resolver/query_values_resolver.go
type QueryValuesResolver struct{}

func (r *QueryValuesResolver) Supports(pm ParameterMeta) bool {
    return pm.Type == reflect.TypeFor[query.Values]()
}

func (r *QueryValuesResolver) Resolve(ctx core.ExecutionContext, parameterMeta ParameterMeta) (any, error) {
    httpCtx, ok := ctx.(core.HttpRequestContext)
    if !ok {
return nil, fmt.Errorf("HTTP 要求コンテキストではありません")
    }
    return query.NewValues(httpCtx.Queries()), nil
}
```

Resolver は、`core.ExecutionContext` を `core.HttpRequestContext` にタイプし、それを `Queries()` に照会マップ全体をインポートします。 HTTP要求ではなくコンテキスト（Consumer、WebSocket）はエラーを返します。

## Controllerで使用

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

## 注
- query.Pagination - ページネーションヘルパー
- [ArgumentResolver](/ja/learn/core-concepts/pipeline) - パラメータの解釈