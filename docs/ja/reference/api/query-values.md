# query.Values

`query.Values`はHTTPクエリパラメータを読み取るヘルパーです。コントローラーの引数に値型の`query.Values`を宣言すると、ランタイムがリクエストのクエリ値を注入します。

```go
import "github.com/NARUBROWN/spine/pkg/query"
```

## 公開API

| シグネチャ | 戻り値とデフォルトの動作 |
| --- | --- |
| `NewValues(values map[string][]string) Values` | 指定したマップで生成した値 |
| `(q Values) Get(key string) string` | 最初の値。存在しない場合は空文字列 |
| `(q Values) String(key string) string` | `Get`と同じ動作 |
| `(q Values) Int(key string, def int64) int64` | 10進整数。値が存在しないか、変換に失敗した場合は`def` |
| `(q Values) GetBoolByKey(key string, def bool) bool` | 真偽値。認識できない場合は`def` |
| `(q Values) Has(key string) bool` | 値にかかわらず、キーが存在するかどうか |

`Values`のフィールドは公開していません。値を読み取るメソッドだけを提供し、値の取得時は同じキーの最初の値を使用します。繰り返し指定された値をすべて読み取る必要がある入力解釈コードでは、`core.HttpRequestContext.Queries()`を使用します。

## コンストラクタ

### NewValues

```go
func NewValues(values map[string][]string) Values
```

`Values`を生成します。コントローラーから直接呼び出す必要はなく、独立した値やテスト入力を作成するときに使用できます。

**引数**

- `values` - クエリパラメータのマップ

**戻り値**

- `Values` - 生成したクエリ値

## メソッド

### Get

```go
func (q Values) Get(key string) string
```

指定したキーの最初の値を返します。

**引数**

- `key` - クエリパラメータのキー

**戻り値**

- `string` - 値。キーが存在しない場合は空文字列

**例**

```go
// GET /user?name=john
q.Get("name")     // "john"
q.Get("missing")  // ""
```

### String

```go
func (q Values) String(key string) string
```

指定したキーの最初の値を文字列で返します。`Get()`と同じ実装です。

**引数**

- `key` - クエリパラメータのキー

**戻り値**

- `string` - 値。キーが存在しない場合は空文字列

**例**

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

指定したキーの最初の値を10進の`int64`に変換します。キーが存在しない場合、値が空の場合、範囲外の場合は`def`を返します。

**引数**

- `key` - クエリパラメータのキー
- `def` - 解析に失敗した場合、またはキーが存在しない場合に返すデフォルト値

**戻り値**

- `int64` - 解析した整数またはデフォルト値

**例**

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

指定したキーの最初の値を真偽値に変換します。大文字と小文字は区別しません。

**trueとして認識する値**（大文字と小文字を区別しません）

- `"true"`, `"1"`, `"yes"`, `"y"`, `"on"`

**falseとして認識する値**（大文字と小文字を区別しません）

- `"false"`, `"0"`, `"no"`, `"n"`, `"off"`

上記に該当しない値は、デフォルト値を返します。

**引数**

- `key` - クエリパラメータのキー
- `def` - 解析に失敗した場合、またはキーが存在しない場合に返すデフォルト値

**戻り値**

- `bool` - 解析した真偽値またはデフォルト値

**例**

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

指定したキーが存在するかどうかを確認します。

**引数**

- `key` - クエリパラメータのキー

**戻り値**

- `bool` - キーの存在有無

**例**

```go
// GET /user?status=active&empty=
q.Has("status")  // true
q.Has("empty")   // true (값이 비어도 키는 존재)
q.Has("missing") // false
```

## コントローラーでの使用

[最初のアプリを作成する](/ja/learn/getting-started/first-app)と[コントローラー](/ja/learn/tutorial/2-controller)の`src/user`リソースを拡張する例です。`User`、`Product`、検索結果の型、サービスの検索メソッドはアプリで実装します。各ハンドラーは独立した例のため、必要なメソッドとルートだけを追加してください。

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

## 制約とエラー

- 自動注入は、値型の`query.Values`をサポートします。`*query.Values`を宣言しないでください。
- HTTP入力でだけ自動注入します。イベントコンシューマーとWebSocketメッセージのコンテキストでは、`HttpRequestContext`への型アサーションができず、入力の解釈に失敗します。
- `Int`と`GetBoolByKey`はエラーを返しません。不正な値と省略された値を区別する必要がある場合は、`Has`と`Get`で確認し、アプリで検証してください。
- `Get`と`String`は、値が空文字列の場合とキーが存在しない場合を区別しません。`Has`は、`?empty=`のように値が空でも`true`を返します。
- 真偽値の前後の空白は取り除きません。たとえば、`" true "`は認識できないため`def`を返します。
- `NewValues`は、受け取ったマップをコピーしません。生成後に元のマップを変更すると、取得結果も変わります。

実装は、[クエリヘルパー](https://github.com/NARUBROWN/spine/blob/v0.6.0/pkg/query/types.go)と[自動注入のコード](https://github.com/NARUBROWN/spine/blob/v0.6.0/internal/resolver/query_values_resolver.go)で確認できます。

## 関連情報

- `query.Pagination`: ページ番号とサイズを読み取るヘルパー
- [実行パイプライン](/ja/learn/core-concepts/pipeline): 引数を解釈する順序
