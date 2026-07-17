# ExecutionContext

## 概覽

`ExecutionContext` 是管線執行請求時傳遞的執行階段上下文。它提供 HTTP、訊息消費者與 WebSocket 的共同能力，同時保留各協定特有資料。

```go
type ExecutionContext interface {
    Context() context.Context
    Method() string
    Path() string
    Params() map[string]string
    Queries() url.Values
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

## 專用上下文

- `HttpRequestContext`：`Param`、`Query`、`Headers`、`Bind`、`MultipartForm`。
- `ConsumerRequestContext`：事件名稱與負載。
- `WebSocketContext`：連線 ID、訊息型別與負載。
- `ControllerContext`：讀取攔截器放入內部儲存的值。

## 用法

攔截器與參數解析器讀取傳輸細節；控制器只表達用例。所有協定共享單一管線，協定專屬能力仍清楚隔離。
