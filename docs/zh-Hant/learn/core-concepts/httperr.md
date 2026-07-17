# httperr 套件

`httperr` 讓控制器以語意化錯誤表達 HTTP 失敗，而不必直接寫入 HTTP 回應。

```go
if user == nil {
    return httperr.NotFound("找不到使用者")
}
```

常用函式包括 `BadRequest`（400）、`Unauthorized`（401）與 `NotFound`（404）。`ErrorReturnHandler` 會把這些錯誤轉換為一致的回應；一般 `error` 會進入通用錯誤處理。

讓錯誤維持為回傳值，可使業務邏輯、測試和管線處理保持簡潔。
