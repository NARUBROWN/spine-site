# WebSocket チャットを作る

`/ws/chat` で受け取ったメッセージを登録済みのクライアントにブロードキャストするチャットサーバーを作ります。CLI で WebSocket のコンポーネントを生成し、ハンドラーを実装してから、ブラウザーでメッセージの送受信を確認します。

## 事前準備

先に[インストールと最初のアプリ](/ja/learn/getting-started/first-app)を完了してください。この例は、単一のサーバープロセスで動作するローカル学習用のコードです。認証や複数のサーバー間でのブロードキャストは含みません。

## 1. プロジェクトとメッセージハンドラーを生成する

プロジェクトと WebSocket ハンドラーを生成します。以降のコマンドは `chat-app/` で実行します。

```sh
spine new chat-app --layout legacy --module example.com/chat-app
cd chat-app
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

`src/websocket/chat/` に `chat_message.go`、`chat_handler.go`、`module.go` が生成されます。`BuildApplication` には、`chatwebsocket.Register(app)` の呼び出しとエラー確認のコードが自動で追加されます。同じパスやコンストラクタを再登録しないでください。

## 2. ブロードキャストハンドラーを実装する

生成されたハンドラーは未実装エラーを返します。`src/websocket/chat/chat_handler.go` 全体を以下のコードに置き換えます。全体を置き換えると、既存の `errors` のインポートと未実装エラーの宣言も削除されます。`chat_message.go` の `ChatMessage` と `module.go` はそのまま使用します。

ハンドラーは、メッセージを送信した接続の送信器を登録してから、空でないメッセージを登録済みのすべての接続に渡します。送信に失敗した接続は一覧から削除します。

```go
package chat

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/NARUBROWN/spine/pkg/ws"
)

type ChatSocket struct {
	mu      sync.RWMutex
	clients map[string]ws.Sender
}

func NewChatSocket() *ChatSocket {
	return &ChatSocket{
		clients: make(map[string]ws.Sender),
	}
}

type ChatEvent struct {
	Type    string `json:"type"`
	From    string `json:"from"`
	Message string `json:"message"`
	At      string `json:"at"`
}

func (c *ChatSocket) Handle(
	ctx context.Context,
	connID ws.ConnectionID,
	msg ChatMessage,
) error {
	sender, ok := ctx.Value(ws.SenderKey).(ws.Sender)
	if ok && sender != nil {
		c.mu.Lock()
		c.clients[connID.Value] = sender
		c.mu.Unlock()
	}

	message := strings.TrimSpace(msg.Message)
	if message == "" {
		return nil
	}

	payload, err := json.Marshal(ChatEvent{
		Type:    "message",
		From:    connID.Value,
		Message: message,
		At:      time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	c.mu.RLock()
	clients := make(map[string]ws.Sender, len(c.clients))
	for id, client := range c.clients {
		clients[id] = client
	}
	c.mu.RUnlock()

	for id, client := range clients {
		if err := client.Send(ws.TextMessage, payload); err != nil {
			c.mu.Lock()
			delete(c.clients, id)
			c.mu.Unlock()
		}
	}
	return nil
}
```

## 3. WebSocket の実行オプションを設定する

`internal/application/application.go` の `BuildApplication` が返すオプションだけを以下のコードに変更し、`time` のインポートを追加します。既存の health 登録と `chatwebsocket.Register(app)` の呼び出しは維持します。生成されたルートの `main.go` は、`BuildApplication`、`Validate`、`Run` を順に実行します。

```go
return app, boot.Options{
    Address: address,
    EnableGracefulShutdown: true,
    ShutdownTimeout: 10 * time.Second,
    HTTP: &boot.HTTPOptions{
        WebSocket: boot.WebSocketOptions{
            MaxConnections: 1024,
            MaxMessageBytes: 1 << 20,
            HandshakeTimeout: 10 * time.Second,
            ReadTimeout: 60 * time.Second,
            WriteTimeout: 10 * time.Second,
            PingInterval: 30 * time.Second,
        },
    },
}, nil
```

## 4. 検証してサーバーを起動する

プロジェクトルートでコードを検査し、AsyncAPI ドキュメントをエクスポートしてからサーバーを起動します。

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check` は静的な契約を検査します。`verify` は静的な契約に加え、gofmt、go vet、Go テストを検査します。`contract export` は、登録された WebSocket 契約を `asyncapi.json` に記録します。実際の接続とメッセージ交換は、次の手順で確認します。

## 5. ブラウザーでメッセージの送受信を確認する

サーバーの起動後、ブラウザーで `http://localhost:8080/health` を開きます。同じタブの開発者ツールのコンソールで、次のコードを実行します。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

コンソールに `type`、`from`、`message`、`at` フィールドを持つオブジェクトが出力されることを確認します。`message` の値は `hello` です。別のタブでも同じコードを実行すると、登録済みの接続と新しい接続でメッセージを受信できます。

ブロードキャストを受信するには、各接続から先にメッセージを送信して送信器を登録する必要があります。送信器の一覧はプロセスメモリにのみ保存され、終了した接続は、その後の送信に失敗した時点で削除されます。接続状態を永続的に保存したり、複数のサーバー間で共有したりするには、別途実装が必要です。

## 本番環境に適用する前に確認する点

### ハンドシェイク認証

認証を追加するには、`core.Interceptor` の 4 つのメソッドと `core.WebSocketHandshakeInterceptor.PreHandshake` を実装し、`app.InterceptorFor(boot.InterceptorWebSocket, auth)` で登録します。`PreHandshake` で認証情報を検証してエラーを返すと、WebSocket 接続に切り替える前にリクエストを拒否できます。メッセージ処理段階の `PreHandle` だけでは、ハンドシェイクを保護できません。

### Origin と接続数の制限

`AllowedOrigins` を省略すると、Origin のあるリクエストはスキームとホストが一致している必要があります。Origin のないクライアントは許可されます。本番環境では正確な公開 Origin を設定し、必要に応じて信頼するプロキシの CIDR のみを指定します。接続数の上限を超えると、HTTP 503 と `Retry-After`、`WEBSOCKET_CAPACITY_EXCEEDED` が返されます。

## 次のステップ

[インターセプター API](/ja/reference/api/interceptor)で認証の実装に必要なメソッドを確認し、[セキュリティ設定](/ja/reference/security-configuration)で Origin と接続制限を確認してください。
