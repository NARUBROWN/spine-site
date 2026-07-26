# 安全設定參考

Spine 使用加密傳輸和有界執行階段預設值。部署檢查應呼叫 `App.Validate`；`App.Run` 會自動執行同一套無網路預檢。

## 預設值

| 領域 | 預設行為 | 明確的開發或相容選項 |
|---|---|---|
| Kafka | 每個啟用的 reader/writer 使用隱式 TLS 1.2 以上 | 自訂 `TLS`/`Dialer`/`Transport`，或僅本機使用 `AllowInsecureTransport: true` |
| RabbitMQ | 要求 `amqps://` | `amqp://` 搭配 `AllowInsecureTransport: true` |
| RabbitMQ 發布 | 持久訊息、強制路由、publisher confirms、有界重試 | 調整 `PublisherRetry` |
| RabbitMQ 處理器失敗 | 拒絕且不重新入列 | `FailurePolicy: boot.RabbitMqFailureRequeue` |
| RabbitMQ prefetch | 每個消費者 1 筆未確認訊息 | 正數 `PrefetchCount` |
| 消費者傳輸失敗 | 指數退避和抖動後重建 reader | 設定 `ConsumerRetry` |
| WebSocket 來源 | scheme 與 host 必須相同 | 精確 `AllowedOrigins` |
| WebSocket 容量 | 1024 個作用中及待處理連線 | 正數限制或 `UnlimitedWebSocketConnections` |
| WebSocket 驗證 | `WebSocketHandshakeInterceptor` 在 upgrade 前執行 | 每個受保護 WS 路由實作握手驗證 |
| 全域攔截器 | HTTP 與 WebSocket | 用 `InterceptorFor` 縮小範圍 |
| 帶憑證 CORS | 必須使用明確來源 | 不支援萬用來源 |
| Cookie 序列化 | 寫入回應前拒絕非法欄位 | 任意值先用 `EncodeCookieValue` |

## 啟動前驗證

```go
opts := boot.Options{
	Address: ":8080",
	HTTP: &boot.HTTPOptions{},
}

if err := app.Validate(opts); err != nil {
	var configErr *boot.ConfigError
	if errors.As(err, &configErr) {
		for _, issue := range configErr.Issues {
			log.Printf("%s [%s]: %s", issue.Path, issue.Code, issue.Hint)
		}
	}
	log.Fatal(err)
}
```

`boot.ConfigError.Issues` 中的 `Code` 是穩定的機器可讀部署診斷；不要剖析面向人的錯誤文字，也不要在日誌中輸出代理憑證。

## 執行要求

- 只在隔離的本機環境啟用不安全的訊息代理傳輸。
- 為 Spine 消費佇列設定 DLX 前，先在 RabbitMQ 中建立對應的 dead-letter exchange，並對齊現有佇列參數。
- Kafka/RabbitMQ 消費者必須具備冪等性；重連與確認遺失可能導致至少一次重投或重複。
- 啟用 `TrustedProxyCIDRs` 時，代理必須移除或覆寫客戶端提供的 forwarding headers。
- 監控 `WEBSOCKET_CAPACITY_EXCEEDED`、消費者重連耗盡以及 RabbitMQ `Type`/`RoutingKey` 不一致日誌。

支援的版本請參閱[目前版本](/zh-Hant/community/changelog)。
