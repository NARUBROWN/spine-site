# v0.7.1 のコントローラーとルート移行

このガイドは Spine `v0.7.1` を対象とします。コアは Go 1.25.5 以上、playground バリデーターは Go 1.26 以上が必要です。

## コントローラーにルートを登録 {#routes}

v0.7.1 では `app.Route` と、生成関数、別の route.go、メソッド式を使う HTTP コントローラー方式が Deprecated です。移行期間中は利用でき、削除バージョンは未定です。一般的な DI 生成関数は Deprecated ではありません。

これは登録例であり単独で動作するアプリではありません。HTTP プラットフォームと実行設定を追加してください。

```go
import (
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type UserPath struct { ID int64 `path:"id"` }
type User struct { ID int64 `json:"id"` }

func (*UserController) Constructor() *UserController { return &UserController{} }

func (c *UserController) RegisterRoutes(r *api.Registry) {
    users := r.Group("/users", api.Tags("Users"))
    users.GET("/:id",
        func(p input.Path[UserPath]) httpx.Response[User] {
            return httpx.Response[User]{Body: User{ID: p.ID}}
        }, api.Summary("Get user"))
}

func register(app interface{ Constructor(...any) }) {
    app.Constructor(constructor.Controller(&UserController{}))
}
```

既存メソッドの処理を残し、コールバックから呼び出せます。旧方式と新方式は共存できますが、同じメソッドとパスを重複登録すると準備時に拒否されます。移行した旧登録を削除してください。`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` を利用できます。

## 生成と役割 {#constructors}

`app.Constructor` は `constructor.Custom`, `Repository`, `Service`, `Controller`, `Interceptor` の役割登録と既存の生成関数を受け取ります。オブジェクト登録には構造体ポインターと非可変長の `Constructor(依存...) *自身の型` が必要です。登録値のフィールドはコピーされず、生成結果はアプリごとにキャッシュされます。`Custom` は単一戻り値の既存生成関数も受け付けます。

Controller は `RegisterRoutes(*api.Registry)` を持つ `api.Controller`、Interceptor は `core.Interceptor` も実装します。Interceptor の DI 登録とグローバルまたはルートへの適用は別です。生成契約と依存関係は起動前に検査し、nil 戻り値とパニックは実際の生成時に検出します。

## 入力とグループ {#groups}

`input.Query[T]` と `input.Body[T]` の `T` は構造体です。パスとクエリはタグを優先し、タグがない場合は lowerCamel を使います。ヘッダーは `header` タグ付きの別の構造体ポインターで受け取ります。

v0.7.1 ではパス変数ごとにスカラー `input.Path[T]` 引数をルートの順に宣言します。数を一致させ、同じハンドラーでパス DTO や従来のパスラッパーと混在させないでください。

グループと Registry はどちらも `GET(path, handler, options...)` の順に指定します。グループは接頭辞とタグを継承し、`api.Interceptors(...)` を追加できます。`example` と `description` は文書用で、実行時のデフォルト値や検証規則ではありません。

## Deprecated 入力と互換性 {#deprecated}

`path.Int`, `path.String`, `path.Boolean`, `query.Values`, `header.Values`, 各 Values の生成と参照 API、`query.Pagination` は Deprecated です。同一ハンドラーで新しい Path, Query, Header DTO と混在させると準備時に拒否されます。既存の本文 DTO と context は利用できます。互換パス `adapter`, `adapter/http`, `adapter/event`, `adapter/websocket` も Deprecated です。用途に応じて `contract/http`, `contract/event`, `contract/validator`, `contract/websocket` を使用してください。HTTP v2 実装は v3 に自動変換されません。

## 仕様と検証 {#verification}

新しいコントローラーを持つアプリでは、準備前の `spine.DescribeHTTP` は `spine.ErrRoutesNotCollected` を返します。呼び出し側が `app.Prepare` の後に `spine.DescribePreparedHTTP` で取得し、準備結果を閉じます。準備時に DB やブローカーが初期化されることがあります。CLI の静的解析はユーザーコードを実行せず、動的なパスやインターセプター一覧を解決できない場合があります。`--source runtime` も自動で Prepare しません。

静的 OpenAPI はバリデーターを実行せず制約を確定しません。選択したバリデーターを反映する仕様は準備済みアプリで確認してください。未対応の例や規則は診断される場合があり、メール、URI、UUID、正規表現の同等性は保証されません。整数の範囲は仕様に正確に保持されます。

移行後に `spine contract check` と `spine verify` を実行し、実際の HTTP リクエストと仕様を確認してください。入力移行と HTTP v3 の制約は次の文書を参照してください。

- [v0.7.1](/ja/learn/migration/v0.7.1-preview)
- [HTTP v3](/ja/learn/migration/preview-features#body)
