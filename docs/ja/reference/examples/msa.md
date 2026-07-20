# KafkaベースのMSAの例

SpineはKafkaイベントベースのマイクロサービスアーキテクチャを実装します。

## アーキテクチャ
```
┌─────────────────┐      Kafka Event        ┌─────────────────┐
│  Order Service  │ ──────────────────────> │  Stock Service  │
│   (HTTP API)    │   "order.created"       │    (Consumer)   │
│   Port: 8080    │                         │   Port: 8081    │
└─────────────────┘                         └─────────────────┘
```
Order Service で注文が生成されると、Kafka にイベントを発行し、Stock Service はそのイベントを購読して処理します。


## プロジェクト構造
```
spine-simple-msa/
├── go.mod
├── order-app/
│   ├── main.go
│   └── controller/
│       └── order_controller.go
├── stock-app/
│   ├── main.go
│   └── consumer/
│       └── order_consumer.go
└── shared/
    └── events/
        └── order_created.go
```
## プロジェクトの作成
```bash
mkdir spine-simple-msa
cd spine-simple-msa
go mod init github.com/your-org/spine-simple-msa
```
## 依存関係のインストール
```bash
go get github.com/NARUBROWN/spine
```
## イベント定義

両方のサービスが共有するイベントを定義します。
```go
// shared/events/order_created.go
package events

import "time"

type OrderCreated struct {
    OrderID int64     `json:"order_id"`
    At      time.Time `json:"at"`
}

func (o OrderCreated) Name() string {
    return "order.created"
}

func (o OrderCreated) OccurredAt() time.Time {
    return o.At
}
```
イベントは`Name()`と`OccurredAt()`メソッドを実装する必要があります。


## Order Service (イベント発行)

### コントローラ
```go
// order-app/controller/order_controller.go
package controller

import (
    "context"
    "time"

    "github.com/your-org/spine-simple-msa/shared/events"
    "github.com/NARUBROWN/spine/pkg/event/publish"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type OrderController struct{}

func NewOrderController() *OrderController {
    return &OrderController{}
}

func (c *OrderController) Create(ctx context.Context, orderId path.Int) httpx.Response[string] {
    // Kafkaでイベントを発行
    publish.Event(ctx, events.OrderCreated{
        OrderID: orderId.Value,
        At:      time.Now(),
    })

    return httpx.Response[string]{
        Body:    "accepted",
        Options: httpx.ResponseOptions{Status: 202},
    }
}
```
`publish.Event()`を呼び出すと、イベントの`Name()`をトピックとして使用してKafkaに発行します。

### main.go
```go
// order-app/main.go
package main

import (
    "log"
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/your-org/spine-simple-msa/order-app/controller"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    app.Constructor(
        controller.NewOrderController,
    )

    app.Route(
        "POST",
        "/orders/:order_id",
        (*controller.OrderController).Create,
    )

    if err := app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            Write: &boot.KafkaWriteOptions{
                TopicPrefix: "",
            },
        },
        HTTP: &boot.HTTPOptions{},
    }); err != nil {
        log.Fatal(err)
    }
}
```
## Stock Service (イベント消費)

### コンシューマー
```go
// stock-app/consumer/order_consumer.go
package consumer

import (
    "context"
    "log"

    "github.com/your-org/spine-simple-msa/shared/events"
)

type OrderConsumer struct{}

func NewOrderConsumer() *OrderConsumer {
    return &OrderConsumer{}
}

func (c *OrderConsumer) OnCreated(ctx context.Context, eventName string, event events.OrderCreated) error {
    log.Println("Kafka Event:", eventName)
    log.Println("OrderID:", event.OrderID)
    
    // 在庫処理ロジックを追加
    
    return nil
}
```
コンシューマメソッドシグネチャ：
- `ctx context.Context` — 要求コンテキスト
- `eventName string` - イベント名（トピック）
- `event T` — イベントペイロード

### main.go
```go
// stock-app/main.go
package main

import (
    "log"
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/your-org/spine-simple-msa/stock-app/consumer"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    app.Constructor(
        consumer.NewOrderConsumer,
    )

// コンシューマー登録
    if err := app.Consumers().Register(
        "order.created",
        (*consumer.OrderConsumer).OnCreated,
    ); err != nil {
        log.Fatal(err)
    }

    if err := app.Run(boot.Options{
        Address:                ":8081",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        Kafka: &boot.KafkaOptions{
            Brokers: []string{"localhost:9092"},
            Read: &boot.KafkaReadOptions{
                GroupID: "stock-service",
            },
        },
        HTTP: &boot.HTTPOptions{},
    }); err != nil {
        log.Fatal(err)
    }
}
```
## 実行

### 1. Stock Service の実行
```bash
cd stock-app
go run main.go
```
### 2. Order Service の実行

新しい端末を開きます。
```bash
cd order-app
go run main.go
```
## APIテスト

### 注文の生成
```bash
curl -X POST http://localhost:8080/orders/12345
```
応答：
```
OK
```
Stock Serviceコンソールで次のログを確認できます。
```
Kafka Event: order.created
OrderID: 12345
```
## イベントフロー
```
POST /orders/12345
   │
   ├─→ OrderController.Create
   │       │
   │       └─→ publish.Event(&OrderCreated{...})
   │               │
   │               └─→ Kafka Topic: "order.created"
   │
   └─→ Response "OK"

              ↓ Kafka ↓

Stock Service (Consumer)
   │
   └─→ OrderConsumer.OnCreated
           │
           ├─→ log: "Kafka Event: order.created"
           └─→ log: "OrderID: 12345"
```
## Kafka設定オプション

### イベント発行(Write)
```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"localhost:9092"},
    Write: &boot.KafkaWriteOptions{
        TopicPrefix: "prod.",  // トピックプレフィックス（例: prod.order.created）
    },
},
```
### イベント消費(Read)
```go
Kafka: &boot.KafkaOptions{
    Brokers: []string{"localhost:9092"},
    Read: &boot.KafkaReadOptions{
        GroupID: "stock-service",  // Consumer Group ID
    },
},
```
## コアクリーンアップ

|サービス|役割|ポート| Kafka設定|
|--------|------|------|-----------|
| order-app | HTTP API +イベント発行| 8080 | Write |
| stock-app |イベント消費| 8081 | Read（GroupID）|

|コンポーネント説明
|-----------|------|
| `publish.Event()` |イベントをKafkaに発行|
| `app.Consumers().Register()` |トピックとハンドラメソッドの関連付け|
| `Event.Name()` | Kafkaトピック名として使用|
| `boot.KafkaOptions` | Kafkaブローカーとオプション設定|
