# エラー処理と入力検証

Spine v0.7.1 で DTO の自動検証と独自ルールを組み合わせ、入力エラーとリソース不在を HTTP 応答として返します。

## 実行例

Go 1.26 以上が必要です。別の Go モジュールで依存関係をインストールし、コードを `main.go` に保存して実行してください。ユーザーは保存されません。

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0 github.com/NARUBROWN/spine-validator-playground@v0.2.0
```

```go
package main

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httperr"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"github.com/NARUBROWN/spine/pkg/input"
)

type CreateUser struct {
	Name  string `json:"name" validate:"required,max=100"`
	Email string `json:"email" validate:"required,email"`
}

func (u *CreateUser) Validate() error {
	if strings.EqualFold(strings.TrimSpace(u.Name), "admin") {
		return errors.New("name is reserved")
	}
	return nil
}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.POST("/users", func(body input.Body[CreateUser]) (httpx.Response[CreateUser], error) {
		if err := (*CreateUser)(body).Validate(); err != nil {
			return httpx.Response[CreateUser]{}, httperr.BadRequest(err.Error())
		}
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})
	r.GET("/users/:id", func(id input.Path[int64]) (httpx.Response[map[string]any], error) {
		if *id <= 0 {
			return httpx.Response[map[string]any]{}, httperr.BadRequest("invalid user ID")
		}
		if *id != 1 {
			return httpx.Response[map[string]any]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": "Alice"}}, nil
	})
}
func main() {
	engine, err := playground.New()
	if err != nil {
		log.Fatal(err)
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	options := boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}
	if err := app.Validate(options); err != nil {
		log.Fatal(err)
	}
	if err := app.Run(options); err != nil {
		log.Fatal(err)
	}
}
```

## 検証の実行タイミング

`spine.WithValidator(engine)` を登録すると、本文のバインド後に `validate` タグを検査し、失敗時はハンドラーの前に 400 を返します。検証器がなければタグだけでは検証されません。

DTO の `Validate()` は自動では呼ばれません。例ではタグ検証後にハンドラーが直接呼び、予約名を検査します。複数フィールドやアプリ固有のルールにも拡張できます。`BadRequest` には公開可能なメッセージだけを渡します。

`app.Validate(options)` は起動前のアプリ構成を検査します。リクエスト DTO の検証やコンストラクター、外部サービスの実行ではありません。

## 応答の確認

順に 200、400、404、400、400、201 が返ります。最初の POST エラーはフィールド検証、次は独自ルールです。

```bash
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
```

## エラーの対応付け

`httperr.BadRequest`、`Unauthorized`、`NotFound` はそれぞれ 400、401、404 を返します。その他は `httperr.HTTPError` を使用します。通常のエラーは 500 になるため、内部エラーをそのまま公開しないでください。ドメインエラーは `errors.Is` で判定できます。

## 関連情報

- [httperr](/ja/learn/core-concepts/httperr)
- [インターセプター](/ja/learn/tutorial/4-interceptor)
