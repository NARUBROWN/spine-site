# 安全性設定

Spine `v0.7.5` 限制 HTTP 和 WebSocket 的大小、時間與連線數。獨立平台管理訊息代理傳輸政策，也請檢查所選平台版本和設定。

## 設定驗證

App.Validate 無需監聽器即可檢查啟動選項和靜態可檢查的 DI 設定，Run 也會在啟動前檢查。實際建構函式執行、資料庫或訊息代理連線須在準備階段和真實請求中另行驗證。

```go
if err := app.Validate(options); err != nil {
	log.Fatal(err)
}
if err := app.Run(options); err != nil {
	log.Fatal(err)
}
```

透過 `*boot.ConfigError.Issues` 檢查 boot 設定錯誤。另外檢查外部平台 `NewFactory` 傳回的設定錯誤。使用公開錯誤與代碼分類，不解析訊息字串，也不記錄訊息代理憑證。

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
| RabbitMQ 發布 | persistent / mandatory / publisher confirm | `OperationTimeout` |
| RabbitMQ 處理失敗 | 拒絕且不重新入列 | `rabbitmqplatform.Config.FailurePolicy` |
| RabbitMQ 並行處理 | 每個消費者 1 則未確認訊息 | 正數 `PrefetchCount` |
| 消費者傳輸失敗 | 以指數退避與抖動重新建立讀取器 | `spine.WithEventConsumerRetry` |
| WebSocket 來源 | 瀏覽器請求只允許通訊協定與主機相同的來源 | `AllowedOrigins` |
| WebSocket 連線數 | 連線與等待連線的請求合計 1024 個 | 正數 `MaxConnections` 或 `boot.UnlimitedWebSocketConnections` |
| WebSocket 連線驗證 | 只有實作選用介面的攔截器會在升級前執行 | 實作 `core.WebSocketHandshakeInterceptor` |
| 全域攔截器 | 同時套用至 HTTP 與 WebSocket | 以 `InterceptorFor` 限制範圍 |
| 允許憑證的 CORS | 需要明確來源 | 不可同時使用 `*` 與 `AllowCredentials: true` |
| Cookie | 在寫入回應前拒絕無效欄位 | 需要保留任意值時，使用 `httpx.EncodeCookieValue` |

## Kafka

匯入 `kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"`。透過 `Config.Consume` 與 `Config.Publish` 選擇角色並設定 `Brokers`。消費者還需要 `GroupID`。以下程式碼用於 `BuildApplication` 內，同時匯入 `echoplatform`、`spine`、`boot` 與 `time`。

```go
factory, err := kafkaplatform.NewFactory(kafkaplatform.Config{
	Brokers:     []string{"kafka.example.com:9093"},
	Consume:     true,
	Publish:     true,
	GroupID:     "orders",
	TopicPrefix: "prod.",
})
if err != nil {
	return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory,
	spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{MaxAttempts: 5}),
	spine.WithEventSettlementTimeout(5*time.Second),
))
```

Kafka 平台預設使用 TLS 1.2 以上。使用 `TLS`、`Dialer`、`Transport` 設定 CA、mTLS 與 SASL。`AllowInsecureTransport: true` 僅用於隔離的本地明文連線，不能與明確指定的 TLS 同時使用。`NewFactory` 僅檢查設定。`Prepare` 與 `Run` 在準備已註冊消費者的 reader 時檢查訊息代理與主題。Kafka 僅發布應用程式可以在未連接訊息代理時啟動，因此需要實際發布來另外驗證連線與傳遞。

`Config.TopicPrefix` 同時為發布名稱與消費者訂閱加入前綴。兩端 factory 都設定 `prod.` 時，應用程式中註冊 `order.created`，在訊息代理中準備 `prod.order.created`。前綴需要自行包含分隔符。

`spine.WithEventConsumerRetry(boot.ConsumerRetryOptions{...})` 控制 reader 與 ACK/NACK 失敗後的重新連線。預設初始延遲 100ms、最大 5s、倍率 2、抖動 0.2，`MaxAttempts: 0` 表示無限次傳輸重試。它不設定處理器重試次數或 DLQ 政策。`WithEventSettlementTimeout` 的預設 ACK/NACK 限制為 5s。Kafka 不會透過後續 offset 提交跳過失敗記錄，無法處理的訊息可能阻塞分區。

## RabbitMQ

匯入 `rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"`。設定共用的 `Config.Exchange` 並選擇 `Consume`、`Publish`。預設要求 `amqps://`，本地 `amqp://` 需要明確設定 `AllowInsecureTransport: true`。以下程式碼用於 `BuildApplication` 內。

