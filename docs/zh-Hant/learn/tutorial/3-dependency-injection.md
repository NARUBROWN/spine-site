# 依賴注入

::: info 0.7.5 API
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

透過建構函式參數型別連接儲存庫、服務與控制器。此獨立應用無需資料庫，GET /greeting 回傳 hello。

## 建構契約

各型別實作 Constructor(依賴...) *Self。透過 constructor 套件註冊 Repository、Service、Controller、Interceptor 角色。Controller 還實作 RegisterRoutes，Interceptor 還實作四個掛鉤。Custom 用於外部工廠或一般物件。

&Service{} 是型別標記。欄位不會被複製，Constructor 在新 receiver 上呼叫。產生的實例在應用內共享。

## 執行範例

[控制器依賴](/zh-Hant/learn/tutorial/2-controller)

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type Repository struct{}

func (*Repository) Constructor() *Repository { return &Repository{} }
func (*Repository) Greeting() string         { return "hello" }

type Service struct{ repository *Repository }

func (*Service) Constructor(repository *Repository) *Service { return &Service{repository: repository} }

type Controller struct{ service *Service }

func (*Controller) Constructor(service *Service) *Controller { return &Controller{service: service} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/greeting", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Service(&Service{}), constructor.Repository(&Repository{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
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

## 依賴解析

```sh
go run .
#
curl http://localhost:8080/greeting
```

無論註冊順序如何，都按依賴順序建立並回傳 hello。圖檢查拒絕重複型別、缺少依賴、介面歧義與循環。建構函式於準備階段執行時檢查 nil 回傳與 panic。

## 外部工廠

```go
app.Constructor(constructor.Custom(database.NewDB))
```

例如 database.NewDB 的簽章為 func NewDB() *bun.DB。物件與函式建構器只支援一個回傳值。拒絕 (T, error) 與可變參數，允許一般 []T 參數。介面優先符合回傳型別完全一致的提供者，否則必須只有一個可指派的提供者。

## 驗證與生命週期

BuildApplication 僅組裝應用。app.Validate 不執行建構函式；Prepare 執行建構函式並收集 RegisterRoutes。Run 準備並啟動應用。不會自動呼叫 DI 物件的任意 Close，資料庫資源由擁有者管理。請求交易透過 ExecutionContext().Set/Get 與明確的服務參數傳遞，不可覆寫共享物件欄位。

## 下一步

[攔截器](/zh-Hant/learn/tutorial/4-interceptor) / [資料庫](/zh-Hant/learn/tutorial/5-database) / [交易](/zh-Hant/learn/tutorial/6-transaction)
