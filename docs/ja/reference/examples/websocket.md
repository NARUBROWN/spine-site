# CLIでWebSocketチャットを作る

CLIでWebSocketコンポーネントを生成し、ブロードキャストを実装します。単一プロセスで動くローカル学習用の例です。

## プロジェクトとハンドラーを生成する

[インストールと最初のアプリ](/ja/learn/getting-started/first-app)でCLIをインストールしてから、以下でプロジェクトとWebSocketハンドラーを生成します。

```sh
spine new chat-app --module example.com/chat-app
cd chat-app
go mod tidy
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

生成ファイルは `src/websocket/chat/chat_message.go`、`chat_handler.go`、`module.go` です。`BuildApplication` にエラーを確認する `chatwebsocket.Register(app)` が自動追加されます。同じパスやコンストラクタを再登録しないでください。

## ブロードキャストを実装する

生成ハンドラーは未実装エラーを返します。`chat_handler.go` 全体を以下で置き換え、`errors` importと未実装エラーを削除します。`ChatMessage` は生成された `chat_message.go` に残します。

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

## 生成された構成を維持する

`internal/application/application.go` の `BuildApplication` でhealth登録と `chatwebsocket.Register(app)` を維持し、返すオプションを以下に変更します。`time` importを追加します。生成された `main.go` の `BuildApplication` → `Validate` → `Run` を維持します。

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

## 検証して実行する

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check` は静的契約、`verify` はローカルGo検証です。接続とメッセージ交換は別途確認します。サーバー起動後、ブラウザーで `http://localhost:8080/health` を開き、そのタブの開発者コンソールで実行します。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

各接続は最初にメッセージを送るとsender一覧に登録されます。一覧はプロセス内メモリのみで、切断したsenderは後の送信失敗時に削除されます。永続的な接続管理やサーバー間の配信は提供しません。

## 認証・Origin・接続上限

基本例に認証はありません。追加する場合は4つの `core.Interceptor` メソッドと `core.WebSocketHandshakeInterceptor.PreHandshake` を実装し、`app.InterceptorFor(boot.InterceptorWebSocket, auth)` で登録します。upgrade前に拒否するには `PreHandshake` で認証情報を検証してエラーを返します。メッセージの `PreHandle` だけではhandshakeを保護できません。

`AllowedOrigins` を省略すると、Origin付きリクエストはschemeとhostの一致が必要です。Originなしクライアントは許可されます。本番では正確な公開Originと必要なproxy CIDRを指定します。上限超過時はHTTP 503、`Retry-After`、`WEBSOCKET_CAPACITY_EXCEEDED` を返します。

[インターセプターAPI](/ja/reference/api/interceptor) · [セキュリティ設定](/ja/reference/security-configuration)
