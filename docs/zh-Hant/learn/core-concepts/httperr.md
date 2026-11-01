# httperr 套件

以下控制器片段用來擴充 [CLI 產生的專案](/zh-Hant/learn/tutorial/1-project-structure)。匯入 `github.com/NARUBROWN/spine/pkg/httpx`、`github.com/NARUBROWN/spine/pkg/httperr` 與 `github.com/NARUBROWN/spine/pkg/path`，並於 `BuildApplication` 註冊建構函式及路由。HTTP 成功值應以 `httpx.Response[T]` 包裝，請求 DTO 應使用 `*Request` 等指標型別；`User`、儲存庫等業務型別由應用程式定義。

`httperr` 讓控制器以語意化錯誤表達 HTTP 失敗，而不必直接寫入 HTTP 回應。

```go
if user == nil {
    return httperr.NotFound("找不到使用者")
}
```

常用函式包括 `BadRequest`（400）、`Unauthorized`（401）與 `NotFound`（404）。`ErrorReturnHandler` 會把這些錯誤轉換為一致的回應；一般 `error` 會進入通用錯誤處理。

讓錯誤維持為回傳值，可使業務邏輯、測試和管線處理保持簡潔。
