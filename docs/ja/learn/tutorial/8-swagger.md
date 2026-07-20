＃スウェーガーの文書化

APIドキュメントを生成する。


## 概要

Spineは[Swaggo]（https://github.com/swaggo/swag）を使用してSwagger文書を自動的に生成します。

- コードコメントからAPI仕様を抽出する
- Swagger UIで文書を提供する
- APIテスト可能


## インストール


```bash
# Swag CLIをインストール
go install github.com/swaggo/swag/cmd/swag@latest

# 必要なパッケージをインストール
go get github.com/swaggo/swag
go get github.com/swaggo/http-swagger
```


## プロジェクト設定

### main.go コメントを追加


```go
// main.go
package main

import (
    "log"
    "time"

    "myapp/controller"
    "myapp/routes"
    "myapp/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"  // 生成されたdocsパッケージをimport
)

// @title My App API
// @version 1.0.0
// @description SpineベースのREST API

// @host localhost:8080
// @BasePath /
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // Swagger UI登録
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```
### main.go コメントタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@title` | APIタイトル| `My App API` |
| `@version` | APIバージョン| `1.0.0` |
| `@description` | APIの説明 | `SpineベースのREST API` |
| `@host` |ホストアドレス| `localhost:8080` |
| `@BasePath` |基本パス| `/` |


## コントローラの文書化

### 基本フォーマット
```go
// controller/user_controller.go
package controller

import (
    "context"

    "myapp/dto"
    "myapp/service"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser godoc
// @Summary ユーザー 参照
// @Description IDでユーザー情報を参照します
// @Tags users
// @Param id query int true "User ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} ErrorResponse
// @Router /users [get]
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[dto.UserResponse], error) {
    id := int(q.Int("id", 0))

    user, err := c.svc.Get(ctx, id)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, httperr.NotFound("ユーザーが見つかりません")
    }

    return httpx.Response[dto.UserResponse]{Body: user}, nil
}
```


### CRUDの完全な例


```go
// GetUser godoc
// @Summary ユーザー 参照
// @Description IDでユーザー情報を参照します
// @Tags users
// @Param id query int true "User ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} ErrorResponse
// @Router /users [get]
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[dto.UserResponse], error) {
    // ...
}

// CreateUser godoc
// @Summary ユーザー 生成
// @Description 新しいユーザーを作成します
// @Tags users
// @Accept json
// @Produce json
// @Param body body dto.CreateUserRequest true "ユーザー 生成 リクエスト"
// @Success 200 {object} dto.UserResponse
// @Failure 400 {object} ErrorResponse
// @Router /users [post]
func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
) (httpx.Response[dto.UserResponse], error) {
    // ...
}

// UpdateUser godoc
// @Summary ユーザー更新
// @Description ユーザー情報を更新します
// @Tags users
// @Accept json
// @Produce json
// @Param id query int true "User ID"
// @Param body body dto.UpdateUserRequest true "ユーザー更新リクエスト"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} ErrorResponse
// @Router /users [put]
func (c *UserController) UpdateUser(
    ctx context.Context,
    q query.Values,
    req *dto.UpdateUserRequest,
) (httpx.Response[dto.UserResponse], error) {
    // ...
}

// DeleteUser godoc
// @Summary ユーザー削除
// @Description ユーザーを削除します
// @Tags users
// @Param id query int true "User ID"
// @Success 200
// @Failure 404 {object} ErrorResponse
// @Router /users [delete]
func (c *UserController) DeleteUser(
    ctx context.Context,
    q query.Values,
) error {
    // ...
}
```
## コメントタグリファレンス

### デフォルトタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Summary` | まとめ（1行） | `ユーザー参照` |
| `@Description` | 詳細な説明 | `IDでユーザー情報を参照します` |
| `@Tags` | グループタグ | `users` |
| `@Router` | パスとメソッド | `/users [get]` |

### リクエストタグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Accept` | 要求Content-Type | `json` |
| `@Produce` | 応答Content-Type | `json` |
| `@Param` | パラメータ定義 | `id query int true "User ID"` |

### 応答タグ

| タグ | 説明 | 例 |
|------|------|------|
| `@Success` | 成功応答 | `200 {object} dto.UserResponse` |
| `@Failure` | 失敗応答 | `404 {object} ErrorResponse` |


## @Param形式
```
@Param [名前] [位置] [型] [必須] "[説明]"
```

### 位置(in)

| 場所 | 説明 | 例 |
|------|------|------|
| `query` | クエリ文字列 | `/users?id=1` |
| `path` | URLパス | `/users/{id}` |
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
// @Param body body dto.CreateUserRequest true "ユーザー 生成 リクエスト"

