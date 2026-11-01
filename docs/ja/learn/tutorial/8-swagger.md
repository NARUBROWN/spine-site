# Swagger と OpenAPI のドキュメント

[最初のアプリ](/ja/learn/getting-started/first-app)で CLI が生成したプロジェクトを使います。`src/user` は[コントローラー](/ja/learn/tutorial/2-controller)の `spine generate resource user` で生成します。CLI の静的 OpenAPI 出力と Swaggo・Swagger UI の統合は別の機能です。

## CLI で OpenAPI を出力

CLI は登録されたルートとハンドラーのシグネチャから OpenAPI 3.1 を生成します。Swaggo のアノテーションは不要です。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

出力には `/health`、`/user/{id}` と `x-spine-*` の分析根拠が含まれます。Spine の `/user/:id` は OpenAPI では `/user/{id}` になります。実行時に決まるステータスなどは分析の限界として明示します。出力だけでは Swagger UI のインストールや HTTP エンドポイントの登録は行いません。既存ファイルを確認して置き換える場合だけ `--force` を使います。

## 任意: Swaggo と Swagger UI

以下は Swaggo で別の Swagger 2.0 文書を生成し、Echo transport に UI を手動登録する例です。CLI は自動設定しません。CLI の `openapi.json` と Swaggo の `docs/swagger.json` は別の生成物です。

### 1. ツールのインストール

```bash
go install github.com/swaggo/swag/cmd/swag@v1.16.6
go get github.com/swaggo/swag@v1.16.6 github.com/swaggo/http-swagger@v1.3.4
```

### 2. 一般アノテーションの追加

`internal/application/application.go` の `BuildApplication()` の直前に追加します。生成された main と `spine.toml` の `composition = "./internal/application"` は保ちます。

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

### 3. 実際の照会ハンドラーを文書化

生成された `src/user/user_controller.go` を次のように手動で拡張します。`UserIDResponse` は文書化のために追加する型で、JSON 応答は従来の `{"id":1}` と同じです。DB 照会や CRUD 全体は実装しません。

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

### 4. docs パッケージを先に生成

プロジェクトのルートで実行します。この段階より前に、まだ存在しない `example.com/hello-spine/docs` を import しないでください。`--parseInternal` で一般アノテーションのある internal パッケージを解析します。

```bash
swag init -g internal/application/application.go --parseInternal
```

`docs/docs.go`、`docs/swagger.json`、`docs/swagger.yaml` が生成されます。`docs.go` の init 関数が仕様を登録するため、生成後に blank import を追加します。生成ファイルを手動で編集しないでください。

### 5. UI の登録

`internal/application/application.go` の import に追加します。

```go
import (
    _ "example.com/hello-spine/docs"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"
)
```

同じファイルの `BuildApplication()` で、`app := spine.New()` より後、return より前に追加します。既存の health・user 登録を保ちます。

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

別のターミナルで `http://localhost:8080/swagger/index.html` と `/swagger/doc.json` を確認します。Try it out も実際の `/user/1` にリクエストします。`app.Transport` で直接追加した Echo ルートは CLI の静的 Spine ルート契約に含まれないため、UI のパスは別に確認してください。

## 手動 CRUD 拡張のアノテーション・DTO

以下は追加機能を実装するときの参考例です。`resource` はこれらの DTO や POST・PUT・DELETE ハンドラーを生成しません。`src/user` の同じ `package user` に置き、実際のルート・応答ステータスとアノテーションを一致させます。リクエスト DTO はポインタで受け取ります。`example`・`enums`・`minimum` などは文書のメタデータであり、入力検証を自動実行しません。

## コメントタグリファレンス

### デフォルトタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Summary` | まとめ（1行） | `ユーザー参照` |
| `@Description` | 詳細な説明 | `IDでユーザー情報を参照します` |
| `@Tags` | グループタグ | `users` |
| `@Router` | パスとメソッド | `/user [get]` |

### リクエストタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Accept` | 要求Content-Type | `json` |
| `@Produce` | 応答Content-Type | `json` |
| `@Param` | パラメータ定義 | `id query int true "User ID"` |

### 応答タグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Success` | 成功応答 | `200 {object} UserResponse` |
| `@Failure` | 失敗応答 | `404 {object} ErrorResponse` |


## @Param形式
```
@Param [名前] [位置] [型] [必須] "[説明]"
```

### 位置(in)

| 場所 | 説明 | 例 |
|------|------|------|
| `query` | クエリ文字列 | `/user?id=1` |
| `path` | URLパス | `/user/{id}` |
| `body` | リクエスト本文 | `JSON body` |
| `header` | ヘッダー | `Authorization` |
| `formData` | フォームデータ | ファイルアップロード |

### タイプ

| タイプ | 説明 |
|------|------|
| `int`、`integer` | 整数 |
| `string` | 文字列 |
| `bool`、`boolean` | ブール値 |
| `number` | 数値 |
| `object` | オブジェクト（DTO） |
| `array` | 配列 |

### 例


```go
// クエリパラメータ
// @Param id query int true "User ID"
// @Param name query string false "User name"
// @Param active query bool false "Active status"

// リクエストボディ
// @Param body body CreateUserRequest true "ユーザー 生成 リクエスト"

// ヘッダー
// @Param Authorization header string true "Bearerトークン"
```


## DTO文書化

### リクエストDTO


```go
// src/user/user_request.go
package user

// CreateUserRequest ユーザー 生成 リクエスト
type CreateUserRequest struct {
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// UpdateUserRequest ユーザー更新リクエスト
type UpdateUserRequest struct {
    Name  string `json:"name" example:"Alice Updated"`
    Email string `json:"email" example:"alice.new@example.com"`
}
```

### 応答DTO


```go
// src/user/user_response.go
package user

// UserResponse ユーザー レスポンス
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse エラー レスポンス
type ErrorResponse struct {
    Message string `json:"message" example:"ユーザーが見つかりません"`
}
```

### DTOタグ

| タグ | 説明 | 例 |
|------|------|------|
| `example` |例示値| `example:"Alice"` |
| `enums` |許容値リスト| `enums:"active,inactive"` |
| `minimum` |最小値| `minimum:"1"` |
| `maximum` |最大値| `maximum:"100"` |
| `default` |デフォルト| `default:"10"` |



## ドキュメントの再生成

アノテーションや DTO を変更したら Swaggo を再実行します。`spine dev` は Swaggo を自動実行しません。CLI の仕様は `contract export` で別に更新します。

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
