# 使用 Kafka 連接訂單服務與庫存服務

分別建立訂單 HTTP 服務和庫存消費服務，透過 Kafka 傳遞 `order.created` 事件。傳送訂單請求後，確認庫存服務的處理日誌。庫存服務不啟動 HTTP 監聽器。

## 開始前的準備

請先完成 [CLI 安裝](/zh-Hant/learn/getting-started/installation)。CLI 0.4.0 提供具備型別定義的消費者骨架。Kafka broker 和傳輸設定需要另外準備。

若要確認訊息傳遞，需要在 `localhost:9092` 執行的 Kafka broker，以及 `order.created` 主題。此範例使用隔離本機環境中的明文連線。庫存消費者會將事件寫入日誌，不會實際變更庫存數量。

## 1. 建立兩個服務

建立工作目錄，先確認將產生的檔案。

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --layout legacy --module example.com/order-app --dry-run
spine new stock-app --layout legacy --module example.com/stock-app --dry-run
```

確認預覽後，建立兩個應用程式。除非另有說明，後續命令均在 `spine-msa/` 中執行。

```sh
spine new order-app --layout legacy --module example.com/order-app
spine new stock-app --layout legacy --module example.com/stock-app
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
├── go.sum
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
├── go.sum
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
    platform "github.com/NARUBROWN/spine-echo-platform"
    "time"

    "example.com/order-app/src/controller"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := platform.New()
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
    platform "github.com/NARUBROWN/spine-echo-platform"
    "time"

    "example.com/stock-app/src/consumer/order"
    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := platform.New()
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

由於兩個服務都使用本機明文連線，因此各會出現一個 `INSECURE_TRANSPORT_ENABLED` 警告。預設檢查仍會通過，但使用 `--warnings-as-errors` 時會失敗。

`contract check` 檢查靜態契約。`verify` 檢查靜態契約，並執行 gofmt、go vet 和 Go 測試。broker 連線和實際訊息傳遞會在下一步確認。

## 7. 執行並確認事件傳遞

確認 Kafka 正在 `localhost:9092` 執行，且已有 `order.created` 主題。將各終端機的工作目錄設為 `spine-msa/`。

在第一個終端機啟動庫存服務。

```sh
spine run --root stock-app
```

在第二個終端機啟動訂單服務。

```sh
spine run --root order-app
```

在第三個終端機傳送建立訂單的請求。

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

確認回應為 HTTP 202，且本文為 `accepted`。接著在庫存服務的終端機確認 `topic=order.created order_id=12345` 日誌。HTTP 回應是訂單請求的結果，庫存服務的日誌則是事件消費的結果。必須確認兩者，才能驗證服務之間的傳遞。

## 套用於正式環境前的注意事項

### 傳輸安全與主題名稱

`AllowInsecureTransport: true` 僅適用於隔離的本機明文 broker。正式環境應移除此選項，並設定 TLS/SASL 和 broker 位址。預設傳輸使用 TLS 1.2 以上版本。若自行指定傳輸設定，必須同時保護讀取和寫入。

`TopicPrefix` 會將字串直接加在主題名稱前方。若發布設定使用 `prod.`，消費者註冊的主題也必須設為 `prod.order.created`。此範例兩端都使用不含前綴的 `order.created`。檢查和執行時請使用相同設定。

### 重複處理和失敗訊息

Kafka 至少傳遞每則訊息一次，因此同一事件可能再次送達。需要使用重新傳送時仍維持不變的事件 ID，並以持久儲存防止重複處理。此範例的重複處理防護僅在同一程序內有效。實際庫存變更和持久化的重複處理防護，必須在同一個 DB 交易中實作。

`ConsumerRetry` 會調整讀取器和傳輸層的重新設定，不會限制業務處理器的重試次數。持續失敗的訊息可能阻塞分割區。系統不會自動略過訊息或將訊息移至 DLQ。

### DB 變更與事件發布

DB 提交和 broker 發布並非單一原子操作。若需要一致地處理 DB 變更與事件傳遞，請另外實作 transactional outbox 和消費者的重複處理防護。

## 下一步

請在[安全設定](/zh-Hant/reference/security-configuration)中確認 Kafka 連線設定。連接實際庫存儲存庫時，請持久記錄事件 ID，並將其與庫存變更一併提交。
