# v0.7.0 Preview 功能與啟動選項

::: warning Preview
以下可執行範例需要 Spine `v0.7.0-preview.7` 或更新版本。 [Preview](/zh-Hant/learn/migration/preview-controller-routes)
:::

透過啟動選項啟用 Swagger UI 與 ReDoc，並了解移轉至 HTTP v3 與 net/http 平台所需的修改。本頁也整理已合併至 Preview 的路徑處理、關閉處理與事件清理歷程變更。

::: warning 僅適用於 Preview
本頁以 `preview` 分支為準，不能直接套用至穩定版 `v0.6.5`。請區分功能首次發佈版本與目前分支變更。`@preview` 會移動，請一起保存應用程式原始碼、`go.mod` 與 `go.sum`。
:::

## 版本與安裝 {#versions}

| 功能 | 首次發佈版本 |
| --- | --- |
| 依來源劃分的輸入 DTO 與 OpenAPI JSON | Spine `v0.7.0-preview.1` |
| 內嵌 Swagger UI 與 ReDoc | Spine `v0.7.0-preview.2` |
| HTTP v3、TLS 與 net/http 平台 | Spine `v0.7.0-preview.3`, Echo `v0.2.0-preview.2`, net/http `v0.1.0-preview.1` |
| HTTP v3 分析及 net/http 應用程式產生與更新 | CLI `v0.4.3-preview.4` |
| 控制器路由、角色建構函式與 API 群組 | Spine `v0.7.0-preview.7`, CLI `v0.4.3-preview.8` |

需要 Go 1.25.5 或更新版本。選擇 playground 驗證器時需要 Go 1.26 或更新版本。也可透過 `--platform nethttp` 選擇 net/http。使用預設 Go 代理設定時，Preview 分支中繼資料從來源儲存庫查詢，因此需要 Git。安裝 CLI 與更新應用程式相依套件是兩個操作。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
spine new preview-api --module example.com/preview-api --platform echo
cd preview-api
spine contract check
spine verify
```

既有應用程式依[輸入移轉指南](/zh-Hant/learn/migration/v0.7.0-preview#versions)選擇 `recipe = "platform-contracts-preview"`。檢查 `spine update --dry-run` 的變更後，執行輸出中提供的套用指令。`update` 不改寫應用程式原始碼，以下啟動選項與 Prepared API 需要手動修改。

## Swagger UI 與 ReDoc 啟動選項 {#boot}

::: warning 目前 net/http 文件 UI 限制
2026-11-06 驗證：核心 `83b1e03` 與 net/http `v0.1.0-preview.2` 組合將文件與資源的 Content-Type 覆寫為 `text/plain`，導致 Swagger UI 與 ReDoc 無法正常呈現。以下 UI 執行範例使用 Echo `v0.2.0-preview.3`。
:::

以下是獨立參考應用程式的 `main.go`。請先用上述 CLI 準備相依套件，再於獨立目錄執行。既有應用程式應在目前 composition 與 `BuildApplication` 加入 import 與 `HTTP.OpenAPI` 設定。

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
                Title:   "Preview API",
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

HTTP v3 由核心使用共通實作解析 JSON、XML、urlencoded form 與 multipart。路徑與查詢值不會合併至本文 DTO。需要的 DTO 在認證攔截器之後解析，每個繫結成功的 DTO 分別驗證。

`MaxBodyBytes: 0` 表示本文總上限 32 MiB，正值指定位元組上限，負值取消限制。`MultipartMemoryBytes: 0` 表示檔案記憶體預算 32 MiB，正值指定預算，負值導致準備失敗。multipart 預算不是整個請求的記憶體上限，超出預算的檔案寫入磁碟。

表單 DTO 與上傳檔案共用同一 multipart 結果。檔案在所有 `AfterCompletion` 結束前有效，之後刪除暫存檔案。請求結束後仍需使用的檔案應在完成鉤子結束前另行保存。Spine DTO 輸入不呼叫 Echo Binder、JSONSerializer 或 `UnmarshalParam` 擴充。請移轉至標準 JSON、XML 或 Text 解碼器，或於 native Echo 路由使用擴充。Echo 回應輸出擴充保持可用。

## 外部伺服器與自訂 HTTP 配接器移轉 {#prepared}

將 `PreparedApplication.Handler()` 改為回傳 `(http.Handler, error)` 的 `spine.NetHTTPHandler(prepared)`。`prepared.HTTPAdapter()` 回傳同一已準備配接器，HTTP 關閉時回傳 nil。不要重複呼叫配接器的執行與關閉。呼叫方負責外部伺服器關閉與 `prepared.Close(ctx)`。Close 阻止新請求進入，並清理 WebSocket 與包含 native 中介軟體後處理的請求。等待 context 逾時後清理仍會繼續。

自訂 HTTP 平台必須移轉至 `spine.http-adapter/v3`，實作 `Serve(net.Listener, ...httpcontract.ServeOption) error` 並宣告 TLS capability。`adapter` 與 `adapter/http` 別名不會自動轉換 v2 實作。net/http 是獨立模組，不支援 `DisableRecover: true`。請參閱[完整 HTTP v3 移轉指南](https://github.com/NARUBROWN/spine/blob/preview/docs/migration/http-v3.md)。

## 本次合併的其他變更 {#merged}

上述其他變更以[核心 PR #34](https://github.com/NARUBROWN/spine/pull/34)合併原始碼為準。該原始碼的下一候選版本為 `v0.7.0-preview.5`，候選編號不代表標籤已發佈或完整發佈流程已完成。

- 路徑值：`/users/:id` 與 `/users/:userID/posts` 使用各自路由的鍵繫結。`/files/:name` 中的 `a%2Fb` 只解碼一次為 `a/b`，`a%252Fb` 為 `a%2Fb`。實際路徑 `/files/a/b` 不符合該路由。
- 關閉：WebSocket 清理發生 panic 後仍繼續清理後續應用程式資源，且不會將實際 HTTP Serve 錯誤隱藏為正常關閉。
- 事件：向 `spine.WithEventPublisherErrorHistory` 與 `spine.WithEventConsumerErrorHistory` 傳入 `boot.CleanupErrorHistoryOptions{MaxEntries, MaxAge}`，分別設定各角色的清理失敗歷程。預設保留最近 32 筆、最長 1 小時，先達到的限制生效。0 使用預設值，負值導致預檢失敗。不改變日誌保留政策與已回傳的關閉結果。CLI 對新 helper 的靜態分析支援仍是後續工作。
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
- [v0.7.0](/zh-Hant/learn/migration/v0.7.0-preview)
- [Preview → RC → Production](/zh-Hant/community/release-channels)
- [Spine #26: OpenAPI UI](https://github.com/NARUBROWN/spine/pull/26)
- [Spine #32: HTTP v3 / TLS](https://github.com/NARUBROWN/spine/pull/32)
- [Spine #33: Preview](https://github.com/NARUBROWN/spine/pull/33)
- [Spine #34: Preview](https://github.com/NARUBROWN/spine/pull/34)
- [Spine CLI #39: HTTP v3 / net/http](https://github.com/NARUBROWN/spine-cli/pull/39)
