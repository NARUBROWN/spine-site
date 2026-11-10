# 使用 Kafka 連接訂單服務與庫存服務

::: info
此範例使用 `v0.7.1` 控制器和路徑輸入。相容規則請參閱[路由遷移](/zh-Hant/learn/migration/preview-controller-routes)、[輸入移轉](/zh-Hant/learn/migration/v0.7.1-preview)和 [OpenAPI](/zh-Hant/reference/api/openapi)。
:::

分別建立訂單 HTTP 服務和庫存消費服務，透過 Kafka 傳遞 `order.created` 事件。傳送訂單請求後，確認庫存服務的處理日誌。庫存服務不啟動 HTTP 監聽器。

## 開始前的準備

完成 [CLI 安裝](/zh-Hant/learn/getting-started/installation)後，使用 CLI `v0.4.3` 以上版本產生 Kafka 平台和消費者骨架。

若要確認訊息傳遞，需要在 `localhost:9092` 執行的 Kafka broker，以及 `order.created` 主題。此範例使用隔離本機環境中的明文連線。庫存消費者會將事件寫入日誌，不會實際變更庫存數量。

## 1. 建立兩個服務

建立工作目錄，先確認將產生的檔案。

以下指令使用正式相依套件通道。請在 `go.mod` 中確認所選版本。

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --layout legacy --module example.com/order-app --event-platform kafka --channel main --no-interactive --dry-run
spine new stock-app --layout legacy --module example.com/stock-app --platform none --event-platform kafka --channel main --no-interactive --dry-run
```

確認預覽後，建立兩個應用程式。除非另有說明，後續命令均在 `spine-msa/` 中執行。

```sh
spine new order-app --layout legacy --module example.com/order-app --event-platform kafka --channel main --no-interactive
spine new stock-app --layout legacy --module example.com/stock-app --platform none --event-platform kafka --channel main --no-interactive
```

## 2. 產生庫存消費者骨架

在 `stock-app` 中產生接收訂單事件的消費者。請先確認預覽。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

以下命令會建立消費者檔案，並在 `stock-app/internal/application/application.go` 中加入 `order.Register(app)` 呼叫和錯誤檢查程式碼。剛產生的處理器會回傳未實作錯誤，因此必須以步驟 5 的程式碼取代，才能通過驗證。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

### 檔案配置

新增共用事件和訂單控制器，並取代產生的消費者實作與應用程式設定後，結構如下。

```text
spine-msa/
├── order-app/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go
│   ├── spine.toml
│   ├── internal/application/
│   │   ├── application.go
│   │   ├── application_test.go
│   │   ├── platform_config.go
│   │   └── platform_config_test.go
│   └── src/
│       ├── events/order_created.go
│       └── controller/order_controller.go
└── stock-app/
    ├── go.mod
    ├── go.sum
    ├── main.go
    ├── spine.toml
    ├── internal/application/
    │   ├── application.go
    │   ├── application_test.go
    │   ├── platform_config.go
    │   └── platform_config_test.go
    └── src/consumer/order/
        ├── module.go
        ├── order_handler.go
        └── order_message.go
```

保留產生的 `platform_config.go` 與兩個測試檔案。以下 BuildApplication 使用產生的 `loadKafkaConfig` 驗證環境設定，再為訂單服務選擇僅發布、為庫存 worker 選擇僅消費。在各執行終端傳入訊息代理與群組設定。

## 3. 定義共用事件

建立 `order-app/src/events/order_created.go`。兩個服務共用此套件中的事件型別。步驟 6 會使用 `go mod edit` 連接本機模組，讓 `stock-app` 能匯入 `order-app` 的事件套件。

```go
// order-app/src/events/order_created.go
package events

import "time"

type OrderCreated struct {
    EventID string `json:"event_id"`
    OrderID int64 `json:"order_id"`
    At time.Time `json:"at"`
}

func (e OrderCreated) Name() string { return "order.created" }
func (e OrderCreated) OccurredAt() time.Time { return e.At }
```

## 4. 在訂單服務發布事件

建立 `order-app/src/controller/order_controller.go`，並以下列程式碼取代 `order-app/internal/application/application.go`。根目錄的 `main.go` 和 `spine.toml` 繼續沿用。

`publish.Event` 會將事件加入目前的請求，沒有回傳值。處理器成功執行且回應準備完成後，設定的 Kafka 發布器便會傳送事件。

```go
// order-app/src/controller/order_controller.go
package controller

import (
    "context"
    "fmt"
    "time"

    "example.com/order-app/src/events"
    "github.com/NARUBROWN/spine/pkg/event/publish"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/input"
)

type OrderController struct{}

func (*OrderController) Constructor() *OrderController { return &OrderController{} }

func (c *OrderController) RegisterRoutes(r *api.Registry) {
    r.POST("/orders/:order_id", c.Create)
}

func (c *OrderController) Create(ctx context.Context, id input.Path[int64]) (httpx.Response[string], error) {
    if *id <= 0 {
        return httpx.Response[string]{}, httperr.BadRequest("order ID must be positive")
    }
    publish.Event(ctx, events.OrderCreated{
        EventID: fmt.Sprintf("order.created:%d", *id),
        OrderID: *id,
        At: time.Now().UTC(),
    })
    return httpx.Response[string]{
        Body: "accepted",
        Options: httpx.ResponseOptions{Status: 202},
    }, nil
}
```

```go
// order-app/internal/application/application.go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "time"

    "example.com/order-app/src/controller"
    "github.com/NARUBROWN/spine"
    kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
    config, err := loadKafkaConfig("SPINE_KAFKA_")
    if err != nil {
        return nil, boot.Options{}, err
    }
    config.Consume = false
    config.Publish = true
    factory, err := kafkaplatform.NewFactory(config)
    if err != nil {
        return nil, boot.Options{}, err
    }
    app := spine.New(echoplatform.Option(), spine.WithEventAdapter("kafka", factory))
    app.Constructor(constructor.Controller(&controller.OrderController{}))

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 5. 在庫存服務處理事件

