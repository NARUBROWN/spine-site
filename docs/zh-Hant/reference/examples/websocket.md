# 使用CLI建立WebSocket聊天應用程式

先產生WebSocket元件，再實作廣播邏輯。這是單一程序執行的本機學習範例。

## 產生專案與處理器

先按照[安裝與第一個應用程式](/zh-Hant/learn/getting-started/first-app)安裝 CLI，再使用以下命令產生專案和 WebSocket 處理器。

```sh
spine new chat-app --module example.com/chat-app
cd chat-app
go mod tidy
spine doctor
spine generate websocket chat --path /ws/chat --field message:string
```

產生的檔案為 `src/websocket/chat/chat_message.go`、`chat_handler.go` 和 `module.go`。CLI會在 `BuildApplication` 中自動加入檢查錯誤的 `chatwebsocket.Register(app)`。不要重複註冊路徑或建構函式。

## 實作廣播

產生的處理器會回傳未實作錯誤。將整個 `chat_handler.go` 替換為以下程式碼，移除 `errors` 匯入與未實作錯誤。保留產生的 `chat_message.go` 中的 `ChatMessage`。

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

## 保留產生的組裝結構

保留 `internal/application/application.go` 中 `BuildApplication` 的health註冊和 `chatwebsocket.Register(app)`，將回傳選項改為以下內容並加入 `time` 匯入。保留產生的 `main.go` 中 `BuildApplication` → `Validate` → `Run` 的順序。

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

## 驗證並執行

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine contract check
spine verify
spine contract export --format asyncapi --output asyncapi.json
spine dev
```

`contract check` 檢查靜態契約，`verify` 執行本機Go檢查。實際連線與訊息交換需要另外驗證。啟動伺服器後，在瀏覽器開啟 `http://localhost:8080/health`，並在該分頁的開發者控制台執行以下程式碼。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

每個連線必須先傳送訊息才會加入sender清單。清單只存在於目前程序記憶體中，失效sender在之後傳送失敗時才會清理。範例不提供持久上線狀態或跨伺服器廣播。

## 驗證、Origin與容量

基本範例沒有驗證。若要加入驗證，請實作全部4個 `core.Interceptor` 方法及 `core.WebSocketHandshakeInterceptor.PreHandshake`，並透過 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 註冊。在 `PreHandshake` 驗證憑證並回傳錯誤，才能在upgrade前拒絕請求。訊息級 `PreHandle` 無法單獨保護handshake。

省略 `AllowedOrigins` 時，帶Origin的請求必須同時匹配scheme與host；無Origin客戶端允許連線。正式環境應指定準確的公開Origin，僅信任必要的proxy CIDR。容量耗盡回傳HTTP 503、`Retry-After` 與 `WEBSOCKET_CAPACITY_EXCEEDED`。

[攔截器API](/zh-Hant/reference/api/interceptor) · [安全設定](/zh-Hant/reference/security-configuration)
