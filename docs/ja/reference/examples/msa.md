# Kafka で注文サービスと在庫サービスを接続する

::: info 0.7.5 API
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

注文用の HTTP サービスと在庫のコンシューマーサービスをそれぞれ作成し、Kafka で `order.created` イベントを渡します。注文リクエストを送信した後、在庫サービスの処理ログまで確認します。在庫サービスは HTTP リスナーなしで実行します。

## 事前準備

[CLI インストール](/ja/learn/getting-started/installation)後、0.7.5 API 対応の Preview CLI を使います。CLI とアプリ依存のチャネルは別です。

メッセージの配信を確認するには、`localhost:9092` の Kafka ブローカーと `order.created` トピックが必要です。この例では、隔離されたローカル環境の平文接続を使用します。在庫コンシューマーはイベントをログに記録し、実際の在庫数は変更しません。

## 1. 2 つのサービスを作成する

作業ディレクトリを作り、生成するファイルを先に確認します。

以下は Preview 依存を選択します。生成された go.mod で実際のコアとプラットフォーム版を確認してください。

```sh
mkdir spine-msa
cd spine-msa
spine new order-app --module example.com/order-app --event-platform kafka --channel preview --no-interactive --dry-run
spine new stock-app --module example.com/stock-app --platform none --event-platform kafka --channel preview --no-interactive --dry-run
```

プレビューを確認してから 2 つのアプリを作成します。以降のコマンドは、別途指定がなければ `spine-msa/` で実行します。

```sh
spine new order-app --module example.com/order-app --event-platform kafka --channel preview --no-interactive
spine new stock-app --module example.com/stock-app --platform none --event-platform kafka --channel preview --no-interactive
```

## 2. 在庫コンシューマーのひな形を生成する

`stock-app` に、注文イベントを受け取るコンシューマーを生成します。まずプレビューを確認します。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64 --dry-run
```

次のコマンドはコンシューマーのファイルを作成し、`stock-app/internal/application/application.go` に `order.Register(app)` の呼び出しとエラー確認のコードを追加します。生成直後のハンドラーは未実装エラーを返すため、検証を通過するには手順 5 のコードに置き換える必要があります。

```sh
spine generate consumer order --root stock-app --topic order.created --field event_id:string --field order_id:int64
```

### ファイル構成

共有イベントと注文コントローラーを追加し、生成されたコンシューマーの実装とアプリ設定を置き換えると、次の構成になります。

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

生成した `platform_config.go` と2つのテストファイルを保持します。以下のBuildApplicationは生成された `loadKafkaConfig` で環境設定を検査し、注文サービスは発行のみ、在庫ワーカーは消費のみを選びます。実行する各ターミナルでブローカーとグループを指定します。

## 3. 共有イベントを定義する

`order-app/src/events/order_created.go` を新規作成します。2 つのサービスは、このパッケージのイベント型を共用します。`stock-app` が `order-app` のイベントパッケージをインポートできるよう、手順 6 で `go mod edit` を使ってローカルモジュールを接続します。

```go
// order-app/src/events/order_created.go
package events

import "time"

type OrderCreated struct {
	EventID string    `json:"event_id"`
	OrderID int64     `json:"order_id"`
	At      time.Time `json:"at"`
}

func (e OrderCreated) Name() string          { return "order.created" }
func (e OrderCreated) OccurredAt() time.Time { return e.At }
```

## 4. 注文サービスでイベントを発行する

`order-app/src/controller/order_controller.go` を新規作成し、`order-app/internal/application/application.go` を以下のコードに置き換えます。ルートの `main.go` と `spine.toml` はそのまま使用します。

`publish.Event` は現在のリクエストにイベントを追加し、戻り値はありません。ハンドラーが成功し、レスポンスの準備が完了すると、設定した Kafka パブリッシャーがイベントを送信します。

```go
// order-app/src/controller/order_controller.go
package controller

import (
	"fmt"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"time"

	"example.com/order-app/src/events"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/event/publish"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
)

type OrderController struct{}

func (*OrderController) Constructor() *OrderController { return &OrderController{} }

func (c *OrderController) RegisterRoutes(r *api.Registry) {
	r.POST("/orders/:order_id", c.Create)
}

