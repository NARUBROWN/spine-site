# ハンドラーメタデータ

::: info 0.7.5
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

`core.HandlerMeta` はハンドラー情報のコピーです。実行登録や writer を変更するものではありません。

## フィールド {#fields}

```go
type HandlerMeta struct {
	ControllerType   reflect.Type
	MethodName       string
	Signature        reflect.Type
	PathKeys         []string
	InterceptorTypes []reflect.Type
	CallbackRoute    bool
}
```

## 参照 {#methods}

`FunctionType()` は関数型を返します。`ArgumentOffset()` はコールバックで 0、従来のメソッド式で 1 です。コールバックの `HandlerName()` は固有識別子ではなくコントローラーの RegisterRoutes 名を返します。PathKeys は値でなくキー名です。削除された Method、Callback、Interceptors の代わりに公開参照と InterceptorTypes を使います。

## タイミングと有効期間 {#lifetime}

グローバル PreHandle はルーティング前の空メタデータを受け取ります。ルート PreHandle は選択済みメタデータを受け取り、バインディング前に実行します。フィールドやスライスを変更しても登録は変わりません。リクエスト情報は Ctx の公開ビューから参照します。

[公開コンテキスト](/ja/reference/api/execution-context) | [インターセプター](/ja/learn/tutorial/4-interceptor)
