# SwaggerとOpenAPIドキュメント

CLIでOpenAPIファイルをエクスポートし、必要に応じてSwaggoのドキュメントとSwagger UIを追加して、ブラウザーからリクエストを送信します。CLIによる静的なOpenAPIのエクスポートと、Swaggoを使用するUIの構成は、それぞれ別に行います。

[最初のアプリ](/ja/learn/getting-started/first-app)で作成した `example.com/hello-spine` プロジェクトを使用します。先に[コントローラー](/ja/learn/tutorial/2-controller)の `spine generate resource user` で `src/user` を生成してください。別のモジュールパスを使用した場合は、以下のimportパスの `example.com/hello-spine` の部分だけをそのモジュールパスに置き換え、末尾の `/docs` は残してください。コマンドはプロジェクトルートで実行します。

## CLIによるOpenAPIのエクスポート

CLIは、登録されたルートとハンドラーのシグネチャからOpenAPI 3.1ドキュメントを生成します。Swaggoのコメントは必要ありません。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

生成された `openapi.json` で `/health` と `/user/{id}` を確認します。Spineの `/user/:id` はOpenAPIでは `/user/{id}` と表され、`x-spine-*` フィールドには分析の根拠と限界が記録されます。たとえば、実行時に選択されるレスポンスのステータスコードは、静的解析だけでは確定できません。

このコマンドはドキュメントファイルだけを生成します。Swagger UIが必要な場合は、次の手順に進んでください。既存のファイルを置き換える場合は、内容を確認してから `--force` を使用します。

## オプション: SwaggoとSwagger UI

SwaggoでSwagger 2.0ドキュメントを作成し、Echoのトランスポート層にUIのルートを追加します。ファイルと登録コードは手動で作成します。CLIの `openapi.json` とSwaggoの `docs/swagger.json` は別のドキュメントであるため、それぞれ更新する必要があります。

### 1. ツールのインストール

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. APIの基本情報を追加

`internal/application/application.go` の `BuildApplication()` の直前に、次のコメントを追加します。生成された `main.go` と、`spine.toml` の `composition = "./internal/application"` 設定は維持します。

```go
// @title Hello Spine API
// @version 1.0.0
// @description Spine HTTP API
// @host localhost:8080
// @BasePath /
func BuildApplication() (spine.App, boot.Options, error) {
    // ...
}
```

### 3. GETハンドラーのドキュメント化

生成された `src/user/user_controller.go` を次のコードに置き換えます。`UserIDResponse` は、レスポンスのスキーマをドキュメント化するために追加した型です。このハンドラーはパスのIDを返し、`/user/1` のレスポンスJSONは従来と同じ `{"id":1}` です。DBからユーザーを取得する処理は行いません。

```go
package user

import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct{ service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

type UserIDResponse struct {
    ID int64 `json:"id" example:"1"`
}

// Get godoc
// @Summary Get user ID
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} UserIDResponse
// @Router /user/{id} [get]
func (c *UserController) Get(id path.Int) httpx.Response[UserIDResponse] {
    return httpx.Response[UserIDResponse]{Body: UserIDResponse{ID: id.Value}}
}
```

### 4. 先にdocsパッケージを生成

次のコマンドでドキュメントのパッケージを生成します。生成前は、まだ存在しない `example.com/hello-spine/docs` をインポートしないでください。`--parseInternal` は、APIの基本情報があるinternalパッケージも読み取るように指定します。

```bash
swag init -g internal/application/application.go --parseInternal
```

`docs/docs.go`、`docs/swagger.json`、`docs/swagger.yaml` が生成されます。`docs.go` の `init` 関数がドキュメントを登録するため、次の手順ではこのパッケージを副作用を目的とするimportとして追加します。生成されたファイルは直接編集しません。

### 5. UIの接続

`internal/application/application.go` のimportブロックに追加します。

```go
import (
    _ "example.com/hello-spine/docs"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

同じファイルの `BuildApplication()` で、`app := spine.New()` より後、`return` より前に次のコードを追加します。既存のhealthとuserの登録は維持してください。

```go
app.Transport(func(transport any) {
    e := transport.(*echo.Echo)
    e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
})
```

### 6. 検証と実行

```bash
gofmt -w internal/application/application.go src/user/user_controller.go
go mod tidy
spine contract check
spine verify
spine dev
```

ブラウザーで `http://localhost:8080/swagger/index.html` を開き、GETルートが表示されることを確認します。`/swagger/doc.json` では、生成したSwagger 2.0ドキュメントが返されるはずです。UIのTry it outから `/user/1` にリクエストすると、HTTP 200と `{"id":1}` が返ります。

