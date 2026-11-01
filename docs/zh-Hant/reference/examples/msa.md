# Kafka MSA 範例

使用 CLI 分別產生訂單 HTTP 服務與庫存消費者服務。訂單服務發布 `order.created`，庫存服務處理事件，不需要 HTTP 監聽器。

## 使用 CLI 產生兩個服務

先完成 [CLI 安裝](/zh-Hant/learn/getting-started/installation)，之後從 `spine-msa/` 執行命令。CLI 0.1.4 提供具型別的 consumer 骨架，不產生 Kafka 代理或傳輸設定。

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --module example.com/order-app --dry-run
spine new stock-app --module example.com/stock-app --dry-run
```

在預覽中檢查產生檔案與註冊程式碼的變更，再執行下方命令產生。

```sh
spine new order-app --module example.com/order-app
spine new stock-app --module example.com/stock-app
```

## 產生消費者骨架

預設自動註冊會向 `stock-app/internal/application/application.go` 加入檢查錯誤的 `order.Register(app)` 呼叫。產生的 handler 在實作前回傳未實作錯誤，因此替換下方程式碼前驗證失敗是預期行為。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

## 最終結構

```text
spine-msa/
├── order-app/
│   ├── go.mod
│   ├── main.go
│   ├── spine.toml
│   ├── internal/application/
│   │   ├── application.go
│   │   └── application_test.go
│   └── src/
│       ├── events/order_created.go
│       └── controller/order_controller.go
└── stock-app/
    ├── go.mod
    ├── main.go
    ├── spine.toml
    ├── internal/application/
    │   ├── application.go
    │   └── application_test.go
    └── src/consumer/order/
        ├── module.go
        ├── order_handler.go
        └── order_message.go
```

## 共用事件

`order-app/src/events` 是兩個服務共用的事件套件。庫存模組只從訂單模組匯入該套件，後方 `go mod edit` 命令負責連接本機模組。

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

## 訂單服務：發布事件

手動加入或替換以下兩個檔案。保留 CLI 產生的根目錄 `main.go` 和 `spine.toml`。`publish.Event` 將事件加入目前請求，沒有回傳值；handler 與回應準備成功後，由已設定的 Kafka writer 發布。

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
    "github.com/NARUBROWN/spine/pkg/path"
)

type OrderController struct{}

func NewOrderController() *OrderController { return &OrderController{} }

func (c *OrderController) Create(ctx context.Context, id path.Int) (httpx.Response[string], error) {
    if id.Value <= 0 {
        return httpx.Response[string]{}, httperr.BadRequest("order ID must be positive")
    }
    publish.Event(ctx, events.OrderCreated{
        EventID: fmt.Sprintf("order.created:%d", id.Value),
        OrderID: id.Value,
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
    "time"

    "example.com/order-app/src/controller"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(controller.NewOrderController)
    app.Route("POST", "/orders/:order_id", (*controller.OrderController).Create)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            AllowInsecureTransport: true,
            Write: &boot.KafkaWriteOptions{TopicPrefix: ""},
        },
    }, nil
}
```

## 庫存服務：處理事件

將產生的 `order_message.go` 改為共用事件別名，實作 `order_handler.go` 並移除未實作錯誤。記憶體去重僅在同一處理程序內有效；實際庫存修改與持久化去重應在同一資料庫交易中實作。使用下方完整程式碼替換組裝檔案，不要重複加入自動註冊。

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
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    if err := order.Register(app); err != nil {
        return nil, boot.Options{}, err
    }
    return app, boot.Options{
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            AllowInsecureTransport: true,
            Read: &boot.KafkaReadOptions{GroupID: "stock-service"},
        },
    }, nil
}
```

## 連接模組並驗證

兩個服務各有獨立的 `go.mod` 與 `spine.toml`。從 `spine-msa/` 開始執行以下命令，最後返回相同位置。各產生的 `main.go` 依序呼叫 `BuildApplication`、`Validate`、`Run`。

```sh
cd order-app
gofmt -w src internal/application
go mod tidy
cd ../stock-app
go mod edit -require=example.com/order-app@v0.0.0
go mod edit -replace=example.com/order-app=../order-app
gofmt -w src internal/application
go mod tidy
cd ..
spine doctor --root order-app
spine doctor --root stock-app
spine contract check --root order-app
spine contract check --root stock-app
spine verify --root order-app
spine verify --root stock-app
```

此本機明文設定預期讓每個服務回報一個 `INSECURE_TRANSPORT_ENABLED` 警告。預設檢查可通過，使用 `--warnings-as-errors` 則會失敗。

`contract check` 檢查靜態契約，`verify` 檢查契約、gofmt、vet 與 Go 測試，不驗證代理連線或訊息交付。

## 準備代理後執行

另外在 `localhost:9092` 準備 Kafka 並建立 `order.created` 主題。於不同終端中，都從 `spine-msa/` 執行。

```sh
spine run --root stock-app
```

```sh
spine run --root order-app
```

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

POST 回傳 HTTP 202，本文為 `accepted`。代理正常時，在庫存處理程序確認 `topic=order.created order_id=12345` 日誌；僅有 HTTP 回應不能證明消費完成。

## 傳輸與一致性邊界

`AllowInsecureTransport: true` 僅用於隔離的本機明文代理。正式環境應移除該選項，並設定 TLS/SASL 與代理位址。預設傳輸使用 TLS 1.2 以上；自訂設定需同時保護讀寫。

`TopicPrefix` 只進行字串串接；writer 使用 `prod.` 時，consumer 必須明確註冊 `prod.order.created`。本例兩端都使用無前綴的 `order.created`，檢查與執行時請保持設定一致。

Kafka 至少傳遞一次，需使用穩定事件 ID 與持久化去重。`ConsumerRetry` 控制 reader/傳輸重建，不是業務 handler 的重試次數限制。永久失敗的訊息可能阻塞分割區，Spine 不會自動跳過或選擇 DLQ。

資料庫提交與代理發布不是原子操作。需要可靠的資料庫與事件一致性時，應另外實作 transactional outbox 與消費者去重。另見[安全設定](/zh-Hant/reference/security-configuration)。

## RabbitMQ

```go
RabbitMQ: &boot.RabbitMqOptions{
	URL: "amqps://user:pass@rabbit.example/vhost",
	Read: &boot.RabbitMqReadOptions{
		Exchange:      "orders",
		PrefetchCount: 16,
		FailurePolicy: boot.RabbitMqFailureReject,
		DeadLetter: &boot.RabbitMqDeadLetterOptions{
			Exchange:   "orders.dlx",
			RoutingKey: "orders.failed",
		},
	},
	Write: &boot.RabbitMqWriteOptions{Exchange: "orders"},
}
```

RabbitMQ 預設要求 `amqps://`。`PrefetchCount` 為零時預設 1；處理失敗預設拒絕且不重新入列。DLX 必須由維運人員預先建立，現有佇列的參數也必須一致。

發布器使用持久訊息、`mandatory=true` 和 publisher confirms。確認遺失時重試可能重複發布，仍需保持冪等。RabbitMQ 路由使用 AMQP `RoutingKey`，不要依賴生產者提供的 `Type`。
