# 安全性設定

Spine v0.6.0 預設套用訊息代理的加密連線，以及 HTTP 與 WebSocket 的大小、時間和連線數限制。請在此參考中確認預設值與設定限制，並選擇要部署之應用程式的來源、驗證與訊息失敗政策。

## 設定驗證

`App.Validate` 會檢查啟動選項，不會開啟網路連線。`App.Run` 也會在啟動前執行相同檢查。此預先驗證不包含建構函式與相依性組態，以及訊息代理連線是否成功。

```go
if err := app.Validate(options); err != nil {
    log.Fatal(err)
}
if err := app.Run(options); err != nil {
    log.Fatal(err)
}
```

錯誤以 `*boot.ConfigError` 回傳。`Issues` 中的每個 `ConfigIssue` 提供以下欄位。程式分類錯誤時，請使用 `Code`，不要解析訊息。設定錯誤不會洩露訊息代理 URL 中的憑證。

| 欄位 | 意義 |
| --- | --- |
| `Path` | 有問題的設定位置 |
| `Code` | 錯誤分類代碼 |
| `Message` | 供人閱讀的錯誤說明 |
| `Hint` | 修正設定的方法 |

## 安全的預設值

| 領域 | 預設行為 | 調整方式 |
| --- | --- | --- |
| HTTP | 限制讀取與寫入時間、標頭與本文大小 | [`boot.HTTPOptions`](/zh-Hant/reference/api/spine-app#boot-options) |
| Kafka | 對啟用的消費者與發布器套用 TLS 1.2 以上版本 | `TLS`、`Dialer`、`Transport`。本機明文連線使用 `AllowInsecureTransport: true` |
| RabbitMQ 連線 | 必須使用 `amqps://` | 本機明文連線使用 `amqp://` 與 `AllowInsecureTransport: true` |
| RabbitMQ 發布 | 訊息持久化、必要路由、發布確認與有限次重試 | `PublisherRetry` |
| RabbitMQ 處理失敗 | 拒絕且不重新入列 | `FailurePolicy` |
| RabbitMQ 並行處理 | 每個消費者 1 則未確認訊息 | 正數 `PrefetchCount` |
| 消費者傳輸失敗 | 以指數退避與抖動重新建立讀取器 | `ConsumerRetry` |
| WebSocket 來源 | 瀏覽器請求只允許通訊協定與主機相同的來源 | `AllowedOrigins` |
| WebSocket 連線數 | 連線與等待連線的請求合計 1024 個 | 正數 `MaxConnections` 或 `boot.UnlimitedWebSocketConnections` |
| WebSocket 連線驗證 | 只有實作選用介面的攔截器會在升級前執行 | 實作 `core.WebSocketHandshakeInterceptor` |
| 全域攔截器 | 同時套用至 HTTP 與 WebSocket | 以 `InterceptorFor` 限制範圍 |
| 允許憑證的 CORS | 需要明確來源 | 不可同時使用 `*` 與 `AllowCredentials: true` |
| Cookie | 在寫入回應前拒絕無效欄位 | 需要保留任意值時，使用 `httpx.EncodeCookieValue` |

## Kafka

`boot.KafkaOptions` 的 `Read` 與 `Write` 可獨立啟用。只要設定其中一項，就需要 `Brokers`；使用 `Read` 時也必須指定 `GroupID`。若未另行設定傳輸方式，消費者與發布器皆會套用 TLS 1.2 以上版本。

```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"kafka.example:9093"},
    Read:  &boot.KafkaReadOptions{GroupID: "orders"},
    Write: &boot.KafkaWriteOptions{},
}
```

若需要自訂 CA、mTLS 或 SASL，請設定 `TLS`、`Dialer` 與 `Transport`。若為啟用的角色同時設定明確的 TLS 與 `AllowInsecureTransport`，會發生 `KAFKA_TLS_INSECURE_CONFLICT` 錯誤。請只在隔離的本機開發環境中明確允許明文連線。

```go
Kafka: &boot.KafkaOptions{
    Brokers:                []string{"localhost:9092"},
    AllowInsecureTransport: true,
    Read:                   &boot.KafkaReadOptions{GroupID: "local"},
}
```

發生讀取器錯誤或 ACK/NACK 失敗後，會依 `ConsumerRetry` 關閉既有讀取器，並建立新讀取器。此選項控制傳輸層的重新連線，不會改變處理器的訊息處理政策。

| `ConsumerRetryOptions` 欄位 | 型別 | 預設值 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5 秒 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2，即 20% |
| `MaxAttempts` | `int` | `0`，無限次重試 |

各欄位的 `0` 表示使用預設值，不允許負數。明確指定的延遲上限必須大於或等於初始延遲，倍數須大於或等於 1，抖動須介於 0 與 1 之間。相同選項也套用至 RabbitMQ 消費者。

Kafka 處理器必須考量重新傳遞，實作為具備冪等性。永久無法處理的訊息不會自動略過，也不會傳送至其他失敗佇列。

## RabbitMQ

正式環境的 URL 使用 `amqps://`。啟用的 `Read` 與 `Write` 各自需要 `Exchange`。預設失敗政策為拒絕且不重新入列。

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

| 讀取設定 | 預設值與限制 |
| --- | --- |
| `PrefetchCount` | `0` 表示每個消費者 1 則未確認訊息。自行指定時須為正數 |
| `FailurePolicy` | 省略時為 `boot.RabbitMqFailureReject`。若要重新入列，使用 `boot.RabbitMqFailureRequeue` |
| `DeadLetter` | 預設為 `nil`。設定時需要預先建立之 DLX 的 `Exchange`，也可指定 `RoutingKey` |
| `RequeueOnError` | 用於相容舊版。`true` 表示重新入列。若與明確指定的 `FailurePolicy` 衝突，會發生設定錯誤 |

DLX 是接收未能處理訊息的交換器，須由維運人員事先建立。若沒有相符的 DLX 組態，被拒絕的訊息可能遭到捨棄。若既有佇列的引數與新設定不同，RabbitMQ 可能回傳佇列宣告條件不符的錯誤。

使用 `RabbitMqFailureRequeue` 時，無法處理的訊息可能無限次重新傳遞。新組態請使用拒絕政策與 DLX。`RequeueOnError` 預定棄用，新程式碼請使用 `FailurePolicy`。選擇處理器的索引鍵是繫結佇列的 `RoutingKey`，而非 AMQP `Type`。

發布器使用持久化訊息、`mandatory=true` 與發布確認。若無法路由訊息，或確認遭拒或遺失，不會視為成功。確認遺失後重試，可能重複發布同一訊息，因此消費者必須具備冪等性。

| `PublisherRetryOptions` 欄位 | 型別 | 預設值 |
| --- | --- | --- |
| `InitialDelay` | `time.Duration` | 100ms |
| `MaxDelay` | `time.Duration` | 5 秒 |
| `Multiplier` | `float64` | 2 |
| `Jitter` | `float64` | 0.2，即 20% |
| `MaxAttempts` | `int` | 總共嘗試 3 次 |
| `ConfirmTimeout` | `time.Duration` | 5 秒 |

各欄位的 `0` 表示使用預設值，不允許負數。延遲範圍、倍數與抖動的限制與 `ConsumerRetryOptions` 相同。增加 `MaxAttempts` 時，也必須考量重複發布的可能性。

## WebSocket

在 `boot.HTTPOptions.WebSocket` 設定來源、連線數與訊息限制。請指定應用程式使用的確切來源與連線上限。

```go
HTTP: &boot.HTTPOptions{
    WebSocket: boot.WebSocketOptions{
        AllowedOrigins: []string{"https://app.example.com"},
        MaxConnections: 4096,
    },
},
```

| `WebSocketOptions` 欄位 | 型別 | 預設值與限制 |
| --- | --- | --- |
| `MaxConnections` | `int` | `0` 表示 `boot.DefaultWebSocketMaxConnections`，即 1024。以正數限制，或使用 `boot.UnlimitedWebSocketConnections` 解除限制 |
| `CapacityRetryAfter` | `time.Duration` | 5 秒。超過連線上限時的 `Retry-After` 值，不得為負數 |
| `AllowedOrigins` | `[]string` | 空值表示同源。自行指定時，須為不含路徑、查詢參數與片段的 `http://` 或 `https://` 來源。也支援 `*`，但會允許所有來源 |
| `TrustedProxyCIDRs` | `[]string` | 無預設值。要信任其轉送標頭的 Proxy CIDR 清單 |
| `MaxMessageBytes` | `int64` | 1 MiB，不得為負數 |
| `HandshakeTimeout` | `time.Duration` | 10 秒，不得為負數 |
| `ReadTimeout` | `time.Duration` | 60 秒，不得為負數 |
| `WriteTimeout` | `time.Duration` | 10 秒，不得為負數 |
| `PingInterval` | `time.Duration` | 讀取時限的一半。使用預設讀取時限時為 30 秒，不得為負數 |

時間與大小欄位的 `0` 表示使用預設值。解除連線數限制時，請使用具名常數 `boot.UnlimitedWebSocketConnections`，不要使用 `-1`。

`AllowedOrigins` 為空時，瀏覽器請求的通訊協定與主機都必須相同。位於 TLS 終止 Proxy 後方時，可指定 `TrustedProxyCIDRs`。只有請求對端位於此清單中時，才會信任 `Forwarded` 與 `X-Forwarded-Proto`。Proxy 必須移除或覆寫從外部收到的轉送標頭。

連線上限也包含等待驗證的連線請求。超出上限的請求不會升級，而會回傳 HTTP 503、`Retry-After` 標頭，以及帶有 `WEBSOCKET_CAPACITY_EXCEEDED` 代碼的 JSON。

若需要連線驗證，請在攔截器中也實作 `core.WebSocketHandshakeInterceptor`。`PreHandshake` 在預留連線名額後、HTTP 升級前執行，與每則訊息的 `PreHandle` 分開。

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

連線前內容與訊息內容會保留原始請求的標頭、查詢參數、Cookie、遠端位址、主機與請求 URI。公開介面請參閱[執行內容參考](/zh-Hant/reference/api/execution-context#websocket-request-context)。

## CORS 與 Cookie {#cors-cookies}

不可同時使用 `AllowOrigins: []string{"*"}` 與 `AllowCredentials: true`。若要在啟動階段檢查，請使用 `cors.NewValidated`。`cors.New` 也會在第一個請求中，於寫入回應標頭前回傳結構化錯誤。

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

若 Cookie 的名稱、值、路徑、網域、`SameSite` 或 `Priority` 無效，JSON、字串、二進位與重新導向回應會在寫入標頭或本文前失敗。若須將 Unicode 或分隔符號還原為原始值，請使用 `httpx.EncodeCookieValue` 與 `httpx.DecodeCookieValue`。

## 正式環境的限制

- 監控 `WEBSOCKET_CAPACITY_EXCEEDED`、消費者重新連線次數耗盡，以及 RabbitMQ `Type` 與 `RoutingKey` 不符的情況。
- Kafka 與 RabbitMQ 消費者須具備冪等性。也須準備處理 Kafka 無法處理訊息與維運 RabbitMQ DLX 的程序。
- 實際 Socket 寫入與訊息代理發布不會和 DB 提交構成原子操作。若需要原子性，請使用交易式寄件匣與冪等索引鍵。
- 支援版本請參閱[目前版本](/zh-Hant/community/changelog)。
