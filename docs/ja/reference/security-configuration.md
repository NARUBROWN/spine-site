# セキュリティ設定

Spine v0.5.1は、ブローカーへの暗号化接続と、HTTPおよびWebSocketのサイズ、時間、接続数の制限をデフォルトで適用します。このリファレンスでデフォルト値と設定の制約を確認し、デプロイするアプリのオリジン、認証、メッセージ失敗ポリシーを選択してください。

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

エラーは`*boot.ConfigError`として返します。`Issues`の各`ConfigIssue`は、次のフィールドを提供します。プログラムでエラーを分類するときは、メッセージを解析せずに`Code`を使用してください。ブローカーURLの認証情報は、設定エラーに公開しません。

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
| RabbitMQ発行 | メッセージの永続化、必須ルーティング、パブリッシャー確認、有限回の再試行 | `PublisherRetry` |
| RabbitMQの処理失敗 | 再キューイングせずに拒否 | `FailurePolicy` |
| RabbitMQの同時処理 | コンシューマーごとに未確認メッセージ1件 | 正の`PrefetchCount` |
| コンシューマーのトランスポート障害 | 指数バックオフとジッターを適用してリーダーを再生成 | `ConsumerRetry` |
| WebSocketのオリジン | ブラウザーのリクエストは、プロトコルとホストが同じオリジンだけを許可 | `AllowedOrigins` |
| WebSocketの接続数 | 接続と接続待ちリクエストを合わせて1024件 | 正の`MaxConnections`または`boot.UnlimitedWebSocketConnections` |
| WebSocketの接続認証 | オプションのインターフェースを実装したインターセプターだけをアップグレード前に実行 | `core.WebSocketHandshakeInterceptor`を実装 |
| グローバルインターセプター | HTTPとWebSocketの両方に適用 | `InterceptorFor`でスコープを制限 |
| 認証情報を許可するCORS | 明示的なオリジンが必要 | `*`と`AllowCredentials: true`は併用不可 |
| Cookie | レスポンスの書き込み前に無効なフィールドを拒否 | 任意の値を保持する必要がある場合は`httpx.EncodeCookieValue`を使用 |

## Kafka

`boot.KafkaOptions`の`Read`と`Write`は、独立して有効にします。いずれかを設定すると`Brokers`が必要になり、`Read`を使用する場合は`GroupID`も指定する必要があります。個別のトランスポート設定がない場合、コンシューマーとパブリッシャーの両方にTLS 1.2以上を適用します。

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    Read:  &boot.KafkaReadOptions{GroupID: "orders"},
    Write: &boot.KafkaWriteOptions{},
}
```

独自のCA、mTLS、SASLが必要な場合は、`TLS`、`Dialer`、`Transport`を設定します。有効にした役割に明示的なTLSと`AllowInsecureTransport`を併せて設定すると、`KAFKA_TLS_INSECURE_CONFLICT`エラーが発生します。平文接続は、隔離されたローカル開発環境だけで明示的に許可してください。

```go
Kafka: &boot.KafkaOptions{
    Brokers:                []string{"localhost:9092"},
    AllowInsecureTransport: true,
    Read:                   &boot.KafkaReadOptions{GroupID: "local"},
}
```

リーダーのエラーやACK/NACKの失敗後は、`ConsumerRetry`に従って既存のリーダーを閉じ、新しいリーダーを作成します。このオプションはトランスポート層の再接続を制御し、ハンドラーのメッセージ処理ポリシーは変更しません。

| `ConsumerRetryOptions`フィールド | 型 | デフォルト値 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5秒 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2、つまり20% |
| `MaxAttempts` | `int` | `0`、無制限に再試行 |

各フィールドの`0`は、デフォルト値を選択します。負の値は許可しません。明示した遅延の上限は初回の遅延以上、倍率は1以上、ジッターは0から1の範囲である必要があります。同じオプションをRabbitMQコンシューマーにも適用します。

Kafkaハンドラーは、再配信を考慮して冪等に実装する必要があります。恒久的に処理できないメッセージを自動でスキップしたり、別の失敗キューに送信したりすることはありません。

## RabbitMQ

本番環境のURLには`amqps://`を使用します。有効にした`Read`と`Write`には、それぞれ`Exchange`が必要です。デフォルトの失敗ポリシーは、再キューイングを伴わない拒否です。

