# core.Interceptor

コントローラーの実行前後に、認証、ログ出力、CORS、トランザクション処理を追加するインターフェースです。Spine v0.7.1では、事前処理、成功後の処理、レスポンス前の処理、最終的なクリーンアップをそれぞれ実装します。

## インターフェース

```go
import "github.com/NARUBROWN/spine/core"

type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    BeforeResponse(ctx ExecutionContext, meta HandlerMeta, executionErr error) error
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

| メソッド | 呼び出しのタイミング | 戻り値 |
| --- | --- | --- |
| `PreHandle` | コントローラーの実行前。登録順 | `nil`の場合は続行、エラーの場合は中断 |
| `PostHandle` | コントローラー、レスポンスの準備、実行後フックが成功した後。登録の逆順 | なし |
| `BeforeResponse` | 実際のレスポンスの書き込み前。`PreHandle`が成功したインターセプターを逆順に実行 | エラーがある場合は最終的な実行エラーに含める |
| `AfterCompletion` | レスポンス処理後。成功と失敗にかかわらず登録の逆順 | なし |

## ライフサイクルと実装例

次の例の`auth`、`transactionFrom`、トランザクションの実装はアプリで提供します。`core.Interceptor`として登録するには、4つのメソッドのシグネチャをすべて実装する必要があります。

### PreHandle

コントローラーの呼び出し前に登録順で実行します。`nil`を返すと次の段階に進み、通常のエラーを返すと失敗します。`core.ErrAbortPipeline`を返すと、コントローラーを呼び出さずに正常に中断します。

グローバルインターセプターはルーティング前に実行されるため、空の`HandlerMeta{}`を受け取ります。ルートインターセプターはルーティングと入力値の解釈後に実行され、対象ハンドラーの情報を受け取ります。

```go
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("認証が必要です")
    }
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("無効なトークンです")
    }
    ctx.Set("auth.user", user)
    return nil
}
```

### PostHandle

コントローラーの戻り値をレスポンスとして準備し、実行後フックまで成功した後に逆順で実行します。エラーを返せないため、成功ログや観測用の処理に使用します。

```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s prepared", ctx.Method(), ctx.Path())
}
```

### BeforeResponse

レスポンスを実際のトランスポート層に書き込む前に、逆順で実行します。`executionErr`には、事前処理、ルーティング、入力値の解釈、コントローラー、レスポンスの準備、実行後フックで、この時点までに発生したエラーが渡されます。先に実行した`BeforeResponse`が返したエラーもまとめて、次のインターセプターに渡します。

リクエストスコープのトランザクションは、この段階でコミットまたはロールバックしてください。v0.7.1はレスポンスのシリアライズと、Cookieおよびステータスコードの検証を先に行うため、レスポンスの準備に失敗した場合にロールバックできます。

```go
func (i *TxInterceptor) BeforeResponse(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    executionErr error,
) error {
    tx, ok := transactionFrom(ctx)
    if !ok {
        return nil
    }
    if executionErr != nil {
        return tx.Rollback()
    }
    return tx.Commit()
}
```

### AfterCompletion

成功と失敗にかかわらず、レスポンス処理後に逆順で呼び出します。最終的な`err`を受け取り、ログ出力、メトリクスの収集、リソースの解放に使用します。レスポンスの送信結果も、この段階で確認できます。トランザクションをコミットするかどうかは、前の段階ですでに決定している必要があります。

```go
func (i *LoggingInterceptor) AfterCompletion(
    ctx core.ExecutionContext,
    meta core.HandlerMeta,
    err error,
) {
    if err != nil {
        log.Printf("[ERR] %s %s: %v", ctx.Method(), ctx.Path(), err)
    }
}
```

## 登録とスコープ

`app.Interceptor`は`app.InterceptorFor(boot.InterceptorAll, ...)`と同じです。HTTPリクエストとWebSocketメッセージの両方に適用し、イベントコンシューマーには適用しません。HTTPレスポンスを扱うCORSのように、特定のトランスポートに依存する場合はスコープを指定してください。

| スコープ | 適用対象 |
| --- | --- |
| `boot.InterceptorHTTP` | HTTPリクエスト |
| `boot.InterceptorWebSocket` | WebSocketメッセージとオプションの接続前処理 |
| `boot.InterceptorAll` | 両方のスコープ |

新しいコントローラーは `RegisterRoutes` で `api.Interceptors` を使い、ルートインターセプターを指定します。以下の `r` は `*api.Registry`、`handler` はアプリが定義したハンドラーです。DI を使う場合はインターセプターの生成子も登録します。[実行例](/ja/learn/tutorial/4-interceptor)を参照してください。

```go
app.InterceptorFor(boot.InterceptorAll, auth)
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
app.InterceptorFor(boot.InterceptorWebSocket, wsRateLimiter)

