# 実行パイプライン

::: info 0.7.5
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

## 実行順序 {#order}

```text
Global PreHandle
→ Route selection
→ Route PreHandle
→ Input binding and validator
→ Handler
→ Response preparation and success hooks
→ PostHandle (reverse)
→ BeforeResponse (reverse)
→ Error rendering and response flush
→ AfterCompletion (reverse)
→ Store and multipart cleanup
```

グローバルとルートの PreHandle はどちらも本体バインディング前に実行され、解析前に認証エラーを返せます。PostHandle は成功後処理です。BeforeResponse は PreHandle に成功したものだけを逆順で実行し、直列化、Cookie、ステータス検証のエラーも受け取ります。ここでコミットまたはロールバックし、失敗を返します。PreHandle に到達しなかったものにも AfterCompletion が呼ばれる場合があるため、リソースの有無を確認します。

## 契約 {#contract}

```go
import (
	"github.com/NARUBROWN/spine/core"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type Interceptor interface {
	PreHandle(ctx spinectx.Ctx, meta core.HandlerMeta) error
	PostHandle(ctx spinectx.Ctx, meta core.HandlerMeta)
	BeforeResponse(ctx spinectx.Ctx, meta core.HandlerMeta, executionErr error) error
	AfterCompletion(ctx spinectx.Ctx, meta core.HandlerMeta, err error)
}
```

## 適用範囲 {#scope}

このサイトの例では、すべてのインターセプターを先に `app.Constructor` に登録します。`Constructor` メソッドを実装した独自のインターセプターは `constructor.Interceptor(&Auth{})` で登録し、適用時は `(*Auth)(nil)` のような typed nil を渡してコンテナーから取得します。適用 API に `&Auth{}` を直接渡すと、現在の実装ではコンストラクターを経由せずにそのオブジェクトが実行されるため使用しません。登録と適用範囲の指定は別の手順です。

```go
app.Constructor(constructor.Interceptor(&AuthInterceptor{}))
app.InterceptorFor(boot.InterceptorHTTP, (*AuthInterceptor)(nil))
```

```go
app.Constructor(
	constructor.Interceptor(&AuthInterceptor{}),
	constructor.Interceptor(&AuditInterceptor{}),
)
```

```go
func (*UserController) RegisterRoutes(r *api.Registry) {
	auth := (*AuthInterceptor)(nil)
	audit := (*AuditInterceptor)(nil)
	users := r.Group("/users", api.Interceptors(auth))
	users.GET("/", func() httpx.Response[[]int64] {
		return httpx.Response[[]int64]{Body: []int64{1}}
	})
	users.DELETE("/:id", func() httpx.Response[struct{}] {
		return httpx.Response[struct{}]{Options: httpx.ResponseOptions{Status: 204}}
	}, api.Interceptors(audit))
	r.GET("/profile", func() httpx.Response[string] {
		return httpx.Response[string]{Body: "profile"}
	}, api.Interceptors(auth))
}
```

この例を使うには、Auth と Audit のインターセプターを DI に登録します。同じポリシーをグローバルとルートに重複適用しないでください。役割登録は DI の提供で、適用範囲は別です。子グループは設定を継承し、ルートのオプションは追加されます。グローバル範囲は InterceptorHTTP、InterceptorWebSocket、InterceptorAll で、All と app.Interceptor は HTTP と WS メッセージに適用します。

<span id="error-responses"></span>

## エラーとトランザクション {#errors}

ハンドラーとインターセプターがともに失敗した場合、HTTP 応答はインターセプターのエラーを優先します。最後に失敗した BeforeResponse が応答を決め、以前のエラーも完了フックに保持します。HTTPError は 400～599 のみで、一般エラーや不正なステータスは内部情報を隠した 500 です。DB コミット、イベント発行、ソケット送信は一つの原子的トランザクションではありません。

[完全な例](/ja/learn/tutorial/4-interceptor) | [トランザクション](/ja/learn/tutorial/6-transaction)