```go
RabbitMQ: &boot.RabbitMqOptions{
    URL: "amqps://user:pass@rabbit.example/vhost",
    PublisherRetry: boot.PublisherRetryOptions{
        InitialDelay:   200 * time.Millisecond,
        MaxDelay:       5 * time.Second,
        MaxAttempts:    5,
        ConfirmTimeout: 5 * time.Second,
    },
    Read: &boot.RabbitMqReadOptions{
        Exchange:      "events",
        PrefetchCount: 16,
        FailurePolicy: boot.RabbitMqFailureReject,
        DeadLetter: &boot.RabbitMqDeadLetterOptions{
            Exchange:   "events.dlx",
            RoutingKey: "events.failed",
        },
    },
    Write: &boot.RabbitMqWriteOptions{Exchange: "events"},
}
```

| 読み取り設定 | デフォルト値と制約 |
| --- | --- |
| `PrefetchCount` | `0`の場合、コンシューマーごとに未確認メッセージ1件。直接指定する場合は正の値 |
| `FailurePolicy` | 省略時は`boot.RabbitMqFailureReject`。再キューイングする場合は`boot.RabbitMqFailureRequeue` |
| `DeadLetter` | デフォルトは`nil`。設定する場合は、事前に作成したDLXの`Exchange`が必要。`RoutingKey`も指定可能 |
| `RequeueOnError` | 以前のバージョンとの互換性のための設定。`true`の場合は再キューイング。明示した`FailurePolicy`と競合すると設定エラー |

DLXは、処理できなかったメッセージを受け取るエクスチェンジです。運用者が先に作成する必要があり、対応するDLX構成がない場合、拒否したメッセージが破棄されることがあります。既存キューの引数と新しい設定が異なると、RabbitMQがキュー宣言の条件不一致エラーを返す場合があります。

`RabbitMqFailureRequeue`を使用すると、処理できないメッセージが無期限に再配信される場合があります。新しい構成では、拒否ポリシーとDLXを使用してください。`RequeueOnError`は非推奨化される予定です。新しいコードでは`FailurePolicy`を使用します。ハンドラーの選択に使うキーは、AMQPの`Type`ではなく、キューをバインドした`RoutingKey`です。

パブリッシャーは、永続メッセージ、`mandatory=true`、パブリッシャー確認を使用します。メッセージをルーティングできない場合や、確認が拒否または消失した場合は、成功として扱いません。確認の消失後に再試行すると、同じメッセージを重複して発行する可能性があるため、コンシューマーは冪等である必要があります。

| `PublisherRetryOptions`フィールド | 型 | デフォルト値 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5秒 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2、つまり20% |
| `MaxAttempts` | `int` | 合計3回の試行 |
| `ConfirmTimeout` | `time.Duration` | 5秒 |

各フィールドの`0`は、デフォルト値を選択します。負の値は許可しません。遅延の範囲、倍率、ジッターの制約は`ConsumerRetryOptions`と同じです。`MaxAttempts`を増やす場合は、重複発行の可能性も考慮する必要があります。

## WebSocket

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

## 運用時の制約

- `WEBSOCKET_CAPACITY_EXCEEDED`、コンシューマーの再接続試行回数が上限に達した状態、RabbitMQの`Type`と`RoutingKey`の不一致を監視します。
- KafkaとRabbitMQのコンシューマーは冪等に実装します。Kafkaで処理できないメッセージへの対応手順と、RabbitMQのDLXを運用する手順も準備します。
- 実際のソケット書き込みとブローカーへの発行は、DBコミットと原子的にまとめられるわけではありません。原子性が必要な場合は、トランザクショナルアウトボックスと冪等キーを使用します。
- サポートするバージョンは、[現在のリリース](/ja/community/changelog)で確認してください。
