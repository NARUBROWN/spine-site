# 處理器中繼資料

::: info 0.7.5
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

`core.HandlerMeta` 是處理器資訊的副本，不能修改執行註冊或 writer。

## 欄位 {#fields}

```go
type HandlerMeta struct {
	ControllerType   reflect.Type
	MethodName       string
	Signature        reflect.Type
	PathKeys         []string
	InterceptorTypes []reflect.Type
	CallbackRoute    bool
}
```

## 查詢 {#methods}

`FunctionType()` 回傳函式型別。`ArgumentOffset()` 對回呼為 0，對舊方法運算式為 1。回呼的 `HandlerName()` 回傳控制器的 RegisterRoutes 名稱，並非每個回呼的唯一識別。PathKeys 包含鍵名而非值。使用公開查詢與 InterceptorTypes 取代已移除的 Method、Callback、Interceptors 欄位。

## 時機與生命週期 {#lifetime}

全域 PreHandle 在路由前接收空中繼資料。路由 PreHandle 接收已選擇的中繼資料，在綁定前執行。修改欄位或切片不會改變註冊。透過 Ctx 的公開檢視讀取請求資訊。

[公開上下文](/zh-Hant/reference/api/execution-context) | [攔截器](/zh-Hant/learn/tutorial/4-interceptor)
