# core.ExecutionContext

`core.ExecutionContext` 是攔截器、解析器和管線使用的共同執行階段上下文，適用於 HTTP、訊息消費者和 WebSocket。

```go
type ExecutionContext interface {
    Context() context.Context
    Method() string
    Path() string
    Header(key string) string
    Params() map[string]string
    Queries() url.Values
    Set(key string, value any)
    Get(key string) (any, bool)
}
```

`HttpRequestContext` 另支援 `Param`、`Query`、`Bind` 與 `MultipartForm`；`ConsumerRequestContext` 提供事件名稱和負載；`WebSocketContext` 提供連線 ID、訊息型別和負載。

攔截器和參數解析器應使用這些傳輸細節；控制器則維持面向用例的簽章。
