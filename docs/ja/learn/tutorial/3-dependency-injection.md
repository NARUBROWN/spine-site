# 依存性注入

コンストラクターの引数型でリポジトリー、サービス、コントローラーを接続します。この独立アプリは DB なしで GET /greeting に hello を返します。

## 生成契約

各型は Constructor(依存...) *Self メソッドを実装します。constructor パッケージで Repository、Service、Controller、Interceptor の役割を登録します。Controller は RegisterRoutes、Interceptor は四つのフックも実装します。Custom は外部生成関数や一般オブジェクト用です。

&Service{} は型の目印です。フィールドはコピーされず、新しい receiver で Constructor が呼ばれます。生成結果はアプリ内で共有されます。

## 実行例

[コントローラーの依存](/ja/learn/tutorial/2-controller)

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
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
	r.GET("/greeting", func(ctx spinectx.Ctx) httpx.Response[string] {
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

## 依存解決

```sh
go run .
#
curl http://localhost:8080/greeting
```

登録順に関係なく依存順に生成し、hello を返します。グラフ検査は型の重複、依存の不足、曖昧なインターフェース、循環を拒否します。nil とパニックは準備時の生成実行で検出します。

## 外部生成関数

```go
app.Constructor(constructor.Custom(database.NewDB))
```

database.NewDB の例は func NewDB() *bun.DB です。オブジェクトと関数の生成子は戻り値一つに対応します。(T, error) と可変長引数は拒否し、通常の []T 引数は使用できます。インターフェースは戻り型が一致する提供者を優先し、なければ代入可能な提供者が一つ必要です。

## 検証と寿命

BuildApplication は組み立てだけを行います。app.Validate は生成子を実行せずに検査し、Prepare は生成子を実行して RegisterRoutes を収集します。Run は準備して起動します。DI の任意の Close は自動実行しないため、DB 資源は所有者が管理します。リクエストのトランザクションは共有フィールドを上書きせず、ExecutionContext().Set/Get と明示的なサービス引数で渡します。

## 次のステップ

[インターセプター](/ja/learn/tutorial/4-interceptor) / [データベース](/ja/learn/tutorial/5-database) / [トランザクション](/ja/learn/tutorial/6-transaction)
