# ランタイム OpenAPI

Spine `v0.7.0-preview.1` 以降では、実際に登録した HTTP ルート、ハンドラーの型、validator の記述契約から OpenAPI 3.1.2 JSON を生成できます。

`boot.OpenAPIOptions.UI` と埋め込み Swagger UI、ReDoc は `v0.7.0-preview.2` 以降で利用できます。JSON ドキュメント生成を導入した `v0.7.0-preview.1` とは提供開始バージョンが異なります。

::: warning v0.7.0 の Preview API
この API は安定版 `v0.6.5` に含まれません。HTTP には Echo `v0.2.0-preview.1` を使用し、playground で検証と詳細な入力スキーマを記述する場合は `v0.2.0-preview.1` を選んでください。入力引数については、先に [Preview へのハンドラー入力の移行](/ja/learn/migration/v0.7.0-preview)を確認してください。
:::

## 有効化と起動オプション {#options}

自動生成と HTTP での提供は、既定では無効です。既存アプリの `boot.Options` で、以下のように明示的に有効化します。`boot` のインポートパスは `github.com/NARUBROWN/spine/pkg/boot` です。

```go
options := boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{
        GlobalPrefix: "/api",
        OpenAPI: boot.OpenAPIOptions{
            Enabled: true,
            Path: "/openapi.json",
            Title: "User API",
            Version: "1.0.0",
        },
    },
}
```

| フィールド | 既定値 | 動作 |
| --- | --- | --- |
| `Enabled` | `false` | `true` の場合、準備段階で自動生成して HTTP で提供 |
| `Path` | `/openapi.json` | GET と HEAD で提供する静的な絶対パス |
| `Title` | `Spine API` | OpenAPI の `info.title` |
| `Version` | `unversioned` | アプリの `info.version`。フレームワークのバージョンとは独立 |
| `UI` | `nil` | `v0.7.0-preview.2` 以降の `[]boot.OpenAPIUI`。省略すると JSON ドキュメントのみを提供 |

`HTTP: nil` の場合、HTTP とドキュメントのリソースはどちらも無効です。`Path`、`Title`、`Version` だけを指定しても有効にはなりません。無効にするには `Enabled: false` を設定するか、OpenAPI オプションを省略してください。未公開の開発ソースで使用していた `Disabled` ではなく、公開 Preview の `Enabled` を使用します。

ドキュメントのパスは `GlobalPrefix` から独立しています。上記のオプションは業務 API に `/api` を適用しますが、ドキュメントは `/openapi.json` で提供します。準備済みのアプリはドキュメントのスナップショットを再利用し、ファイルを自動保存しません。

## ドキュメントの取得とパスの競合 {#http}

有効化されたリソースは公開リソースとして取得でき、HTTP サーバーのミドルウェアを通ります。ドキュメントの取得では、業務コントローラー、DTO のバインディング、validator による検証、Spine の業務インターセプターは実行しません。

アプリの GET、HEAD、WebSocket のいずれかのルートがドキュメントのパスに一致すると、起動時に `OPENAPI_PATH_CONFLICT` になります。`/:id` のような動的ルートも競合する場合があります。`Path` を重複しない静的パスに変更するか、ドキュメントを無効にしてください。無効な状態では、このパスを予約しません。プラットフォームに直接登録した native ルートは、コアの競合検査の対象外です。

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/openapi.json
```

## アプリを実行せずに記述またはエクスポートする {#export}

次の関数は、構成済みのアプリ、HTTP オプション、出力先を受け取ります。既存の `spine.App` インターフェースを置き換えるものではありません。

```go
func ExportOpenAPI(app spine.App, options boot.Options, output io.Writer) error {
    if options.HTTP == nil {
        return errors.New("HTTP options are required")
    }
    description, err := spine.DescribeHTTP(app, options)
    if err != nil {
        return err
    }
    document, err := openapi.Generate(description, options.HTTP.OpenAPI)
    if err != nil {
        return err
    }
    _, err = output.Write(document)
    return err
}
```

この関数には、標準の `errors`、`io`、`github.com/NARUBROWN/spine`、`github.com/NARUBROWN/spine/pkg/boot`、`github.com/NARUBROWN/spine/pkg/openapi` のインポートが必要です。`DescribeHTTP` は、コンストラクタ、factory、ハンドラー、検証ルールを実行しません。登録した `SchemaDescriber` の記述メソッドを呼ぶ場合はあります。ファイルに出力する場合は、呼び出し側が `io.Writer` を渡します。

明示的に呼び出す `DescribeHTTP` と `openapi.Generate` は、HTTP での自動提供を無効にした状態でも使用できます。記述機能を持たないカスタム App は `ErrHTTPDescriptionUnavailable` を返します。

## validator と記述の範囲 {#validation}

| 登録状態 | 生成する情報 |
| --- | --- |
| validator 未登録 | ルートと HTTP メソッドを中心とする情報と `VALIDATOR_NOT_CONFIGURED` 診断 |
| validator は登録済みだが `SchemaDescriber` に未対応 | リクエスト検証は維持。DTO の詳細な入力は省略し、DTO の記述時に `INPUT_SCHEMA_DESCRIPTION_UNAVAILABLE` 診断を付加 |
| 記述契約に対応する validator を登録 | 入力元ごとの DTO と、記述可能な検証制約 |

validator がない場合、入力パラメーター、リクエストモデル、レスポンスモデル、エラーステータスコードは推定しません。OpenAPI 形式が要求する最小限のレスポンスのプレースホルダーと、型を指定しないパス変数のプレースホルダーは維持します。

`SchemaDescriber` に未対応の validator でも、既存の path ラッパーの型と `query.Pagination` の page、size、既定値は記述できます。DTO 入力の詳細な記述には `SchemaDescriber` が必要です。

入力が必須かどうかは validator の契約に従います。ポインターや `json:",omitempty"` だけでは required を決定しません。パスのセグメントは常に必須で、パスのポインターも optional または nullable な入力を意味しません。

未対応のユーザー定義ルールや動的な値は、`x-spine-diagnostics` に制限を記録します。既存の `query.Values` や `header.Values` が関数内で読み取るキーは推測しません。`query.Pagination` は宣言された page と size を記述しますが、他の既存入力と同じく Deprecated として維持されます。

`httpx.Response[T]` の T は、レスポンス本文の型を記述します。ハンドラーが選ぶステータスコードやエラー分岐は実行せずに確定できないため、`default` に記述します。validator が登録され、ドキュメントにリクエスト本文または入力パラメーターがある場合は、フレームワークのバインディングと DTO 検証の失敗を示す `400` レスポンスも追加します。ハンドラー内で適用した既定値も、自動生成するドキュメントに補完しません。

## Swagger UI と ReDoc の提供 {#tools}

`v0.7.0-preview.2` 以降では、既存の `boot.Options.HTTP.OpenAPI` に `UI` を追加してドキュメント画面を選択できます。`Enabled: true` と UI 登録を指定してください。JSON のみを提供する場合は `UI` を省略します。コアのバージョンを明示的に固定し、HTTP プラットフォームには既存の Preview タグを使用します。

```bash
go get github.com/NARUBROWN/spine@v0.7.0-preview.2 github.com/NARUBROWN/spine-echo-platform@v0.2.0-preview.1
```

以下は、使用する UI を登録する独立したアプリの `main.go` です。既存アプリでは、現在の composition に import と `OpenAPI.UI` の設定を追加してください。

```go
package main

