# 쿼리 입력

::: info 0.7.5 API
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

Spine `v0.7.5`에서 쿼리는 출처별 구조체로 받습니다. `input.Query[T]`에서 `T`는 구조체이며, 핸들러는 필드에 직접 접근합니다. `query` 태그가 외부 이름을 정하고, 태그가 없는 필드는 lowerCamel 이름을 사용합니다.

## 실행 예제

독립된 Go 모듈에 Spine `v0.7.5`과 호환되는 Echo 플랫폼을 설치한 뒤 다음 코드를 `main.go`로 저장하고 `go run .`으로 실행하세요. 이 예제는 페이지가 누락된 경우에만 1을 사용합니다.

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

다른 터미널에서 실행합니다. 첫 요청의 응답은 `name`이 `alice`, `page`가 2이고 `tags`는 `go`와 `web`입니다. 두 번째 응답의 `page`는 1입니다.

```bash
curl 'http://localhost:8080/search?name=alice&page=2&tag=go&tag=web'
curl 'http://localhost:8080/search?tag=go,web'
curl -i 'http://localhost:8080/search?page=invalid'
curl -i 'http://localhost:8080/search?page=1&page=2'
```

## 누락과 오류

포인터 필드는 누락을 `nil`로 구분할 수 있습니다. 잘못된 숫자와 단일값 필드의 반복 키는 HTTP 400이며, 기본값으로 바뀌지 않습니다. 페이지 범위와 최대 크기는 앱이나 등록한 validator가 별도로 검사해야 합니다.

## 목록과 검증

슬라이스는 반복 키를 받습니다. 원시 쿼리를 제공하는 HTTP 플랫폼은 구분되지 않은 쉼표 목록도 나눕니다. 원시 쿼리를 제공하지 않는 플랫폼은 이미 디코딩된 쉼표를 구분자로 추측하지 않습니다. `validate` 태그는 validator를 등록했을 때만 실행됩니다.

## 기존 API에서 전환

`query.Values`와 `query.Pagination`은 Deprecated로 유지됩니다. 기존 `Int`는 누락과 변환 실패 모두 기본값을 반환하지만 새 DTO는 변환 실패를 거부합니다. 한 핸들러에 이전 입력과 새 Path, Query, Header 입력을 섞지 마세요.

[입력 전환 안내](/ko/learn/migration/v0.7.5)에서 호환 규칙을 확인하고, 기존 코드를 유지해야 한다면 [query.Values 참조](/ko/reference/api/query-values)를 확인하세요. [컨트롤러 예제](/ko/learn/tutorial/2-controller)에서 헤더와 경로 입력도 살펴볼 수 있습니다.
