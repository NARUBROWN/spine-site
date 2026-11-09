# 查詢輸入

在 Spine `v0.7.1` 中，使用依來源劃分的結構體接收查詢參數。`input.Query[T]` 的 `T` 是結構體，處理器可直接讀取欄位。`query` 標籤指定外部名稱，沒有標籤的欄位使用 lowerCamel 名稱。

## 執行範例

在獨立 Go 模組中安裝 Spine `v0.7.1` 和相容的 Echo 平台，將以下程式碼儲存為 `main.go` 並執行 `go run .`。此範例只在缺少頁碼時使用 1。

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
	"github.com/NARUBROWN/spine/pkg/input"
)

type SearchQuery struct {
	Name string   `query:"name"`
	Page *int     `query:"page"`
	Tags []string `query:"tag"`
}
type SearchResult struct {
	Name string   `json:"name"`
	Page int      `json:"page"`
	Tags []string `json:"tags"`
}
type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/search", func(q input.Query[SearchQuery]) httpx.Response[SearchResult] {
		page := 1
		if q.Page != nil {
			page = *q.Page
		}
		return httpx.Response[SearchResult]{Body: SearchResult{Name: q.Name, Page: page, Tags: q.Tags}}
	})
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}))
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

在另一個終端機執行。第一個回應的名稱為 `alice`，頁碼為 2，標籤為 `go` 和 `web`。第二個回應的頁碼為 1。

```bash
curl 'http://localhost:8080/search?name=alice&page=2&tag=go&tag=web'
curl 'http://localhost:8080/search?tag=go,web'
curl -i 'http://localhost:8080/search?page=invalid'
curl -i 'http://localhost:8080/search?page=1&page=2'
```

## 缺失值與錯誤

指標欄位可透過 `nil` 區分缺失值。無效數字或單值欄位的重複鍵回傳 HTTP 400，不會替換為預設值。頁碼範圍和最大大小需要由應用程式或已註冊的 validator 另行檢查。

## 清單與驗證

切片支援重複鍵。提供原始查詢的 HTTP 平台也會拆分未跳脫的逗號分隔值。未提供原始查詢的平台不會推測已解碼的逗號是分隔符號。只有註冊 validator 後才會執行 `validate` 標籤。

## 從舊 API 移轉

`query.Values` 和 `query.Pagination` 保留但已棄用。舊 `Int` 對缺失值和轉換失敗都回傳預設值；新 DTO 會拒絕轉換失敗。請勿在同一處理器中混用舊輸入與新的 Path、Query、Header 輸入。

相容規則請參閱[輸入移轉](/zh-Hant/learn/migration/v0.7.1-preview)，維護舊程式碼請參閱 [query.Values 參考](/zh-Hant/reference/api/query-values)。[控制器範例](/zh-Hant/learn/tutorial/2-controller)也介紹標頭與路徑輸入。
