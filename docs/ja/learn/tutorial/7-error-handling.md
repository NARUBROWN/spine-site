# エラー処理と入力検証

::: info 0.7.5 API
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

タグの自動検証と独自規則を区別します。この独立アプリはデータを保存しません。

## 検証器の組み立て

[コントローラーの依存](/ja/learn/tutorial/2-controller)

```sh
go get github.com/NARUBROWN/spine-validator-playground@v0.2.0-preview.6
```

engine は playground.New() の戻り値を持つ変数です。BuildApplication で一度作成し、spine.WithValidator(engine) に渡します。playground は実行時検証と OpenAPI SchemaDescriber を実装します。公開検証器契約を実装した別のエンジンも利用できます。

## 実行例

main.go を置き換えます。BuildApplication で検証器を登録し OpenAPI を有効にします。

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
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
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
	r.POST("/users", func(ctx spinectx.Ctx, body input.Body[CreateUser]) (httpx.Response[CreateUser], error) {
		if err := (*CreateUser)(body).Validate(); err != nil {
			return httpx.Response[CreateUser]{}, httperr.BadRequest(err.Error())
		}
		return httpx.Response[CreateUser]{Body: *body, Options: httpx.ResponseOptions{Status: http.StatusCreated}}, nil
	})
	r.GET("/users/:id", func(ctx spinectx.Ctx, id input.Path[int64]) (httpx.Response[map[string]any], error) {
		if *id <= 0 {
			return httpx.Response[map[string]any]{}, httperr.BadRequest("invalid user ID")
		}
		if *id != 1 {
			return httpx.Response[map[string]any]{}, httperr.NotFound("user not found")
		}
		return httpx.Response[map[string]any]{Body: map[string]any{"id": *id, "name": "Alice"}}, nil
	})
}
func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}

	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&Controller{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{OpenAPI: boot.OpenAPIOptions{Enabled: true}}, EnableGracefulShutdown: true}, nil
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

## 三つの検証の違い {#validation-modes}

登録したエンジンはバインド後、ハンドラー前に validate タグを検査します。request.Validate() は自作の通常メソッドの明示的な呼び出しです。app.Validate(options) は実行前に可能な構成と DI の検査です。検証器なしではタグだけで検証されません。

タグで十分なら DTO Validate と手動呼び出しを両方省略します。この例では予約名の規則のためだけに追加しています。自動実行も OpenAPI の推論もされません。ラッパーの DTO メソッドは (*body).Validate() または (*CreateUser)(body).Validate() で呼びます。[DTO 定義](/ja/learn/tutorial/2-controller#dto-validation)を参照してください。

## リクエストと仕様

```sh
go run .
#
curl -i http://localhost:8080/users/1
curl -i http://localhost:8080/users/0
curl -i http://localhost:8080/users/2
curl -i -H 'Content-Type: application/json' -d '{"name":"","email":"bad"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"admin","email":"a@example.com"}' http://localhost:8080/users
curl -i -H 'Content-Type: application/json' -d '{"name":"Alice","email":"a@example.com"}' http://localhost:8080/users
curl http://localhost:8080/openapi.json
```

順に 200、400、404、400、400、201 です。POST の失敗はタグと手動規則です。OpenAPI は name と email を必須にしますが、仕様自体は検証を実行しません。検証器が必須を説明した場合、json:",string" などの表現制限があっても Required は維持されます。CLI の静的 export はエンジンを実行しないため、検証器由来の仕様は準備済みアプリで確認します。

## エラー応答

バインドとタグ違反はハンドラー前に 400 です。HTTPError は 400〜599 のみで、200/302 など不正な値は通常の 500 になります。通常エラーは内部詳細を隠します。httperr には公開可能なメッセージだけを入れます。BeforeResponse のエラーは応答でハンドラーより優先します。

## 次のステップ

[インターセプター](/ja/learn/tutorial/4-interceptor) / [OpenAPI](/ja/reference/api/openapi)