```go
factory, err := rabbitmqplatform.NewFactory(rabbitmqplatform.Config{
	URL:           "amqps://user:pass@rabbit.example.com/vhost",
	Exchange:      "events",
	Consume:       true,
	Publish:       true,
	PrefetchCount: 16,
	FailurePolicy: rabbitmqplatform.FailureReject,
	DeadLetter: &rabbitmqplatform.DeadLetter{
		Exchange:   "events.dlx",
		RoutingKey: "events.failed",
	},
	OperationTimeout: 5 * time.Second,
})
if err != nil {
	return nil, boot.Options{}, err
}
app := spine.New(echoplatform.Option(), spine.WithEventAdapter("events", factory))
```

省略 `PrefetchCount` 時每個消費者允許一則未確認訊息。預設政策為 `rabbitmqplatform.FailureReject`，`FailureRequeue` 可能無限次重新傳遞無法處理的訊息。使用前先準備 `DeadLetter` 交換器。`TopicPrefix` 套用於發布路由鍵與訂閱綁定，`QueuePrefix` 套用於佇列名稱。

發布器使用持久化訊息、mandatory 路由與 publisher confirm。`OperationTimeout` 預設為 5s。沒有自動重新發布失敗訊息的 `PublisherRetry` 選項。確認遺失後應用程式重試可能造成重複，因此消費者必須具冪等性。

## WebSocket

HTTP 選擇 Echo 或 net/http，WebSocket 選擇獨立的 Gorilla 實作。WebSocket 路由需要 HTTP 升級支援和 WS factory。驗證時將 `playground.New()` 傳給 `spine.WithValidator`。

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

將此片段加入已實作四個掛鉤與 verify 的 AuthInterceptor。spinectx 匯入公開 pkg/spine，core 提供中繼資料，httperr 提供公開錯誤。

```go
func (i *AuthInterceptor) PreHandshake(
	ctx spinectx.Ctx,
	meta core.HandlerMeta,
) error {
	request, ok := ctx.WebSocket()
	if !ok {
		return httperr.Unauthorized("HTTP request required")
	}
	token := request.Header("Authorization")
	if token == "" {
		return httperr.Unauthorized("missing credentials")
	}
	return i.verify(token)
}
```

連線前內容與訊息內容會保留原始請求的標頭、查詢參數、Cookie、遠端位址、主機與請求 URI。公開介面請參閱[執行內容參考](/zh-Hant/reference/api/execution-context#websocket-request-context)。

## CORS 與 Cookie {#cors-cookies}

不可同時使用 `AllowOrigins: []string{"*"}` 與 `AllowCredentials: true`。若要在啟動階段檢查，請使用 `cors.NewValidated`。`cors.New` 也會在第一個請求中，於寫入回應標頭前回傳結構化錯誤。

CORS 預檢由同時存在的 `OPTIONS`、`Origin` 和 `Access-Control-Request-Method` 判定。允許的請求回傳 204，遭拒的來源、方法或標頭回傳 403。一般請求中未獲准的來源不會收到 CORS 允許標頭，但 CORS 不能取代伺服器驗證或存取控制。

`MaxAge` 是秒數指標：nil 省略標頭，0 明確傳送零。`ExposeHeaders` 指定一般回應中公開的標頭，`AllowOrigin` 可以對靜態清單未允許的來源進一步判斷。允許認證資訊時不能使用萬用字元來源。

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

### 驗證 CORS 預檢

將以下獨立應用程式儲存為安裝 Spine `v0.7.5` 和相容 Echo 平台的獨立 Go 模組中的 `main.go`，然後執行。`Authorization` 已明確列入允許的標頭。

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

第一個請求回傳 204 和 `Access-Control-Max-Age: 60`，第二個回傳 403。

```bash
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization' http://localhost:8080/resource
curl -i -X OPTIONS -H 'Origin: https://app.example.com' -H 'Access-Control-Request-Method: DELETE' http://localhost:8080/resource
```

## 正式環境的限制

- 監控 `WEBSOCKET_CAPACITY_EXCEEDED`、消費者重新連線次數耗盡、reader 與 ACK/NACK 失敗以及事件發布失敗。
- Kafka 與 RabbitMQ 消費者須具備冪等性。也須準備處理 Kafka 無法處理訊息與維運 RabbitMQ DLX 的程序。
- 實際 Socket 寫入與訊息代理發布不會和 DB 提交構成原子操作。若需要原子性，請使用交易式寄件匣與冪等索引鍵。
- 支援版本請參閱[目前版本](/zh-Hant/community/changelog)。
