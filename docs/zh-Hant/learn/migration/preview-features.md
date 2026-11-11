# v0.7.1 HTTP 與啟動選項

::: info
本頁記錄 0.7.1 當時行為與移轉歷史。目前輸入、上下文與驗證請參考 [0.7.5 移轉指南](/zh-Hant/learn/migration/v0.7.5)。
:::


本指南說明 Spine `v0.7.1` 的 OpenAPI UI、HTTP v3 輸入處理、TLS 和關閉行為。移轉既有應用程式時，請同時檢查平台和應用程式程式碼。

## 範例版本 {#versions}

獨立範例使用正式版核心 `v0.7.1` 和 Echo `v0.2.0`，需要 Go 1.25.5 以上版本。在新目錄中建立模組並安裝相依套件，然後將以下程式碼儲存為 `main.go`。請保留 `go.mod` 和 `go.sum`。

```bash
go mod init example.com/boot-example
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

## Swagger UI 與 ReDoc 啟動選項 {#boot}

以下是獨立應用程式的 `main.go`。在既有應用程式中，請將 import 和 `HTTP.OpenAPI` 設定加入目前的組合程式碼。

```go
package main

import (
    "log"

    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }

func (c *Controller) RegisterRoutes(r *api.Registry) {
    r.GET("/hello", func() httpx.Response[string] {
        return httpx.Response[string]{Body: "hello"}
    })
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(constructor.Controller(&Controller{}))
    options := boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        HTTP: &boot.HTTPOptions{
            MaxBodyBytes:         32 << 20,
            MultipartMemoryBytes: 8 << 20,
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Path:    "/openapi.json",
                Title:   "Example API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{Path: "/docs"}),
                    redoc.New(redoc.Options{Path: "/redoc"}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

`Enabled` 預設為 `false`。只設定 `Enabled: true` 時提供 `/openapi.json`，僅加入 `UI` 中註冊的畫面。Swagger UI 預設路徑為 `/docs`，ReDoc 為 `/redoc`。各 UI 可設定 `Path` 與 `Title`。畫面與資源內嵌於二進位檔案，不需 CDN 或 npm。

規格、UI 與資源路徑獨立於 `GlobalPrefix`，支援 GET 與 HEAD。它們不執行業務攔截器，需要限制存取時應在 HTTP 伺服器中介軟體或代理設定。此範例沒有註冊驗證器，因此規格以路徑與方法資訊為主。DTO 詳細規格需要支援 `SchemaDescriber` 的驗證器。動態回應狀態保留於 `default`。請參閱[完整 OpenAPI 選項](/zh-Hant/reference/api/openapi#options)。

## 受管伺服器的 TLS {#tls}

向 `boot.HTTPOptions.TLS` 傳入 `*tls.Config` 即可透過 HTTPS 執行受管伺服器。以下函式需要 `spine`、`boot` 與標準函式庫 `crypto/tls` import。

```go
func runTLS(app spine.App) error {
    certificate, err := tls.LoadX509KeyPair("server.crt", "server.key")
    if err != nil {
        return err
    }
    return app.Run(boot.Options{
        Address: ":8443",
        HTTP: &boot.HTTPOptions{
            TLS: &tls.Config{Certificates: []tls.Certificate{certificate}},
        },
    })
}
```

`TLS: nil` 使用明文 HTTP。準備階段檢查憑證與能力並複製設定。`Serve(listener)` 使用已準備的 TLS 設定，可透過 `Serve(listener, httpcontract.WithTLS(config))` 覆寫。`httpcontract` 的 import 路徑為 `github.com/NARUBROWN/spine/contract/http`。最後一個選項優先，`WithTLS(nil)` 回傳錯誤。僅向外部 `http.Server` 連接 handler 時，TLS 執行與伺服器關閉由外部擁有者管理。本次變更沒有增加 HTTP 版本選擇或 ALPN 政策。

## HTTP v3 輸入與檔案生命週期 {#body}

HTTP v3 由核心使用共通實作解析 JSON、XML、urlencoded form 與 multipart。路徑與查詢值不會合併至本文 DTO。DTO 在全域攔截器的 `PreHandle` 之後解析並分別驗證，路由攔截器的 `PreHandle` 則在繫結之後執行。

`MaxBodyBytes: 0` 表示本文總上限 32 MiB，正值指定位元組上限，負值取消限制。`MultipartMemoryBytes: 0` 表示檔案記憶體預算 32 MiB，正值指定預算，負值導致準備失敗。multipart 預算不是整個請求的記憶體上限，超出預算的檔案寫入磁碟。

表單 DTO 與上傳檔案共用同一 multipart 結果。檔案在所有 `AfterCompletion` 結束前有效，之後刪除暫存檔案。請求結束後仍需使用的檔案應在完成鉤子結束前另行保存。Spine DTO 輸入不呼叫 Echo Binder、JSONSerializer 或 `UnmarshalParam` 擴充。請移轉至標準 JSON、XML 或 Text 解碼器，或於 native Echo 路由使用擴充。Echo 回應輸出擴充保持可用。

## 外部伺服器與自訂 HTTP 配接器移轉 {#prepared}

將 `PreparedApplication.Handler()` 改為回傳 `(http.Handler, error)` 的 `spine.NetHTTPHandler(prepared)`。`prepared.HTTPAdapter()` 回傳同一已準備配接器，HTTP 關閉時回傳 nil。不要重複呼叫配接器的執行與關閉。呼叫方負責外部伺服器關閉與 `prepared.Close(ctx)`。Close 阻止新請求進入，並清理 WebSocket 與包含 native 中介軟體後處理的請求。等待 context 逾時後清理仍會繼續。

自訂 HTTP 平台必須移轉至 `spine.http-adapter/v3`，實作 `Serve(net.Listener, ...httpcontract.ServeOption) error` 並宣告 TLS capability。`adapter` 與 `adapter/http` 別名不會自動轉換 v2 實作。net/http 是獨立模組，不支援 `DisableRecover: true`。請參閱[完整 HTTP v3 移轉指南](https://github.com/NARUBROWN/spine/blob/v0.7.1/docs/migration/http-v3.md)。

## 其他執行行為 {#merged}

以下是 `v0.7.1` 的路徑、關閉和事件處理行為。

- 路徑值：`/users/:id` 與 `/users/:userID/posts` 使用各自路由的鍵繫結。`/files/:name` 中的 `a%2Fb` 只解碼一次為 `a/b`，`a%252Fb` 為 `a%2Fb`。實際路徑 `/files/a/b` 不符合該路由。
- 關閉：WebSocket 清理發生 panic 後仍繼續清理後續應用程式資源，且不會將實際 HTTP Serve 錯誤隱藏為正常關閉。
- 事件：向 `spine.WithEventPublisherErrorHistory` 與 `spine.WithEventConsumerErrorHistory` 傳入 `boot.CleanupErrorHistoryOptions{MaxEntries, MaxAge}`，分別設定各角色的清理失敗歷程。預設保留最近 32 筆、最長 1 小時，先達到的限制生效。0 使用預設值，負值導致預檢失敗。不改變日誌保留政策與已回傳的關閉結果。
- nil 事件本文：raw byte handler 區分 nil tombstone 與長度為 0 的 nonnil slice。需要本文的 DTO handler 保持原有失敗政策。
- Swagger UI：修正 base64url、指數表示的 multipleOf 與沒有 items 的 contains 範例產生問題。
- 發佈組合：驗證包括 net/http 在內的六個平台。僅發佈核心標籤或通過原始碼 CI，不代表公開組合驗證已完成。

## 透過請求驗證 {#verify}

透過 `go run main.go` 執行獨立參考應用程式。`/hello` 應回傳 HTTP 200，規格與兩個 UI 的 HEAD 請求也應回傳 200。在瀏覽器開啟 `/docs` 與 `/redoc` 檢查呈現。CLI 產生的應用程式執行已設定的進入點；將相同選項加入 `BuildApplication` 後可使用 `spine run`。

```bash
curl -i http://localhost:8080/hello
curl -I http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

## 相關文件與合併依據 {#sources}

- [OpenAPI](/zh-Hant/reference/api/openapi)
- [v0.7.1](/zh-Hant/learn/migration/v0.7.1-preview)
- [Preview → RC → Production](/zh-Hant/community/release-channels)
- [Spine #26: OpenAPI UI](https://github.com/NARUBROWN/spine/pull/26)
- [Spine #32: HTTP v3 / TLS](https://github.com/NARUBROWN/spine/pull/32)
- [Spine #33: Preview](https://github.com/NARUBROWN/spine/pull/33)
- [Spine #34: Preview](https://github.com/NARUBROWN/spine/pull/34)
- [Spine CLI #39: HTTP v3 / net/http](https://github.com/NARUBROWN/spine-cli/pull/39)