func (c *OrderController) Create(ctx spinectx.Ctx, id input.Path[int64]) (httpx.Response[string], error) {
	if *id <= 0 {
		return httpx.Response[string]{}, httperr.BadRequest("order ID must be positive")
	}
	publish.Event(ctx.ExecutionContext().Context(), events.OrderCreated{
		EventID: fmt.Sprintf("order.created:%d", *id),
		OrderID: *id,
		At:      time.Now().UTC(),
	})
	return httpx.Response[string]{
		Body:    "accepted",
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
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP:                   &boot.HTTPOptions{},
	}, nil
}
```

## 5. 在庫サービスでイベントを処理する

次の 3 つのファイルを、それぞれ以下のコードに置き換えます。`order_message.go` は共有イベントの型エイリアスに変更し、`order_handler.go` には未実装エラーの代わりに検証、重複確認、ログ出力を実装します。生成された `module.go` はそのまま使用します。

`stock-app/internal/application/application.go` を丸ごと置き換えるコードには、`order.Register(app)` が含まれています。生成時に追加された登録コードを重ねて追加しないでください。

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
	"fmt"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
	"sync"
)

type OrderConsumer struct {
	mu        sync.Mutex
	processed map[string]struct{}
}

func NewOrderConsumer() *OrderConsumer {
	return &OrderConsumer{processed: make(map[string]struct{})}
}

func (c *OrderConsumer) Handle(ctx spinectx.Ctx, eventName string, event OrderEvent) error {
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
		ShutdownTimeout:        10 * time.Second,
	}, nil
}
```

## 6. ローカルモジュールを接続し、コードを検証する

2 つのサービスは、それぞれ独立した `go.mod` と `spine.toml` を使用します。次のコマンドは `spine-msa/` から開始し、2 つのモジュールを接続して検査した後、同じ場所に戻ります。各アプリに生成された `main.go` は、`BuildApplication`、`Validate`、`Run` を順に実行します。

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

この例のfactoryはローカル平文接続を明示的に許可します。CLIの静的契約検査はfactory設定を実行せず、転送の安全性やブローカーの準備状態を証明しません。

`contract check` は静的な契約を検査します。`verify` は静的な契約に加え、gofmt、go vet、Go テストを検査します。ブローカー接続と実際のメッセージ配信は、次の手順で確認します。

## 7. 実行してイベントの配信を確認する

Kafka が `localhost:9092` で起動しており、`order.created` トピックが存在することを確認します。各ターミナルの作業ディレクトリを `spine-msa/` に合わせます。

1 つ目のターミナルで在庫サービスを起動します。

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=stock-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root stock-app
```

2 つ目のターミナルで注文サービスを起動します。

```sh
SPINE_KAFKA_BROKERS=localhost:9092 SPINE_KAFKA_GROUP_ID=order-service \
SPINE_KAFKA_ALLOW_INSECURE=true spine run --root order-app
```

3 つ目のターミナルで注文作成リクエストを送信します。

```sh
curl -i -X POST http://localhost:8080/orders/12345
```

HTTP 202 と本文 `accepted` が返されることを確認します。続けて在庫サービスのターミナルで、`topic=order.created order_id=12345` のログを確認します。HTTP レスポンスは注文リクエストの結果であり、在庫サービスのログはイベント消費の結果です。サービス間の配信を検証するには、両方を確認する必要があります。

## 本番環境に適用する前に確認する点

### トランスポートのセキュリティとトピック名

`AllowInsecureTransport: true` は、隔離されたローカルの平文ブローカーにのみ使用します。本番環境ではこのオプションを削除し、TLS/SASL とブローカーアドレスを設定します。既定のトランスポートは TLS 1.2 以上を使用します。トランスポート設定を直接指定する場合は、読み取りと書き込みの両方を保護する必要があります。

`Config.TopicPrefix` は発行名と消費側の購読の両方に接頭辞を付けます。両factoryに `prod.` を設定する場合、アプリには `order.created` を登録し、ブローカーに `prod.order.created` を準備します。区切り文字は接頭辞に含めます。

### 重複処理と失敗するメッセージ

Kafka はメッセージを少なくとも 1 回配信するため、同じイベントが再度届くことがあります。同じイベントを再送する際にも維持されるイベント ID と、永続的な重複処理の防止が必要です。この例の重複処理の防止は、同じプロセス内でのみ有効です。実際の在庫変更と永続的な重複処理の防止は、同じ DB トランザクションで実装する必要があります。

`spine.WithEventConsumerRetry` はリーダーとトランスポート層の再構成を調整するもので、業務ハンドラーの再試行回数は制限しません。失敗し続けるメッセージは、パーティションの処理を止める可能性があります。メッセージを自動的にスキップしたり、DLQ に移動したりはしません。

### DB の変更とイベントの発行

DB コミットとブローカーへの発行は、単一のアトミックな操作ではありません。DB の変更とイベント配信の整合性を保つ必要がある場合は、transactional outbox とコンシューマーの重複処理の防止を別途実装してください。

## 次のステップ

[セキュリティ設定](/ja/reference/security-configuration)で Kafka の接続設定を確認してください。実際の在庫リポジトリを接続する際は、イベント ID を永続的に記録し、在庫変更と一緒にコミットするよう構成してください。
