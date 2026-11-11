# クエリ入力

Spine `v0.7.5` ではクエリを入力元別の構造体で受け取ります。`input.Query[T]` の `T` は構造体で、ハンドラーからフィールドに直接アクセスします。`query` タグで外部名を指定し、タグがない場合は lowerCamel 名を使います。

## 実行例

別の Go モジュールに Spine `v0.7.5` と互換性のある Echo プラットフォームをインストールし、次のコードを `main.go` に保存して `go run .` で実行します。この例では値がない場合に限りページ 1 を使います。

```bash
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
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

別のターミナルで実行します。最初の応答は名前が `alice`、ページが 2、タグが `go` と `web` です。二つ目のページは 1 です。

```bash
curl 'http://localhost:8080/search?name=alice&page=2&tag=go&tag=web'
curl 'http://localhost:8080/search?tag=go,web'
curl -i 'http://localhost:8080/search?page=invalid'
curl -i 'http://localhost:8080/search?page=1&page=2'
```

## 値の欠落とエラー

ポインターフィールドは欠落を `nil` で区別できます。不正な数値や単一値フィールドの重複キーは既定値に置き換えられず HTTP 400 になります。ページの範囲と最大サイズはアプリまたは登録した validator で別途検査します。

## リストと検証

スライスは繰り返しキーを受け取ります。生のクエリを提供する HTTP プラットフォームでは、エスケープされていないコンマ区切りも分割します。生のクエリがない場合、デコード済みコンマを区切り文字と推測しません。`validate` タグは validator の登録時のみ実行されます。

## 以前の API から移行する

`query.Values` と `query.Pagination` は非推奨ですが維持されています。以前の `Int` は欠落と変換失敗の両方に既定値を返しますが、新しい DTO は変換失敗を拒否します。一つのハンドラーで従来の入力と新しい Path、Query、Header 入力を混在させないでください。

互換性は[入力の移行](/ja/learn/migration/v0.7.5)、既存コードの保守には [query.Values リファレンス](/ja/reference/api/query-values)を参照してください。[コントローラーの例](/ja/learn/tutorial/2-controller)ではヘッダーとパス入力も説明します。