// ヘッダー
// @Param Authorization header string true "Bearerトークン"
```


## DTO文書化

### リクエストDTO


```go
// dto/user_request.go
package dto

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
// dto/user_response.go
package dto

// UserResponse ユーザー レスポンス
type UserResponse struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"Alice"`
    Email string `json:"email" example:"alice@example.com"`
}

// ErrorResponse エラー レスポンス
type ErrorResponse struct {
    Error string `json:"error" example:"ユーザーが見つかりません"`
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


## ドキュメントの生成

### 命令の実行


```bash
# プロジェクトルートで実行
swag init

# またはmain.goのパスを指定
swag init -g main.go
```

### 生成結果

```
myapp/
├── docs/
│   ├── docs.go       # Goコード
│   ├── swagger.json  # JSON仕様
│   └── swagger.yaml  # YAML仕様
├── main.go
└── ...
```

### 生成された docs/docs.go


```go
// Package docs Code generated by swaggo/swag. DO NOT EDIT
package docs

import "github.com/swaggo/swag"

const docTemplate = `{
    "swagger": "2.0",
    "info": {
        "title": "My App API",
        "version": "1.0.0"
    },
    ...
}`

var SwaggerInfo = &swag.Spec{
    Version:     "1.0.0",
    Title:       "My App API",
    Description: "SpineベースのREST API",
    // ...
}

func init() {
    swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
```

## Swagger UIへの接続

### サーバーの実行


```bash
go run main.go
```

### ブラウザからアクセス

```
http://localhost:8080/swagger/index.html
```

## 自動再生

コードを変更したときに文書を自動的に再生成するには：

### Makefileの使用


```
makefile
# Makefile

.PHONY: swagger run

swagger:
	swag init -g main.go

run: swagger
	go run main.go
```


```bash
make run
```

### スクリプトの使用


```bash
# !/bin/bash
# run.sh

swag init -g main.go
go run main.go
```


```bash
chmod +x run.sh
./run.sh
```

## 完全な例

### プロジェクト構造

```
myapp/
├── main.go
├── docs/
│   ├── docs.go
│   ├── swagger.json
│   └── swagger.yaml
├── controller/
│   └── user_controller.go
├── dto/
│   ├── user_request.go
│   └── user_response.go
├── service/
│   └── user_service.go
└── routes/
    └── routes.go
```

### main.go


```go
package main

import (
    "log"
    "time"

    "myapp/controller"
    "myapp/routes"
    "myapp/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/labstack/echo/v4"
    httpSwagger "github.com/swaggo/http-swagger"

    _ "myapp/docs"
)

// @title My App API
// @version 1.0.0
// @description SpineベースのREST API

// @host localhost:8080
// @BasePath /
func main() {
    app := spine.New()

    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    routes.RegisterUserRoutes(app)

    // Swagger UI登録
    app.Transport(func(t any) {
        e := t.(*echo.Echo)
        e.GET("/swagger/*", echo.WrapHandler(httpSwagger.WrapHandler))
    })

    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```

### controller/user_controller.go


```go
package controller

import (
    "context"

    "myapp/dto"
    "myapp/service"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser godoc
// @Summary ユーザー 参照
// @Description IDでユーザー情報を参照します
// @Tags users
// @Param id query int true "User ID"
// @Success 200 {object} dto.UserResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /users [get]
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (dto.UserResponse, error) {
    id := int(q.Int("id", 0))

    user, err := c.svc.Get(ctx, id)
    if err != nil {
        return dto.UserResponse{}, httperr.NotFound("ユーザーが見つかりません")
    }

    return user, nil
}

// CreateUser godoc
// @Summary ユーザー 生成
// @Description 新しいユーザーを作成します
// @Tags users
// @Accept json
// @Produce json
// @Param body body dto.CreateUserRequest true "ユーザー 生成 リクエスト"
// @Success 200 {object} dto.UserResponse
// @Failure 400 {object} dto.ErrorResponse
// @Router /users [post]
func (c *UserController) CreateUser(
    ctx context.Context,
    req dto.CreateUserRequest,
) (dto.UserResponse, error) {
    return c.svc.Create(ctx, req.Name, req.Email)
}
```


## コアクリーンアップ

|ステップ|コマンド/タスク|
|------|----------|
| 1.インストール| `go install github.com/swaggo/swag/cmd/swag@latest` |
| 2.コメントを書く| `// @Summary`、`// @Param`、`// @Router`など
| 3.文書の作成`swag init` |
| 4. UI登録| `e.GET("/swagger/*", ...)` |
| 5.接続| `http://localhost:8080/swagger/index.html` |


## 次のステップ

- [リファレンス: API](/ja/reference/api/spine-app) — Spine API ドキュメント
- [リファレンス: 例](/ja/reference/examples/crud) — 完全なサンプルプロジェクト
