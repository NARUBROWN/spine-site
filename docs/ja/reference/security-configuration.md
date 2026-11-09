# セキュリティ設定

Spine `v0.7.1` は HTTP と WebSocket のサイズ、時間、接続数を制限します。ブローカーの転送方針は独立したプラットフォームが管理します。使用するバージョンと設定も確認してください。

## 設定の検証

`App.Validate`は、ネットワーク接続を開かずに起動オプションを検証します。`App.Run`も、起動前に同じ検証を行います。コンストラクタと依存関係の構成、ブローカー接続の成否は、この事前検証に含まれません。

```go
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

boot設定の失敗は `*boot.ConfigError.Issues` で確認します。外部プラットフォームの `NewFactory` が返す設定エラーも別途確認します。分類にはメッセージ文字列ではなく公開エラーとコードを使い、ブローカー認証情報をログに残しません。

| フィールド | 意味 |
| --- | --- |
| `Path` | 問題がある設定の位置 |
| `Code` | エラーの分類コード |
| `Message` | 人が読むためのエラーの説明 |
| `Hint` | 設定を修正する方法 |

## 安全なデフォルト値

| 領域 | デフォルトの動作 | 調整方法 |
| --- | --- | --- |
| HTTP | 読み取りと書き込みの時間、ヘッダーと本文のサイズを制限 | [`boot.HTTPOptions`](/ja/reference/api/spine-app#boot-options) |
| Kafka | 有効にしたコンシューマーとパブリッシャーにTLS 1.2以上を適用 | `TLS`、`Dialer`、`Transport`。ローカルの平文接続は`AllowInsecureTransport: true` |
| RabbitMQ接続 | `amqps://`が必須 | ローカルの平文接続は`amqp://`と`AllowInsecureTransport: true` |
| RabbitMQ発行 | persistent / mandatory / publisher confirm | `OperationTimeout` |
| RabbitMQの処理失敗 | 再キューイングせずに拒否 | `rabbitmqplatform.Config.FailurePolicy` |
| RabbitMQの同時処理 | コンシューマーごとに未確認メッセージ1件 | 正の`PrefetchCount` |
| コンシューマーのトランスポート障害 | 指数バックオフとジッターを適用してリーダーを再生成 | `spine.WithEventConsumerRetry` |
| WebSocketのオリジン | ブラウザーのリクエストは、プロトコルとホストが同じオリジンだけを許可 | `AllowedOrigins` |
| WebSocketの接続数 | 接続と接続待ちリクエストを合わせて1024件 | 正の`MaxConnections`または`boot.UnlimitedWebSocketConnections` |
| WebSocketの接続認証 | オプションのインターフェースを実装したインターセプターだけをアップグレード前に実行 | `core.WebSocketHandshakeInterceptor`を実装 |
| グローバルインターセプター | HTTPとWebSocketの両方に適用 | `InterceptorFor`でスコープを制限 |
| 認証情報を許可するCORS | 明示的なオリジンが必要 | `*`と`AllowCredentials: true`は併用不可 |
| Cookie | レスポンスの書き込み前に無効なフィールドを拒否 | 任意の値を保持する必要がある場合は`httpx.EncodeCookieValue`を使用 |

## Kafka

`kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"` をimportします。`Config.Consume` と `Config.Publish` で役割を選び、`Brokers` を指定します。コンシューマーには `GroupID` も必要です。以下は `BuildApplication` 内で使用し、`echoplatform`、`spine`、`boot`、`time` もimportします。

```go
factory, err := kafkaplatform.NewFactory(kafkaplatform.Config{
    Brokers: []string{"kafka.example.com:9093"},
    Consume: true,
    Publish: true,
    GroupID: "orders",
    TopicPrefix: "prod.",
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory,
    spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{MaxAttempts: 5}),
    spine.WithEventSettlementTimeout(5 * time.Second),
))
```

Kafkaプラットフォームは標準でTLS 1.2以上を適用します。CA、mTLS、SASLには `TLS`、`Dialer`、`Transport` を設定します。`AllowInsecureTransport: true` は隔離したローカル平文接続にのみ使い、明示的なTLSと併用しません。`NewFactory` は設定だけを検査します。`Prepare` と `Run` は登録されたコンシューマーのreaderを準備するときにブローカーとトピックを確認します。Kafka発行専用アプリは接続せずに起動できるため、実際の発行で接続と配送を別途確認してください。

