# 紹介

Spine は役割別コンストラクター、コントローラーのルート、インターセプターを Go で組み立てるバックエンドフレームワークです。

## 実行例

```sh
go mod init example.com/spine-intro
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

Go 1.26 以降で main.go に保存して go run . を実行します。別の端末で curl `http://localhost:8080/greeting` を実行すると hello です。

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Repository struct{}

func (*Repository) Constructor() *Repository { return &Repository{} }
func (*Repository) Greeting() string         { return "hello" }

type Service struct{ repository *Repository }

func (*Service) Constructor(repository *Repository) *Service { return &Service{repository: repository} }

type Controller struct{ service *Service }

func (*Controller) Constructor(service *Service) *Controller { return &Controller{service: service} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/greeting", func() httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Service(&Service{}), constructor.Repository(&Repository{}))
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

## 共通の開発モデル

BuildApplication でプラットフォームと検証器を選び役割を登録します。Constructor は型で DI を解決し、RegisterRoutes は HTTP ルートを宣言します。input.Path、Query、Header、Body で入力元を明示します。登録検証器がタグを自動検査し、成功は httpx、失敗は error で表します。

## はじめる

[インストール](/ja/learn/getting-started/installation) / [最初のアプリ](/ja/learn/getting-started/first-app) / [コントローラー](/ja/learn/tutorial/2-controller)
