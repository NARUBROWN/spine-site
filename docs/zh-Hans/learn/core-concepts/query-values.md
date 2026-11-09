# 查询输入

在 Spine `v0.7.1` 中，使用按来源划分的结构体接收查询参数。`input.Query[T]` 的 `T` 是结构体，处理器可直接读取字段。`query` 标签指定外部名称，没有标签的字段使用 lowerCamel 名称。

## 运行示例

在独立 Go 模块中安装 Spine `v0.7.1` 和兼容的 Echo 平台，将以下代码保存为 `main.go` 并运行 `go run .`。此示例仅在缺少页码时使用 1。

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

在另一个终端运行。第一个响应的名称为 `alice`，页码为 2，标签为 `go` 和 `web`。第二个响应的页码为 1。

```bash
curl 'http://localhost:8080/search?name=alice&page=2&tag=go&tag=web'
curl 'http://localhost:8080/search?tag=go,web'
curl -i 'http://localhost:8080/search?page=invalid'
curl -i 'http://localhost:8080/search?page=1&page=2'
```

## 缺失值与错误

指针字段可通过 `nil` 区分缺失值。无效数字或单值字段的重复键返回 HTTP 400，不会被替换为默认值。页码范围和最大大小需要由应用或已注册的 validator 单独检查。

## 列表与验证

切片支持重复键。提供原始查询的 HTTP 平台也会拆分未转义的逗号分隔值。不提供原始查询的平台不会推测已解码的逗号是分隔符。只有注册 validator 后才会执行 `validate` 标签。

## 从旧 API 迁移

`query.Values` 和 `query.Pagination` 保留但已弃用。旧 `Int` 对缺失值和转换失败都会返回默认值；新 DTO 会拒绝转换失败。请勿在同一处理器中混用旧输入与新的 Path、Query、Header 输入。

兼容规则请参阅[输入迁移](/zh-Hans/learn/migration/v0.7.1-preview)，维护旧代码请参阅 [query.Values 参考](/zh-Hans/reference/api/query-values)。[控制器示例](/zh-Hans/learn/tutorial/2-controller)也介绍了请求头和路径输入。