`Config.TopicPrefix` は発行名と消費側の購読の両方に接頭辞を付けます。両factoryに `prod.` を設定する場合、アプリには `order.created` を登録し、ブローカーに `prod.order.created` を準備します。区切り文字は接頭辞に含めます。

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})` はリーダーやACK/NACKの失敗後の再接続を制御します。標準値は初回100ms、最大5秒、倍率2、ジッター0.2、`MaxAttempts: 0` による無制限の転送再試行です。ハンドラーの再試行回数やDLQ方針は設定しません。`WithEventSettlementTimeout` の標準ACK/NACK制限は5秒です。Kafkaは後続offsetのcommitで失敗レコードを飛ばさないため、処理不能なレコードがパーティションを止めることがあります。

## RabbitMQ

`rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"` をimportします。共通の `Config.Exchange` と `Consume`、`Publish` を設定します。標準では `amqps://` が必要です。ローカルの `amqp://` は `AllowInsecureTransport: true` で明示的に許可します。以下は `BuildApplication` 内で使います。

```go
factory, err := rabbitmqplatform.NewFactory(rabbitmqplatform.Config{
    URL: "amqps://user:pass@rabbit.example.com/vhost",
    Exchange: "events",
    Consume: true,
    Publish: true,
    PrefetchCount: 16,
    FailurePolicy: rabbitmqplatform.FailureReject,
    DeadLetter: &rabbitmqplatform.DeadLetter{
        Exchange: "events.dlx",
        RoutingKey: "events.failed",
    },
    OperationTimeout: 5 * time.Second,
})
if err != nil {
    return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory))
```

`PrefetchCount` を省略すると未確認メッセージはコンシューマーごとに1件です。標準方針は `rabbitmqplatform.FailureReject` です。`FailureRequeue` は処理不能なメッセージを無期限に再配信する可能性があります。`DeadLetter` の交換機は事前に準備します。`TopicPrefix` は発行routing keyと購読bindingに、`QueuePrefix` はキュー名に適用します。

発行器は永続メッセージ、mandatory routing、publisher confirmを使います。`OperationTimeout` の標準値は5秒です。失敗メッセージを自動再発行する `PublisherRetry` オプションはありません。確認喪失後のアプリによる再試行は重複を生むため、コンシューマーを冪等にします。

## WebSocket

HTTP は Echo または net/http、WebSocket は独立した Gorilla 実装を選びます。WebSocket ルートには HTTP upgrade 対応と WS factory が必要です。検証には `playground.New()` を `spine.WithValidator` に渡します。

`boot.HTTPOptions.WebSocket`でオリジン、接続数、メッセージの制限を設定します。アプリで使用する正確なオリジンと接続数の上限を指定してください。

```go
HTTP: &boot.HTTPOptions{
    WebSocket: boot.WebSocketOptions{
        AllowedOrigins: []string{"https://app.example.com"},
        MaxConnections: 4096,
    },
},
```

| `WebSocketOptions`フィールド | 型 | デフォルト値と制約 |
| --- | --- | --- |
| `MaxConnections` | `int` | `0`の場合は`boot.DefaultWebSocketMaxConnections`、つまり1024。正の値で制限し、`boot.UnlimitedWebSocketConnections`で制限解除 |
| `CapacityRetryAfter` | `time.Duration` | 5秒。接続数の上限超過時の`Retry-After`値。負の値は指定不可 |
| `AllowedOrigins` | `[]string` | 空の場合は同一オリジン。直接指定する場合は、パス、クエリ、フラグメントを含まない`http://`または`https://`のオリジン。`*`もサポートしますが、すべてのオリジンを許可 |
| `TrustedProxyCIDRs` | `[]string` | デフォルト値なし。転送ヘッダーを信頼するプロキシのCIDR一覧 |
| `MaxMessageBytes` | `int64` | 1 MiB。負の値は指定不可 |
| `HandshakeTimeout` | `time.Duration` | 10秒。負の値は指定不可 |
| `ReadTimeout` | `time.Duration` | 60秒。負の値は指定不可 |
| `WriteTimeout` | `time.Duration` | 10秒。負の値は指定不可 |
| `PingInterval` | `time.Duration` | 読み取り制限時間の半分。デフォルトの読み取り制限では30秒。負の値は指定不可 |

時間とサイズのフィールドの`0`は、デフォルト値を選択します。接続数の制限を解除する場合は、`-1`の代わりに名前付き定数`boot.UnlimitedWebSocketConnections`を使用してください。

