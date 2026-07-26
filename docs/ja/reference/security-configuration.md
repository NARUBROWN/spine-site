# セキュリティ設定

Spine v0.5.1は、安全な通信と制限付きランタイムをデフォルトで使用します。デプロイ前に`App.Validate`で設定を検査でき、`App.Run`もネットワーク接続を開く前に同じ検証を自動的に実行します。

```go
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

検証エラーは`*boot.ConfigError`です。`Issues`内の各`ConfigIssue`には`Path`、`Code`、`Message`、`Hint`が含まれます。自動化では安定した`Code`を使用し、人向けのメッセージを解析しないでください。Broker URLの認証情報はエラーに含まれません。

## 安全なデフォルト

|領域|デフォルト|明示的な開発・互換設定|
|---|---|---|
| Kafka |有効なreader/writerにTLS 1.2以上を適用|カスタム`TLS`/`Dialer`/`Transport`、またはローカル専用の`AllowInsecureTransport: true`|
| RabbitMQ |`amqps://`が必須|`amqp://`と`AllowInsecureTransport: true`|
| RabbitMQ publish |persistent、mandatory routing、publisher confirm、有限の再試行|`PublisherRetry`を調整|
| RabbitMQ handler失敗|再キューせずreject|`FailurePolicy: boot.RabbitMqFailureRequeue`|
| RabbitMQ prefetch |consumerごとに未確認メッセージ1件|正の`PrefetchCount`|
| Consumer通信失敗|指数バックオフとjitterでreaderを再生成|`ConsumerRetry`を調整|
| WebSocket Origin |schemeとhostが一致する同一Originのみ許可|正確な`AllowedOrigins`を指定|
| WebSocket容量|接続および待機中handshakeを合わせて1024件|正の上限、または`boot.UnlimitedWebSocketConnections`|
| WebSocket認証|任意のhandshake interceptorがupgrade前に実行|認証が必要なrouteで`WebSocketHandshakeInterceptor`を実装|
|グローバルinterceptor|HTTPとWebSocketの両方に適用|`InterceptorFor`で範囲を限定|
|credentials付きCORS|明示的なOriginが必須|`*`とcredentialsの組み合わせは無効|
| Cookie |応答を書き込む前に不正なフィールドを拒否|任意値は`httpx.EncodeCookieValue`でエンコード|

## Kafka

通信設定を省略すると、consumerとpublisherの両方にTLS 1.2以上が適用されます。

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    Read:  &boot.KafkaReadOptions{GroupID: "orders"},
    Write: &boot.KafkaWriteOptions{},
}
```

カスタムCA、mTLS、SASLが必要な場合に限り`TLS`、`Dialer`、`Transport`を上書きしてください。明示的なTLSと`AllowInsecureTransport`を同時に設定すると`KAFKA_TLS_INSECURE_CONFLICT`になります。平文接続は隔離されたローカル開発環境でのみ明示的に許可してください。

```go
Kafka: &boot.KafkaOptions{
    Brokers:                []string{"localhost:9092"},
    AllowInsecureTransport: true,
    Read:                   &boot.KafkaReadOptions{GroupID: "local"},
}
```

readerエラーまたはACK/NACK失敗の後は、`ConsumerRetry`に従って現在のreaderを閉じ、新しいreaderを作成します。デフォルトは初回100ms、最大5秒、倍率2、jitter 20%、無制限の再試行です。Kafka handlerは再配信を前提に冪等に実装してください。ランタイムは恒久的に失敗するメッセージを自動的にskipしたりDLQへ送ったりしません。

## RabbitMQ

本番URLには`amqps://`を使用します。デフォルトの失敗ポリシーは、再キューなしのrejectです。

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

DLX exchangeは運用側で先に作成する必要があります。既存queueの引数が異なるとRabbitMQはqueue preconditionエラーを返すことがあります。`RabbitMqFailureRequeue`はpoison messageを無期限に再配信できるため、新しい設定ではrejectとDLXを使用してください。`RequeueOnError`は非推奨であり、新しいコードでは`FailurePolicy`を使用します。dispatch keyはAMQPの`Type`ではなくqueue bindingの`RoutingKey`です。

Publisherはpersistentメッセージ、`mandatory=true`、publisher confirmを使用します。routing不能、negative/missing confirmは成功ではありません。confirm消失後の再試行は重複publishを起こし得るため、consumerは冪等にしてください。

## WebSocket

正確なOriginと接続上限を指定することを推奨します。

```go
HTTP: &boot.HTTPOptions{
    WebSocket: boot.WebSocketOptions{
        AllowedOrigins: []string{"https://app.example.com"},
        MaxConnections: 4096,
    },
},
```

`AllowedOrigins`が空の場合、ブラウザ要求はschemeとhostの両方が一致する必要があります。TLS終端proxyの背後では`TrustedProxyCIDRs`を指定できます。`Forwarded`と`X-Forwarded-Proto`は接続相手がこの一覧に含まれる場合のみ信頼されます。proxyは外部から届いたforwarded headerを削除または上書きしてください。

接続上限のデフォルトは`boot.DefaultWebSocketMaxConnections`（1024）です。認証待ちのhandshakeも上限に含まれます。超過した要求はupgradeされず、HTTP 503、`Retry-After`、`WEBSOCKET_CAPACITY_EXCEEDED` JSONを受け取ります。

認証interceptorは`core.WebSocketHandshakeInterceptor`も実装してください。接続slotは`PreHandshake`より先に予約され、`PreHandshake`はHTTP upgradeより前に実行されます。

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

handshakeとmessageのcontextは、header、query、cookie、remote address、host、request URIの不変snapshotを提供します。

## CORSとCookie

`AllowOrigins: []string{"*"}`と`AllowCredentials: true`の組み合わせは無効です。起動時に検査するには`cors.NewValidated`を使用してください。従来の`cors.New`も最初の要求で応答headerを書き込む前に構造化エラーを返します。

```go
corsInterceptor, err := cors.NewValidated(cors.Config{
    AllowOrigins:     []string{"https://app.example.com"},
    AllowCredentials: true,
})
```

Cookieの名前、値、path、domain、SameSite、Priorityが不正な場合、JSON、文字列、binary、redirect handlerはheaderやbodyを書き込む前に失敗します。Unicodeや区切り文字を往復させる必要がある場合のみ`httpx.EncodeCookieValue`と`httpx.DecodeCookieValue`を使用してください。

## 運用チェック

- `WEBSOCKET_CAPACITY_EXCEEDED`、consumer再接続の枯渇、RabbitMQの`Type`/`RoutingKey`不一致を監視します。
- Kafka/RabbitMQ consumerを冪等にし、Kafkaのpoison messageとRabbitMQ DLXの運用手順を準備します。
- 実際のsocket writeやbroker publishはDB commitと原子的には結合できません。原子性が必要ならtransactional outboxと冪等性キーを使用します。
- 対応バージョンは[現在のリリース](/ja/community/changelog)で確認してください。
