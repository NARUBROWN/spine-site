# コントローラー

RegisterRoutes でルートを宣言し、入力元ごとのラッパーでリクエストを受け取ります。この独立アプリは値を返し、保存しません。

## 準備

Go 1.26 以降と空のディレクトリを用意します。アプリの組み立ては BuildApplication に置きます。CLI プロジェクトでは internal/application/application.go です。

```sh
go mod init example.com/spine-tutorial
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

## 入力元と名前

| 入力元 | ハンドラー引数 | 外部名 |
| --- | --- | --- |
| Path | `input.Path[UserPath]` or `input.Path[int64]` | `path:"id"` |
| Query | `input.Query[SearchQuery]` | `query:"name"` |
| Header | `input.Header[RequestHeaders]` | `header:"X-Request-ID"` |
| Body | `input.Body[CreateUser]` | `json` / `xml` / `form` |

Path、Query、Header はタグを省略すると lowerCamel 名を使います。ID は id、UserID は userId です。外部名を変更するときにタグを使います。Body はデコーダーの規則に従います。input.Param はなく、HTTP 入力の通常の *DTO は HTTP_INPUT_WRAPPER_REQUIRED で拒否されます。フィールドは path.ID、body.Name、スカラーは *id で読みます。

## DTO と任意の検証メソッド {#dto-validation}

BuildApplication で WithValidator(engine) を登録すると、validate タグはハンドラー前に自動検証されます。タグだけで十分なら Validate メソッドや重複検証は不要です。予約名などの追加規則は通常の Go メソッドで実装できます。次の断片には errors の import が必要です。

```go
type CreateUserRequest struct {
	Name string `json:"name" validate:"required,max=100"`
}

func (r *CreateUserRequest) Validate() error {
	if r.Name == "admin" {
		return errors.New("この名前は使用できません")
	}
	return nil
}
```

このメソッドは自動実行されません。必要なハンドラーで (*body).Validate() または (*CreateUserRequest)(body).Validate() を呼びます。ラッパーに body.Validate() は使いません。OpenAPI はメソッドのロジックを推論しません。[検証の完全な例](/ja/learn/tutorial/7-error-handling#validation-modes)を参照してください。

## 実行するアプリ

main.go に保存します。この基本例に独自 Validate メソッドはありません。

HTTP ハンドラーでリクエストコンテキストが必要な場合は、任意の位置に `spine.Ctx` パラメーターを宣言します。

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

type UserController struct{}
type UserPath struct {
	ID int64 `path:"id"`
}
type SearchQuery struct {
	Name string `query:"name"`
}
type RequestHeaders struct {
	RequestID string `header:"X-Request-ID"`
}
type CreateUser struct {
	Name string `json:"name"`
}
type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func (*UserController) Constructor() *UserController { return &UserController{} }
func (c *UserController) RegisterRoutes(r *api.Registry) {
	users := r.Group("/users", api.Tags("Users"))
	users.GET("/search", func(q input.Query[SearchQuery], h input.Header[RequestHeaders]) httpx.Response[map[string]string] {
		return httpx.Response[map[string]string]{Body: map[string]string{"name": q.Name, "request_id": h.RequestID}}
	})
	users.GET("/id/:id", func(path input.Path[UserPath]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{ID: path.ID}}
	}, api.Summary("Get user"))
	users.POST("/", func(body input.Body[CreateUser]) httpx.Response[User] {
		return httpx.Response[User]{Body: User{Name: body.Name}, Options: httpx.ResponseOptions{Status: 201}}
	})
}

func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&UserController{}))
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

グループ内の "/" は基本パスです。users.POST("/", ...) は POST /users を登録します。新規コードには RegisterRoutes を使います。app.Route は非推奨です。

## リクエスト確認

```sh
go run .
#
curl -H 'X-Request-ID: r1' 'http://localhost:8080/users/search?name=alice'
curl http://localhost:8080/users/id/12
curl -i -H 'Content-Type: application/json' -d '{"name":"bob"}' http://localhost:8080/users
curl -i http://localhost:8080/users/id/not-a-number
```

名前とリクエスト ID、ID 12、201 応答、不正な整数の 400 を順に確認します。

## 入力と戻り値の規則

スカラー Path の順序と数はパス変数と一致させます。Path DTO は名前で一部のキーだけを受け取れます。両方式は混在させません。入力元ごとに DTO を分け、重複キーを避けます。Body は一つだけで、JSON、XML、form、multipart に対応します。ファイルには form タグ付き *multipart.FileHeader または []*multipart.FileHeader フィールドを使います。

成功応答は httpx.Response[T]、Binary、Redirect のいずれか一つと任意の error です。複数応答は準備時に拒否されます。

## エラー応答 {#error-response}

バインド失敗はハンドラー前に 400、通常のエラーは詳細を隠した 500 です。[エラー処理](/ja/learn/tutorial/7-error-handling)で検証器を接続します。

## 次のステップ

[DI](/ja/learn/tutorial/3-dependency-injection) / [OpenAPI](/ja/reference/api/openapi)
