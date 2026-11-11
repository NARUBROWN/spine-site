# HTTP 錯誤

處理器與攔截器透過公開 httperr 契約指定狀態與公開訊息，內部詳情以一般錯誤回傳。

## 公開輔助函式

```go
func BadRequest(msg string) error
func Unauthorized(msg string) error
func NotFound(msg string) error
func InternalServerError(msg string) error
```

分別對應 400、401、404、500。其他錯誤可使用 &httperr.HTTPError{Status: 409, Message: "conflict"}。僅 400–599 有效，將 200 或 302 作為錯誤會得到隱藏詳情的 500。成功狀態使用 httpx.Response.Options，重新導向使用 httpx.Redirect。

## 一般錯誤與包裝

一般錯誤回傳 500，不暴露 err.Error()。HTTPError 透過 errors.As 尋找，支援 fmt.Errorf 的 %w 包裝。明確訊息會公開，不應直接填入資料庫原始錯誤。解析與已註冊驗證器失敗在處理器前回傳 400。

## 攔截器優先順序

PreHandle 在綁定前執行，因此即使本文錯誤，驗證失敗也優先回傳 401。後續 BeforeResponse 的錯誤優先於處理器錯誤決定 HTTP 回應；多個失敗時使用最後一個，AfterCompletion 仍保留先前錯誤。完成掛鉤在嘗試寫入後執行，不能修改狀態或執行提交。

## 範例

[Errors and validation](/zh-Hant/learn/tutorial/7-error-handling) / [攔截器](/zh-Hant/learn/tutorial/4-interceptor) / [交易](/zh-Hant/learn/tutorial/6-transaction)
