# Preview 控制器與路由遷移

本文適用於 Spine `v0.7.0-preview.7` 和 CLI `v0.4.3-preview.8`，不適用於穩定版 `v0.6.5`。核心需要 Go 1.25.5 或更新版本，playground 驗證器需要 Go 1.26 或更新版本。完整平台組合的晉級狀態需要另行確認。

## 在控制器中註冊路由 {#routes}

Preview 中，`app.Route` 以及使用建構函式、獨立 route.go 和方法表達式的 HTTP 控制器方式已標記為 Deprecated。遷移期間仍可使用，移除版本尚未決定。一般 DI 建構函式並未棄用。

這是註冊範例，並非獨立應用程式。請在應用程式中加入 HTTP 平台和執行設定。

```go
import (
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type UserPath struct { ID int64 `path:"id"` }
type User struct { ID int64 `json:"id"` }

func (*UserController) Constructor() *UserController { return &UserController{} }

func (c *UserController) RegisterRoutes(r *api.Registry) {
    users := r.Group("/users", api.Tags("Users"))
    users.GET("/:id", api.Options(api.Summary("Get user")),
        func(p input.Path[UserPath]) httpx.Response[User] {
            return httpx.Response[User]{Body: User{ID: p.ID}}
        })
}

func register(app interface{ Constructor(...any) }) {
    app.Constructor(constructor.Controller(&UserController{}))
}
```

可以保留現有方法的邏輯並從回呼中呼叫。新舊路由可以共存，但相同方法和路徑重複註冊會在準備階段遭拒。遷移後請移除對應的舊註冊。支援 `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`。

## 建構與角色 {#constructors}

`app.Constructor` 接受 `constructor.Custom`, `Repository`, `Service`, `Controller`, `Interceptor` 角色註冊以及現有建構函式。物件註冊需要結構體指標和非可變參數的 `Constructor(依賴...) *自身型別` 方法。註冊值的欄位不會複製，建構結果依應用程式快取。`Custom` 也接受現有的單一回傳值建構函式。

Controller 還須實作包含 `RegisterRoutes(*api.Registry)` 的 `api.Controller`，Interceptor 須實作 `core.Interceptor`。註冊 Interceptor 只提供 DI，仍須另外設定全域或路由套用。啟動前檢查建構契約與依賴圖，實際建構時偵測 nil 回傳值與 panic。

## 輸入與群組 {#groups}

`input.Path[T]`, `input.Query[T]`, `input.Body[T]` 的 `T` 必須是結構體。路徑和查詢優先使用對應標籤，沒有標籤時使用 lowerCamel。標頭使用帶 `header` 標籤的獨立結構體指標。請依來源分離輸入。

群組方法的參數依序為路徑、`api.Options(...)` 和處理器。沒有選項時也要傳入 `api.Options()`。這與群組外的 `r.GET(path, handler, options...)` 順序不同。群組繼承前綴和標籤，並可透過 `api.Interceptors(...)` 加入攔截器。`example` 和 `description` 標籤僅供文件使用，並非執行時預設值或驗證規則。

## 棄用輸入與相容性 {#deprecated}

`path.Int`, `path.String`, `path.Boolean`, `query.Values`, `header.Values`、Values 的建構與查詢 API 和 `query.Pagination` 均為 Deprecated。在同一處理器中與新的 Path、Query、Header DTO 混用會在準備時遭拒。現有請求本文 DTO 和 context 仍受支援。相容路徑 `adapter`, `adapter/http`, `adapter/event`, `adapter/websocket` 也已棄用，請依用途使用 `contract/http`, `contract/event`, `contract/validator`, `contract/websocket`。HTTP v2 實作不會自動轉換為 v3。

## 描述與驗證 {#verification}

含新控制器的應用程式在準備前呼叫 `spine.DescribeHTTP` 會回傳 `spine.ErrRoutesNotCollected`。呼叫端執行 `app.Prepare` 後使用 `spine.DescribePreparedHTTP` 查詢，並關閉準備結果。準備過程可能初始化已設定的資料庫或訊息代理。CLI 靜態分析不執行使用者程式碼，可能無法解析動態路徑或攔截器清單。`--source runtime` 也不會自動執行 Prepare。

靜態 OpenAPI 不執行驗證器，無法確定驗證限制。請在準備好的應用程式中查看反映所選驗證器的描述。不支援的範例或規則可能產生診斷，電子郵件、URI、UUID 和正規表示式的等價性無法保證。整數邊界在規格中精確保留。

遷移後執行 `spine contract check` 和 `spine verify`，並檢查實際 HTTP 請求與描述。輸入遷移和 HTTP v3 的其他限制請參閱以下文件。

- [v0.7.0](/zh-Hant/learn/migration/v0.7.0-preview)
- [HTTP v3](/zh-Hant/learn/migration/preview-features#body)