import (
    "log"

    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Hello() httpx.Response[string] {
    return httpx.Response[string]{Body: "hello"}
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(func() *Controller { return &Controller{} })
    app.Route("GET", "/hello", (*Controller).Hello)

    options := boot.Options{
        Address: ":8080",
        HTTP: &boot.HTTPOptions{
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Title:   "Example API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{}),
                    redoc.New(redoc.Options{}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

アプリを実行すると `/openapi.json`、`/docs`、`/redoc` を提供します。Swagger UI のみを使用する場合は ReDoc の import と登録を省略してください。`go:embed` により、選択した UI の JS、CSS、ライセンス通知をバイナリに含めます。既定の UI アセットを提供するために CDN、npm、別の静的ファイルディレクトリは必要ありません。

### 各 UI のオプション {#ui-options}

| オプション | Swagger UI の既定値 | ReDoc の既定値 | 意味 |
| --- | --- | --- | --- |
| `Path` | `/docs` | `/redoc` | ドキュメント画面の静的な絶対パス |
| `Title` | `API documentation` | `API reference` | ブラウザーのタブタイトル。ドキュメントの `info.title` は `OpenAPIOptions.Title` で指定 |

ドキュメント URL は共通の `OpenAPIOptions.Path` で指定します。ドキュメントとアセットのパスは `HTTP.GlobalPrefix` とは独立しています。アセットと再配布通知は各 UI パス配下の `/_assets/` で提供します。相対 URL を使うため、外部の接頭辞を除去してから転送するプロキシにも対応します。

ドキュメントとアセットは GET と HEAD で提供し、Spine の業務インターセプターを実行しません。HTTP サーバーのミドルウェアは適用されます。アクセスを制限する場合は、JSON ドキュメント、UI、アセットのパスを同じプロキシのアクセス方針で保護してください。Swagger から実行する API リクエストには、元の API のインターセプターが適用されます。

### UI 提供者の契約と準備 {#ui-provider}

両パッケージの `New` は、以下の `boot.OpenAPIUI` 型を返します。リソースの本文は文字列です。

```go
type OpenAPIResource struct {
    Path        string
    ContentType string
    Body        string
}

type OpenAPIUI func(documentPath string) ([]OpenAPIResource, error)
```

`Prepare` と `Run` は事前検査で各 UI 提供者を一度呼び出し、検証したリソースをそのまま HTTP アダプターに接続します。別途 `Validate` を呼び出した場合も提供者を実行し、その後の準備では再検査します。独自の提供者は、外部への接続やユーザーハンドラーの実行を行わずに静的リソースを返す必要があります。

ドキュメントやアセットのパスが既存の GET、HEAD、WebSocket ルートと重なる場合、準備は `OPENAPI_PATH_CONFLICT` で失敗します。nil の提供者や不正な UI オプションは `OPENAPI_UI_INVALID`、不正なリソースパスや Content-Type は `OPENAPI_UI_RESOURCE_INVALID` になります。

安定版 `v0.6.5` で UI を別途構成する場合は、[Swagger と OpenAPI チュートリアル](/ja/learn/tutorial/8-swagger)を参照してください。入力モデルは [Preview へのハンドラー入力の移行](/ja/learn/migration/v0.7.0-preview)、安定版 API は [spine.App](/ja/reference/api/spine-app)を参照してください。
