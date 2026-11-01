# KafkaによるMSAの例

CLIで注文HTTPサービスと在庫コンシューマーを別々に生成します。注文サービスが`order.created`を発行し、HTTPリスナーを持たない在庫サービスが処理します。

## CLIで2つのサービスを生成

先に[CLIをインストール](/ja/learn/getting-started/installation)します。以降は`spine-msa/`で実行します。CLI 0.1.4は型付きconsumerの骨組みを生成しますが、Kafkaブローカーや転送設定は生成しません。

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --module example.com/order-app --dry-run
spine new stock-app --module example.com/stock-app --dry-run
```

プレビューで生成ファイルと登録コードの変更を確認し、以下のコマンドで生成します。

```sh
spine new order-app --module example.com/order-app
spine new stock-app --module example.com/stock-app
```

## コンシューマーの骨組みを生成

既定の自動登録は`stock-app/internal/application/application.go`にエラーを確認する`order.Register(app)`を追加します。生成直後のhandlerは未実装エラーを返すため、以下の実装に置き換えるまで検証には通りません。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

## 最終的な構造

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

## 共有イベント

`order-app/src/events`は両サービスが再利用するイベントパッケージです。この例ではstockモジュールがorderモジュールの該当パッケージだけをインポートします。後述の`go mod edit`でローカルモジュールを接続します。

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

## 注文サービス：イベント発行

以下の2ファイルを手動で追加・置換します。CLIが生成したルートの`main.go`と`spine.toml`は維持します。`publish.Event`は現在のリクエストにイベントを追加し、戻り値はありません。handlerとレスポンス準備の成功後、設定されたKafka writerが発行します。

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

## 在庫サービス：イベント処理

生成された`order_message.go`を共有イベントのエイリアスに変え、`order_handler.go`の未実装エラーを除きます。メモリ重複排除は同じプロセス内だけで有効です。実際の在庫変更と永続的な重複排除は同じDBトランザクションで実装します。構成ファイルは以下の全体コードで置き換え、自動登録を重複追加しないでください。

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

## モジュール接続と検証

各サービスに独立した`go.mod`と`spine.toml`があります。以下は`spine-msa/`から開始し、最後に同じ場所へ戻ります。生成された各`main.go`は`BuildApplication`、`Validate`、`Run`の順に実行します。

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

ローカル平文設定のため、各サービスで`INSECURE_TRANSPORT_ENABLED`が1件出るのは想定どおりです。既定の検査には通りますが、`--warnings-as-errors`では失敗します。

`contract check`は静的契約、`verify`は契約、gofmt、vet、Goテストを検査します。ブローカー接続やメッセージ配信は確認しません。

## ブローカー準備後に実行

Kafkaを別途`localhost:9092`で準備し、`order.created`トピックを作成します。別々のターミナルを開き、どちらも`spine-msa/`から実行します。

```sh
spine run --root stock-app
```

```sh
spine run --root order-app
```

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

POSTの応答はHTTP 202、本文は`accepted`です。ブローカーが正常なら在庫プロセスで`topic=order.created order_id=12345`のログを確認します。HTTP応答だけでは消費完了の証拠になりません。

## 転送と整合性の境界

`AllowInsecureTransport: true`は隔離されたローカル平文ブローカー専用です。本番では除去し、TLS/SASLとbrokerアドレスを設定します。既定の転送はTLS 1.2以上で、独自設定では読み書きの両方を保護します。

`TopicPrefix`は単純な文字列連結です。writerに`prod.`を使う場合、consumerも`prod.order.created`で明示登録します。この例では両方とも接頭辞なしの`order.created`を使います。検査と実行で同じ設定を使ってください。

Kafkaは少なくとも1回配信するため、安定したイベントIDと永続的な重複排除が必要です。`ConsumerRetry`はreader・転送の再構築を制御し、業務handlerの再試行回数を制限しません。永続的に失敗するメッセージはパーティションを止めることがあり、自動skipやDLQへの移動は行いません。

DBコミットとbroker発行は原子的ではありません。確実なDB・イベント処理にはtransactional outboxとconsumerの重複排除を別途実装します。[セキュリティ設定](/ja/reference/security-configuration)も参照してください。