`AllowedOrigins`が空の場合、ブラウザーのリクエストのプロトコルとホストが両方とも一致する必要があります。TLSを終端するプロキシの背後では、`TrustedProxyCIDRs`を指定できます。`Forwarded`と`X-Forwarded-Proto`は、リクエスト元がこの一覧に含まれる場合だけ信頼します。プロキシは、外部から受け取った転送ヘッダーを削除または上書きする必要があります。

接続数の上限には、認証待ちの接続リクエストも含めます。上限を超えたリクエストはアップグレードせず、HTTP 503、`Retry-After`ヘッダー、`WEBSOCKET_CAPACITY_EXCEEDED`コードを含むJSONを返します。

接続認証が必要な場合は、インターセプターに`core.WebSocketHandshakeInterceptor`も実装してください。`PreHandshake`は、接続枠を予約した後、HTTPアップグレード前に実行します。メッセージごとの`PreHandle`とは別の処理です。

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

接続前コンテキストとメッセージコンテキストは、元のリクエストのヘッダー、クエリ、Cookie、リモートアドレス、ホスト、リクエストURIを保持します。公開インターフェースは、[実行コンテキストリファレンス](/ja/reference/api/execution-context#websocket-request-context)を参照してください。

## CORSとCookie {#cors-cookies}

`AllowOrigins: []string{"*"}`と`AllowCredentials: true`は併用できません。起動段階で検証するには、`cors.NewValidated`を使用してください。`cors.New`も、最初のリクエストでレスポンスヘッダーを書き込む前に、構造化されたエラーを返します。

CORS プリフライトは `OPTIONS`、`Origin`、`Access-Control-Request-Method` がそろった場合に判定します。許可されたリクエストは 204、拒否された出所、メソッド、ヘッダーは 403 です。通常リクエストの許可されない出所には CORS 許可ヘッダーを返しませんが、CORS はサーバーの認証やアクセス制御の代わりにはなりません。

`MaxAge` は秒数のポインターです。nil はヘッダーを省略し、0 は明示的な 0 を送ります。`ExposeHeaders` は通常レスポンスで公開するヘッダーを指定し、`AllowOrigin` は静的リストで許可されない出所を追加で判定できます。認証情報の許可とワイルドカード出所は併用できません。

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
    AllowOrigins:     []string{"https://app.example.com"},
    AllowCredentials: true,
})
if err != nil {
    log.Fatal(err)
}
app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)
```

Cookieの名前、値、パス、ドメイン、`SameSite`、`Priority`が無効な場合、JSON、文字列、バイナリ、リダイレクトの各レスポンスは、ヘッダーや本文を書き込む前に失敗します。Unicodeや区切り文字を元の値に復元する必要がある場合は、`httpx.EncodeCookieValue`と`httpx.DecodeCookieValue`を使用してください。


### CORS プリフライトの確認

次の独立アプリを Spine `v0.7.1` と互換 Echo プラットフォームがある別の Go モジュールの `main.go` に保存して実行します。`Authorization` は許可ヘッダーに明示します。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/interceptor/cors"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/resource", func() httpx.Response[string] { return httpx.Response[string]{Body: "ok"} })
}
func main() {
	maxAge := 60
	policy, err := cors.NewValidated(cors.Config{
		AllowOrigins:     []string{"https://app.example.com"},
		AllowMethods:     []string{"GET"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           &maxAge,
	})
	if err != nil {
		log.Fatal(err)
	}
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}))
	app.InterceptorFor(boot.InterceptorHTTP, policy)
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

最初のリクエストは 204 と `Access-Control-Max-Age: 60`、二つ目は 403 を返します。

```bash
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization' http://localhost:8080/resource
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: DELETE' http://localhost:8080/resource
```

## 運用時の制約

- `WEBSOCKET_CAPACITY_EXCEEDED`、コンシューマー再接続の試行回数超過、readerやACK/NACKの失敗、イベント発行の失敗を監視します。
- KafkaとRabbitMQのコンシューマーは冪等に実装します。Kafkaで処理できないメッセージへの対応手順と、RabbitMQのDLXを運用する手順も準備します。
- 実際のソケット書き込みとブローカーへの発行は、DBコミットと原子的にまとめられるわけではありません。原子性が必要な場合は、トランザクショナルアウトボックスと冪等キーを使用します。
- サポートするバージョンは、[現在のリリース](/ja/community/changelog)で確認してください。
