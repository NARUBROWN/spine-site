# 建立 WebSocket 聊天室

建立聊天伺服器，將透過 `/ws/chat` 收到的訊息廣播給已註冊的用戶端。使用 CLI 產生 WebSocket 元件，實作處理器後，在瀏覽器中確認訊息的傳送與接收。

## 開始前的準備

請先完成[安裝與第一個應用程式](/zh-Hant/learn/getting-started/first-app)。此範例是供本機學習使用的程式碼，在單一伺服器程序中執行，不包含身分驗證或跨伺服器廣播。

## 1. 建立專案和訊息處理器

建立專案並產生 WebSocket 處理器。後續命令均在 `chat-app/` 中執行。

```sh
spine-cli new chat-app --layout legacy --module example.com/chat-app
cd chat-app
spine-cli doctor
spine-cli generate websocket chat --path /ws/chat --field message:string
```

`src/websocket/chat/` 下會產生 `chat_message.go`、`chat_handler.go` 和 `module.go`。`BuildApplication` 會自動加入 `chatwebsocket.Register(app)` 呼叫和錯誤檢查程式碼。請勿重複註冊相同路徑或建構函式。

## 2. 實作廣播處理器

產生的處理器會回傳未實作錯誤。請以下列程式碼取代整個 `src/websocket/chat/chat_handler.go`。完整取代後，原有的 `errors` 匯入和未實作錯誤宣告也會一併移除。`chat_message.go` 中的 `ChatMessage` 和 `module.go` 繼續沿用。

處理器會先註冊傳送訊息之連線的傳送器，再將非空訊息轉送給所有已註冊的連線。傳送失敗的連線會從清單移除。

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

## 3. 設定 WebSocket 執行選項

在 `internal/application/application.go` 中，只將 `BuildApplication` 回傳的選項改為以下程式碼，並加入 `time` 匯入。保留現有的 health 註冊和 `chatwebsocket.Register(app)` 呼叫。產生在根目錄的 `main.go` 會依序執行 `BuildApplication`、`Validate`、`Run`。

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

## 4. 驗證並啟動伺服器

在專案根目錄檢查程式碼，匯出 AsyncAPI 文件，然後啟動伺服器。

```sh
gofmt -w src/websocket/chat/chat_handler.go internal/application/application.go
spine-cli contract check
spine-cli verify
spine-cli contract export --format asyncapi --output asyncapi.json
spine-cli dev
```

`contract check` 檢查靜態契約。`verify` 檢查靜態契約，並執行 gofmt、go vet 和 Go 測試。`contract export` 會將已註冊的 WebSocket 契約寫入 `asyncapi.json`。實際連線和訊息交換會在下一步確認。

## 5. 在瀏覽器確認訊息的傳送與接收

啟動伺服器後，在瀏覽器開啟 `http://localhost:8080/health`。接著在同一分頁的開發人員工具主控台中執行以下程式碼。

```js
const socket = new WebSocket('ws://localhost:8080/ws/chat')
socket.onmessage = (event) => console.log(JSON.parse(event.data))
socket.onopen = () => socket.send(JSON.stringify({ message: 'hello' }))
```

確認主控台輸出包含 `type`、`from`、`message` 和 `at` 欄位的物件。`message` 的值為 `hello`。在另一個分頁執行相同程式碼，已註冊的連線和新連線都能收到訊息。

每個連線都必須先傳送訊息以註冊傳送器，才能接收廣播。傳送器清單只儲存在程序記憶體中，已結束的連線會在之後傳送失敗時清除。若要持久儲存連線狀態或在多個伺服器之間共用，需要另外實作。

## 套用於正式環境前的注意事項

### 交握驗證

若要加入身分驗證，請實作 `core.Interceptor` 的四個方法和 `core.WebSocketHandshakeInterceptor.PreHandshake`，並以 `app.InterceptorFor(boot.InterceptorWebSocket, auth)` 註冊。在 `PreHandshake` 驗證憑證並回傳錯誤，即可在升級為 WebSocket 連線前拒絕請求。僅在訊息處理階段使用 `PreHandle`，無法保護交握。

### Origin 與連線數限制

若省略 `AllowedOrigins`，含有 Origin 的請求必須具有相同的協定和主機。不含 Origin 的用戶端則會獲准連線。正式環境請設定確切的公開 Origin，必要時僅指定受信任 Proxy 的 CIDR。超過連線數上限時，會回傳 HTTP 503、`Retry-After` 和 `WEBSOCKET_CAPACITY_EXCEEDED`。

## 下一步

請在[攔截器 API](/zh-Hant/reference/api/interceptor)中確認實作驗證所需的方法，並在[安全設定](/zh-Hant/reference/security-configuration)中檢視 Origin 與連線限制。
