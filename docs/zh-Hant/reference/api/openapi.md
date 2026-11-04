# 執行階段 OpenAPI

從 Spine `v0.7.0-preview.1` 起，可以根據實際註冊的 HTTP 路由、處理器型別與 validator 描述契約產生 OpenAPI 3.1.2 JSON。

::: warning 從 v0.7.0-preview.1 起提供的 Preview API
此 API 不包含在穩定版 `v0.6.5` 中。HTTP 請使用 Echo `v0.2.0-preview.1`；如果使用 playground 進行驗證與詳細輸入規格描述，也請選擇 `v0.2.0-preview.1`。輸入參數請先參閱 [Preview 處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)。
:::

## 啟用與啟動選項 {#options}

自動產生與 HTTP 提供預設關閉。在既有應用程式的 `boot.Options` 中依下列方式明確啟用。`boot` 的 import 路徑為 `github.com/NARUBROWN/spine/pkg/boot`。

```go
options := boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{
        GlobalPrefix: "/api",
        OpenAPI: boot.OpenAPIOptions{
            Enabled: true,
            Path: "/openapi.json",
            Title: "User API",
            Version: "1.0.0",
        },
    },
}
```

| 欄位 | 預設值 | 行為 |
| --- | --- | --- |
| `Enabled` | `false` | 為 `true` 時，在準備階段自動產生並透過 HTTP 提供 |
| `Path` | `/openapi.json` | 透過 GET 與 HEAD 提供的靜態絕對路徑 |
| `Title` | `Spine API` | OpenAPI `info.title` |
| `Version` | `unversioned` | 應用程式的 `info.version`，與框架版本無關 |

`HTTP: nil` 會同時關閉 HTTP 與規格資源。僅設定 `Path`、`Title` 或 `Version` 不會啟用此功能。要關閉它，請設定 `Enabled: false` 或省略 OpenAPI 選項。請使用已公開 Preview 中的 `Enabled`，而非未發布開發原始碼中使用的 `Disabled`。

規格路徑獨立於 `GlobalPrefix`。上述選項會為業務 API 套用 `/api`，但規格仍透過 `/openapi.json` 提供。完成準備的應用程式會重複使用規格快照，不會自動儲存檔案。

## 規格查詢與衝突 {#http}

啟用後的資源可以公開查詢，並經過 HTTP 伺服器中介軟體。文件查詢不會執行業務控制器、DTO 繫結、validator 驗證或 Spine 業務攔截器。

如果應用程式的 GET、HEAD 或 WebSocket 路由符合規格路徑，啟動時會出現 `OPENAPI_PATH_CONFLICT`。`/:id` 等動態路徑也可能衝突。請將 `Path` 改為不重疊的靜態路徑，或關閉規格。未啟用時不會保留此路徑。直接向平台註冊的 native 路由不在核心的衝突檢查範圍內。

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/openapi.json
```

## 不執行應用程式即可描述或匯出 {#export}

以下函式接收已設定的應用程式、HTTP 選項與輸出目標，不會替換既有的 `spine.App` 介面。

```go
func ExportOpenAPI(app spine.App, options boot.Options, output io.Writer) error {
    if options.HTTP == nil {
        return errors.New("HTTP options are required")
    }
    description, err := spine.DescribeHTTP(app, options)
    if err != nil {
        return err
    }
    document, err := openapi.Generate(description, options.HTTP.OpenAPI)
    if err != nil {
        return err
    }
    _, err = output.Write(document)
    return err
}
```

此函式需要匯入標準函式庫 `errors`、`io`，以及 `github.com/NARUBROWN/spine`、`github.com/NARUBROWN/spine/pkg/boot` 與 `github.com/NARUBROWN/spine/pkg/openapi`。`DescribeHTTP` 不會執行建構函式、factory、處理器或驗證規則，但可能呼叫已註冊 `SchemaDescriber` 的描述方法。如果需要輸出檔案，由呼叫端提供 `io.Writer`。

即使關閉自動 HTTP 提供，也可以明確使用 `DescribeHTTP` 與 `openapi.Generate`。不支援描述功能的自訂 App 會回傳 `ErrHTTPDescriptionUnavailable`。

## validator 與描述範圍 {#validation}

| 註冊狀態 | 產生的資訊 |
| --- | --- |
| 未註冊 validator | 以路徑與 HTTP 方法為主的資訊，以及 `VALIDATOR_NOT_CONFIGURED` 診斷 |
| 已註冊 validator，但不支援 `SchemaDescriber` | 保留請求驗證，省略 DTO 詳細輸入，並在描述 DTO 時提供 `INPUT_SCHEMA_DESCRIPTION_UNAVAILABLE` 診斷 |
| 已註冊支援描述契約的 validator | 依來源劃分的 DTO 與可描述的驗證限制 |

未設定 validator 時，不會推斷輸入參數、請求與回應模型或錯誤狀態碼。仍會保留 OpenAPI 格式所需的最小回應佔位，以及未指定型別的路徑變數佔位。

即使 validator 不支援 `SchemaDescriber`，仍可描述原有 path 包裝型別，以及 `query.Pagination` 的 page、size 和預設值。DTO 詳細輸入描述才需要 `SchemaDescriber`。

輸入是否必填遵循 validator 契約。不會僅根據指標或 `json:",omitempty"` 決定 required。路徑區段一律必填，路徑指標也不代表 optional 或 nullable 輸入。

對於不支援的自訂規則與動態值，會透過 `x-spine-diagnostics` 記錄限制。不會猜測原有 `query.Values` 與 `header.Values` 在函式內部讀取哪些鍵。`query.Pagination` 會描述已宣告的 page 與 size，但與其他原有輸入一樣，仍標記為 Deprecated。

`httpx.Response[T]` 中的 T 描述回應本文型別。無法在不執行處理器的情況下確定其選擇的狀態碼與錯誤分支，因此將其記錄在 `default` 下。如果已註冊 validator，且規格包含請求本文或輸入參數，還會新增表示框架繫結與 DTO 驗證失敗的 `400` 回應。處理器內部設定的預設值也不會補入自動產生的規格。

## 整合 Swagger UI 與 ReDoc {#tools}

可以將產生的 JSON 連接至 Swagger UI 或 ReDoc。UI 需要在應用程式中另外設定。穩定版的 UI 設定範例請參閱 [Swagger 與 OpenAPI 教學](/zh-Hant/learn/tutorial/8-swagger)。

移轉輸入模型時，請遵循 [Preview 處理器輸入移轉](/zh-Hant/learn/migration/v0.7.0-preview)。穩定版 API 請參閱 [spine.App](/zh-Hant/reference/api/spine-app)。
