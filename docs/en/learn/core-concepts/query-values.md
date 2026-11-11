# Query inputs

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

In Spine `v0.7.5`, receive query parameters in a source-specific struct. In `input.Query[T]`, `T` is a struct and the handler reads its fields directly. A `query` tag sets the external name; an untagged field uses a lowerCamel name.

## Runnable example

Install Spine `v0.7.5` and a compatible Echo platform in a separate Go module. Save the following as `main.go` and run `go run .`. This example uses page 1 only when the value is absent.

```bash
go get github.com/NARUBROWN/spine@v0.7.5-preview.1 github.com/NARUBROWN/spine-echo-platform@v0.2.1-preview.1
```

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
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
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
	r.GET("/search", func(ctx spinectx.Ctx, q input.Query[SearchQuery]) httpx.Response[SearchResult] {
		page := 1
		if q.Page != nil {
			page = *q.Page
		}
		return httpx.Response[SearchResult]{Body: SearchResult{Name: q.Name, Page: page, Tags: q.Tags}}
	})
}
func BuildApplication() (spine.App, boot.Options, error) {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}, nil
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

Run these in another terminal. The first response contains name `alice`, page 2, and tags `go` and `web`. The second response uses page 1.

```bash
curl 'http://localhost:8080/search?name=alice&page=2&tag=go&tag=web'
curl 'http://localhost:8080/search?tag=go,web'
curl -i 'http://localhost:8080/search?page=invalid'
curl -i 'http://localhost:8080/search?page=1&page=2'
```

## Missing values and errors

A pointer field distinguishes an absent value with `nil`. An invalid number or repeated key for a scalar field returns HTTP 400 instead of a default. The application or a registered validator must check page bounds and maximum size separately.

## Lists and validation

Slices accept repeated keys. An HTTP platform that supplies the raw query also splits unescaped comma-separated values. A platform without the raw query does not guess that a decoded comma is a separator. A `validate` tag runs only when a validator is registered.

## Migrate from older APIs

`query.Values` and `query.Pagination` remain available but are deprecated. The old `Int` returns its default for both missing and invalid input; a new DTO rejects invalid input. Do not mix legacy inputs and new Path, Query, or Header inputs in one handler.

See [input migration](/en/learn/migration/v0.7.5) for compatibility rules and the [query.Values reference](/en/reference/api/query-values) when maintaining old code. The [controller example](/en/learn/tutorial/2-controller) also covers header and path inputs.