`app.Transport` で直接追加したEchoのルートは、CLIの静的なSpineルート契約に含まれません。契約検査を通過しても、UIとドキュメントのルートは別途確認する必要があります。

## 機能拡張に使用するコメントとDTO

以下のタグとDTOは、機能を追加する際の参考例です。`resource` ジェネレーターは、これらのリクエスト型とレスポンス型や、POST、PUT、DELETEハンドラーを生成しません。`src/user` の `package user` に必要な型を追加し、実際のルートとレスポンスのステータスコードに合わせてコメントを記述してください。

リクエストDTOはハンドラーでポインタとして受け取ります。`example`、`enums`、`minimum` などのタグは、ドキュメントに使用する情報です。入力検証を自動で実行するものではありません。

### 基本のコメントタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Summary` | 1行の要約 | `ユーザーの取得` |
| `@Description` | 詳細な説明 | `IDでユーザー情報を取得します` |
| `@Tags` | グループのタグ | `users` |
| `@Router` | パスとメソッド | `/user [get]` |

### リクエストタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Accept` | リクエストのContent-Type | `json` |
| `@Produce` | レスポンスのContent-Type | `json` |
| `@Param` | パラメーターの定義 | `id query int true "User ID"` |

### レスポンスタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Success` | 成功時のレスポンス | `200 {object} UserResponse` |
| `@Failure` | 失敗時のレスポンス | `404 {object} ErrorResponse` |


## リクエストパラメーターの指定

```
@Param [名前] [場所] [型] [必須かどうか] "[説明]"
```

### パラメーターの場所

| 場所 | 説明 | 例 |
|------|------|------|
| `query` | クエリ文字列 | `/user?id=1` |
| `path` | URLのパス | `/user/{id}` |
| `body` | リクエストボディ | JSONオブジェクト |
| `header` | ヘッダー | `Authorization` |
| `formData` | フォームデータ | ファイルのアップロード |

### 型

| 型 | 説明 |
|------|------|
| `int`, `integer` | 整数 |
| `string` | 文字列 |
| `bool`, `boolean` | 真偽値 |
| `number` | 実数 |
| `object` | オブジェクト (DTO) |
| `array` | 配列 |

### 例

```go
// 쿼리 파라미터
// @Param id query int true "User ID"
// @Param name query string false "User name"
// @Param active query bool false "Active status"

// 요청 본문
// @Param body body CreateUserRequest true "유저 생성 요청"

// 헤더
// @Param Authorization header string true "Bearer 토큰"
```


## DTOのドキュメント化

### リクエストDTO

```go
// src/user/user_request.go
package user

// CreateUserRequest 유저 생성 요청
type CreateUserRequest struct {
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// UpdateUserRequest 유저 수정 요청
type UpdateUserRequest struct {
    Name  string `json:"name" example:"Alice Updated"`
    Email string `json:"email" example:"alice.new@example.com"`
}
```

### レスポンスDTO

```go
// src/user/user_response.go
package user

// UserResponse 유저 응답
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse 에러 응답
type ErrorResponse struct {
    Message string `json:"message" example:"유저를 찾을 수 없습니다."`
}
```

### DTOタグ

| タグ | 説明 | 例 |
|------|------|------|
| `example` | 値の例 | `example:"Alice"` |
| `enums` | 許可する値の一覧 | `enums:"active,inactive"` |
| `minimum` | 最小値 | `minimum:"1"` |
| `maximum` | 最大値 | `maximum:"100"` |
| `default` | デフォルト値 | `default:"10"` |



## ドキュメントの再生成

コメントやDTOを変更した場合は、Swaggoのドキュメントを再生成する必要があります。`spine dev` はSwaggoを自動で実行しません。次のMakefileを追加すると、`make run` でドキュメントを更新してからアプリを実行できます。CLIのOpenAPIファイルは、`spine contract export` で別途更新します。

```makefile
.PHONY: swagger run

swagger:
	swag init -g internal/application/application.go --parseInternal

run: swagger
	spine dev
```

## 次のステップ

- [Spine API](/ja/reference/api/spine-app)
- [Swaggo v1.16.6](https://github.com/swaggo/swag/tree/v1.16.6)
- [http-swagger v1.3.4](https://pkg.go.dev/github.com/swaggo/http-swagger@v1.3.4)
