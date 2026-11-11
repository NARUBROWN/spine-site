# 執行階段 OpenAPI

::: info 0.7.5 API
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

Spine `v0.7.5` 根據已註冊的 HTTP 路由、處理器型別與 validator 描述契約產生 OpenAPI 3.1.2 JSON，也可選擇提供內建 Swagger UI 和 ReDoc。

## 啟用與啟動選項 {#options}

自動產生與 HTTP 提供預設關閉。在既有應用程式的 `boot.Options` 中依下列方式明確啟用。`boot` 的 import 路徑為 `github.com/NARUBROWN/spine/pkg/boot`。

```go
options := boot.Options{
	Address: ":8080",
	HTTP: &boot.HTTPOptions{
		GlobalPrefix: "/api",
		OpenAPI: boot.OpenAPIOptions{
			Enabled: true,
			Path:    "/openapi.json",
			Title:   "User API",
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
| `UI` | `nil` | `[]boot.OpenAPIUI`。省略時僅提供 JSON 規格 |

`HTTP: nil` 會同時關閉 HTTP 與規格資源。僅設定 `Path`、`Title` 或 `Version` 不會啟用此功能。要關閉它，請設定 `Enabled: false` 或省略 OpenAPI 選項。

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

新 `api.Controller` 的路由在準備期間收集，因此上方的 `DescribeHTTP` 回傳 `spine.ErrRoutesNotCollected`。以下函式接收呼叫端以 `Prepare` 準備的應用程式，呼叫端也負責關閉它。準備期間可能執行建構函式和初始化程式碼。

```go
func ExportPreparedOpenAPI(prepared spine.PreparedApplication, options boot.OpenAPIOptions, output io.Writer) error {
	description, err := spine.DescribePreparedHTTP(prepared)
	if err != nil {
		return err
	}
	document, err := openapi.Generate(description, options)
	if err != nil {
		return err
	}
	_, err = output.Write(document)
	return err
}
```

## validator 與描述範圍 {#validation}

在 BuildApplication 透過 WithValidator 註冊 playground.New()。必填標籤會在請求中自動檢查，並在規格中表示為 required。OpenAPI 本身不驗證請求，任意 DTO Validate 方法也不會自動執行或產生文件。

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

## 提供 Swagger UI 與 ReDoc {#tools}

透過 `boot.Options.HTTP.OpenAPI.UI` 選擇畫面。設定 `Enabled: true` 並註冊 UI，僅提供 JSON 時省略 `UI`。以下範例固定正式版 Echo，請保存 `go.mod` 和 `go.sum` 以便重現。

```bash
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1 github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
```

以下是註冊所選 UI 的獨立應用程式 `main.go`。在既有應用程式中，將 import 與 `OpenAPI.UI` 設定新增至目前的 composition。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
	"github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
	"github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}
type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/hello", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: "hello"}
	})
	r.POST("/users", func(ctx spinectx.Ctx, body input.Body[CreateUser]) httpx.Response[CreateUser] {
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: 201}}
	}, api.Summary("Create user"), api.Tags("Users"))
}
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{
		OpenAPI: boot.OpenAPIOptions{
			Enabled: true, Title: "Example API", Version: "1.0.0",
			UI: []boot.OpenAPIUI{swaggerui.New(swaggerui.Options{}), redoc.New(redoc.Options{})},
		},
	}}
	return app, options, nil
}
func main() {
	app, options, err := BuildApplication()
	if err != nil {
		log.Fatal(err)
	}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

執行應用程式後會提供 `/openapi.json`、`/docs` 與 `/redoc`。只使用 Swagger UI 時，省略 ReDoc 的 import 與註冊。`go:embed` 將所選 UI 的 JS、CSS 與授權聲明包含在二進位檔中，因此提供預設 UI 資源不需要 CDN、npm 或獨立的靜態檔案目錄。

### 各 UI 的選項 {#ui-options}

| 選項 | Swagger UI 預設值 | ReDoc 預設值 | 意義 |
| --- | --- | --- | --- |
| `Path` | `/docs` | `/redoc` | 文件介面的靜態絕對路徑 |
| `Title` | `API documentation` | `API reference` | 瀏覽器分頁標題。規格的 `info.title` 透過 `OpenAPIOptions.Title` 設定 |

規格網址透過共用的 `OpenAPIOptions.Path` 設定。文件與資源路徑獨立於 `HTTP.GlobalPrefix`。資源與再散布聲明在各 UI 路徑下的 `/_assets/` 中提供。相對 URL 也支援先移除外部前綴再轉送請求的代理。

文件與資源支援 GET 與 HEAD，不執行 Spine 業務攔截器。HTTP 伺服器中介軟體仍然生效。需要限制存取時，請使用相同的代理存取原則保護 JSON 規格、UI 與資源路徑。透過 Swagger 執行的 API 請求仍使用原 API 的攔截器。

### UI 提供者契約與準備 {#ui-provider}

兩個套件的 `New` 都會傳回以下 `boot.OpenAPIUI` 型別。資源本文為字串。

```go
type OpenAPIResource struct {
	Path        string
	ContentType string
	Body        string
}

type OpenAPIUI func(documentPath string) ([]OpenAPIResource, error)
```

`Prepare` 與 `Run` 在預先檢查中各呼叫一次 UI 提供者，並將驗證過的資源直接連接至 HTTP 介接器。單獨呼叫 `Validate` 也會執行提供者，後續準備時會重新檢查。自訂提供者必須傳回靜態資源，不得建立外部連線或執行使用者處理器。

文件或資源路徑與既有 GET、HEAD、WebSocket 路由重疊時，準備程序以 `OPENAPI_PATH_CONFLICT` 失敗。nil 提供者或無效 UI 選項產生 `OPENAPI_UI_INVALID`；無效資源路徑或 Content-Type 產生 `OPENAPI_UI_RESOURCE_INVALID`。

完整執行範例請參閱 [Swagger 與 OpenAPI 教學](/zh-Hant/learn/tutorial/8-swagger)，輸入模型請參閱[輸入移轉](/zh-Hant/learn/migration/v0.7.5)，應用程式 API 請參閱 [spine.App](/zh-Hant/reference/api/spine-app)。