r.GET("/admin/users/:id", handler,
    api.Interceptors((*AuthInterceptor)(nil)),
)
```

`(*AuthInterceptor)(nil)`のような型付きnilポインターを登録すると、コンテナからその型のインスタンスを取得して使用します。同じ型のnilポインターは、コンテナの共有インスタンスを使用します。

グローバルインターセプターに同じポインターを複数のスコープで登録すると、スコープをまとめて1回実行します。同じ型でも、異なるポインターはそれぞれ実行します。値型も、登録した項目ごとにそれぞれ実行します。

### DI でルートインターセプターを登録する

この独立アプリは `constructor.Interceptor` で生成契約を登録し、`api.Interceptors` に型付き nil ポインターを渡します。Spine `v0.7.1` と互換 Echo プラットフォームのある別の Go モジュールで実行してください。トークンはデモ専用です。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/core"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	"log"
)

type Auth struct{}

func (*Auth) Constructor() *Auth { return &Auth{} }

func (*Auth) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
	if ctx.Header("Authorization") != "Bearer demo-token" {
		return httperr.Unauthorized("unauthorized")
	}
	return nil
}
func (*Auth) PostHandle(core.ExecutionContext, core.HandlerMeta)                  {}
func (*Auth) BeforeResponse(core.ExecutionContext, core.HandlerMeta, error) error { return nil }
func (*Auth) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error)      {}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/users/:id", func(id input.Path[int64]) httpx.Response[map[string]int64] {
		return httpx.Response[map[string]int64]{Body: map[string]int64{"id": *id}}
	}, api.Interceptors((*Auth)(nil)))
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Interceptor(&Auth{}))
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

認証なしのリクエストは 401、デモトークンを送ると 200 とユーザー ID が返ります。

```bash
curl -i http://localhost:8080/users/1
curl -i -H 'Authorization: Bearer demo-token' http://localhost:8080/users/1
```

## WebSocket接続前の処理

接続認証が必要なインターセプターは、`core.Interceptor`に加えて次のオプションのインターフェースも実装します。

```go
type WebSocketHandshakeInterceptor interface {
    PreHandshake(ctx WebSocketHandshakeContext, meta HandlerMeta) error
}
```

接続枠を先に予約した後、HTTPアップグレード前に`PreHandshake`を実行します。そのため、認証待ちの接続リクエストも`MaxConnections`に含めます。`PreHandle`は接続ごとではなく、WebSocketメッセージごとに引き続き実行します。リクエストのヘッダー、クエリ、Cookieなどは、[`WebSocketHandshakeContext`](/ja/reference/api/execution-context#websocket-request-context)で読み取ります。

```go
func (i *AuthInterceptor) PreHandshake(
    ctx core.WebSocketHandshakeContext,
    meta core.HandlerMeta,
) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("missing credentials")
    }
    return i.verify(token)
}
```

## 実行順序

正常なHTTP処理の流れは次のとおりです。

```text
Global.PreHandle → Router → ArgumentResolver → Route.PreHandle
→ コントローラー → レスポンスの準備 → 実行後フック
→ Route.PostHandle → Global.PostHandle
→ Route.BeforeResponse → Global.BeforeResponse
→ 実際のレスポンスの書き込み
→ Route.AfterCompletion → Global.AfterCompletion
```

逆順で実行する各段階は、ルートインターセプターから始まり、グローバルインターセプターに続きます。ルーティング完了後の呼び出しでは、解決済みの`HandlerMeta`を受け取ります。

## 制約とエラー

- `BeforeResponse`は、`PreHandle`が`nil`を返したインターセプターだけを呼び出します。エラーや`core.ErrAbortPipeline`を返したインターセプターは対象に含めません。
- `AfterCompletion`は、グローバルインターセプターと、ルーティングで特定したルートインターセプターに対して実行します。そのインターセプターの`PreHandle`が実行されていなくても呼び出される場合があるため、リソースの存在を確認してから解放してください。
- ルートインターセプターの認証は、入力値の解釈後に実行します。入力値の解釈前に認証する必要がある場合は、グローバルインターセプターを使用してください。
- `core.ErrAbortPipeline`で中断する場合は、インターセプターが必要なレスポンスを準備する必要があります。コントローラーと、それ以降の成功時の処理段階は実行しません。
- DBコミット後に、実際のレスポンス送信が失敗する場合があります。`BeforeResponse`は、DBとネットワーク送信を原子的にまとめるものではありません。

具体的な早期終了とエラーの伝播は[v0.7.1のパイプライン実装](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/pipeline/pipeline.go)、接続前処理の順序は[WebSocketランタイムの実装](https://github.com/NARUBROWN/spine/blob/v0.7.1/internal/ws/runtime.go)を参照してください。

## 関連情報

- [実行パイプライン](/ja/learn/core-concepts/pipeline)
- [トランザクション管理](/ja/learn/tutorial/6-transaction)
- [現在のリリース](/ja/community/changelog)