分別以下列程式碼取代這三個檔案。將 `order_message.go` 改為共用事件的型別別名，並在 `order_handler.go` 實作驗證、重複檢查和日誌輸出，取代未實作錯誤。產生的 `module.go` 繼續沿用。

`stock-app/internal/application/application.go` 的完整替代程式碼已包含 `order.Register(app)`。請勿再次附加產生時加入的註冊程式碼。

```go
// stock-app/src/consumer/order/order_message.go
package order

import "example.com/order-app/src/events"

type OrderEvent = events.OrderCreated
```

```go
// stock-app/src/consumer/order/order_handler.go
package order

import (
    "context"
    "fmt"
    "log"
    "sync"
)

type OrderConsumer struct {
    mu sync.Mutex
    processed map[string]struct{}
}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{processed: make(map[string]struct{})}
}

func (c *OrderConsumer) Handle(ctx context.Context, eventName string, event OrderEvent) error {
    if event.EventID == "" || event.OrderID <= 0 {
        return fmt.Errorf("invalid order event")
    }
    c.mu.Lock()
    defer c.mu.Unlock()
    if _, exists := c.processed[event.EventID]; exists {
        return nil
    }
    log.Printf("topic=%s order_id=%d", eventName, event.OrderID)
    c.processed[event.EventID] = struct{}{}
    return nil
}
```

```go
// stock-app/internal/application/application.go
package application

import (
    "time"

    "example.com/stock-app/src/consumer/order"
    "github.com/NARUBROWN/spine"
    kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    config, err := loadKafkaConfig("SPINE_KAFKA_")
    if err != nil {
        return nil, boot.Options{}, err
    }
    config.Consume = true
    config.Publish = false
    factory, err := kafkaplatform.NewFactory(config)
    if err != nil {
        return nil, boot.Options{}, err
    }
    app := spine.New(spine.WithEventAdapter("kafka", factory))
    if err := order.Register(app); err != nil {
        return nil, boot.Options{}, err
    }
    return app, boot.Options{
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
    }, nil
}
```

## 6. 連接本機模組並驗證程式碼

兩個服務各自使用獨立的 `go.mod` 和 `spine.toml`。以下命令從 `spine-msa/` 開始，連接並檢查兩個模組後，回到相同位置。每個應用程式產生的 `main.go` 會依序執行 `BuildApplication`、`Validate`、`Run`。

```sh
cd order-app
gofmt -w src internal/application
go mod tidy
go mod download all
cd ../stock-app
go mod edit -require=example.com/order-app@v0.0.0
go mod edit -replace=example.com/order-app=../order-app
gofmt -w src internal/application
go mod tidy
go mod download all
cd ..
spine doctor --root order-app
spine doctor --root stock-app
spine contract check --root order-app
spine contract check --root stock-app
spine verify --root order-app
spine verify --root stock-app
```

本例 factory 明確允許本地明文連線。CLI 靜態契約檢查不執行 factory 設定，也不證明傳輸安全性或訊息代理就緒狀態。

`contract check` 檢查靜態契約。`verify` 檢查靜態契約，並執行 gofmt、go vet 和 Go 測試。broker 連線和實際訊息傳遞會在下一步確認。

## 7. 執行並確認事件傳遞

確認 Kafka 正在 `localhost:9092` 執行，且已有 `order.created` 主題。將各終端機的工作目錄設為 `spine-msa/`。

在第一個終端機啟動庫存服務。

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=stock-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root stock-app
```

在第二個終端機啟動訂單服務。

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=order-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root order-app
```

在第三個終端機傳送建立訂單的請求。

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

確認回應為 HTTP 202，且本文為 `accepted`。接著在庫存服務的終端機確認 `topic=order.created order_id=12345` 日誌。HTTP 回應是訂單請求的結果，庫存服務的日誌則是事件消費的結果。必須確認兩者，才能驗證服務之間的傳遞。

## 套用於正式環境前的注意事項

### 傳輸安全與主題名稱

`AllowInsecureTransport: true` 僅適用於隔離的本機明文 broker。正式環境應移除此選項，並設定 TLS/SASL 和 broker 位址。預設傳輸使用 TLS 1.2 以上版本。若自行指定傳輸設定，必須同時保護讀取和寫入。

`Config.TopicPrefix` 同時為發布名稱與消費者訂閱加入前綴。兩端 factory 都設定 `prod.` 時，應用程式中註冊 `order.created`，在訊息代理中準備 `prod.order.created`。前綴需要自行包含分隔符。

### 重複處理和失敗訊息

Kafka 至少傳遞每則訊息一次，因此同一事件可能再次送達。需要使用重新傳送時仍維持不變的事件 ID，並以持久儲存防止重複處理。此範例的重複處理防護僅在同一程序內有效。實際庫存變更和持久化的重複處理防護，必須在同一個 DB 交易中實作。

`spine.WithEventConsumerRetry` 會調整讀取器和傳輸層的重新設定，不會限制業務處理器的重試次數。持續失敗的訊息可能阻塞分割區。系統不會自動略過訊息或將訊息移至 DLQ。

### DB 變更與事件發布

DB 提交和 broker 發布並非單一原子操作。若需要一致地處理 DB 變更與事件傳遞，請另外實作 transactional outbox 和消費者的重複處理防護。

## 下一步

請在[安全設定](/zh-Hant/reference/security-configuration)中確認 Kafka 連線設定。連接實際庫存儲存庫時，請持久記錄事件 ID，並將其與庫存變更一併提交。
