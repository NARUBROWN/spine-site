# v0.7.1 の HTTP と起動オプション

Spine `v0.7.1` の OpenAPI UI、HTTP v3 の入力処理、TLS、終了動作を説明します。既存アプリの移行時はプラットフォームとアプリのコードを合わせて確認してください。

## 例の対象バージョン {#versions}

独立例はコア `v0.7.1` と Echo `v0.2.0-rc.1` を使い、Go 1.25.5 以上が必要です。新しいディレクトリでモジュールを作成し、依存関係を固定してから以下のコードを `main.go` に保存します。正式プラットフォーム公開後は検証済みの互換タグを選び、`go.mod` と `go.sum` を保存してください。

```bash
go mod init example.com/boot-example
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0-rc.1
```

## Swagger UI と ReDoc の起動オプション {#boot}

次は独立アプリの `main.go` です。既存アプリでは import と `HTTP.OpenAPI` 設定を現在の構成に反映してください。

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
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }

func (c *Controller) RegisterRoutes(r *api.Registry) {
    r.GET("/hello", func() httpx.Response[string] {
        return httpx.Response[string]{Body: "hello"}
    })
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(constructor.Controller(&Controller{}))
    options := boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        HTTP: &boot.HTTPOptions{
            MaxBodyBytes:         32 << 20,
            MultipartMemoryBytes: 8 << 20,
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Path:    "/openapi.json",
                Title:   "Example API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{Path: "/docs"}),
                    redoc.New(redoc.Options{Path: "/redoc"}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

`Enabled` の既定値は `false` です。`Enabled: true` のみなら `/openapi.json` を提供し、`UI` に登録した画面だけを追加します。既定のパスは Swagger UI が `/docs`、ReDoc が `/redoc` です。各 UI の `Path` と `Title` を変更できます。画面とアセットはバイナリに含まれ、CDN や npm は不要です。

仕様、UI、アセットのパスは `GlobalPrefix` と独立し、GET と HEAD に対応します。業務インターセプターを通らないため、アクセス制限は HTTP サーバーのミドルウェアやプロキシに設定します。この例は検証器を登録していないため、仕様はルートとメソッド中心です。DTO の詳細には `SchemaDescriber` 対応の検証器が必要です。動的な応答ステータスは `default` に残ります。[OpenAPI の全オプション](/ja/reference/api/openapi#options)を参照してください。

## 管理サーバーの TLS {#tls}

`boot.HTTPOptions.TLS` に `*tls.Config` を渡すと管理サーバーを HTTPS で実行します。以下の関数には `spine`、`boot`、標準の `crypto/tls` import が必要です。

```go
func runTLS(app spine.App) error {
    certificate, err := tls.LoadX509KeyPair("server.crt", "server.key")
    if err != nil {
        return err
    }
    return app.Run(boot.Options{
        Address: ":8443",
        HTTP: &boot.HTTPOptions{
            TLS: &tls.Config{Certificates: []tls.Certificate{certificate}},
        },
    })
}
```

`TLS: nil` は平文 HTTP です。準備時に証明書と対応機能を検査し、設定をコピーします。`Serve(listener)` は準備済み TLS 設定を使い、`Serve(listener, httpcontract.WithTLS(config))` で変更できます。`httpcontract` の import は `github.com/NARUBROWN/spine/contract/http` です。最後のオプションが優先し、`WithTLS(nil)` はエラーです。外部 `http.Server` にハンドラーだけを接続する場合、TLS とサーバー終了は外部の所有者が管理します。この変更では HTTP バージョン選択や ALPN ポリシーを追加しません。

## HTTP v3 の入力とファイルの有効期間 {#body}

HTTP v3 ではコアが JSON、XML、urlencoded form、multipart を共通実装で解析します。パスとクエリは本文 DTO にマージしません。グローバルインターセプターの `PreHandle` の後で DTO を解析して個別に検証し、ルートインターセプターの `PreHandle` はバインド後に実行します。

`MaxBodyBytes: 0` は本文全体の上限 32 MiB、正の値は指定バイト数、負の値は制限解除です。`MultipartMemoryBytes: 0` はファイルのメモリ予算 32 MiB、正の値は指定予算、負の値は準備エラーです。multipart 予算はリクエスト全体のメモリ上限ではなく、超過したファイルはディスクに保存します。

フォーム DTO とアップロードファイルは同じ multipart 結果を共有します。ファイルはすべての `AfterCompletion` が終わるまで有効で、その後に一時ファイルを削除します。後で使うファイルはフック終了前に別途保存してください。Spine DTO 入力は Echo Binder、JSONSerializer、`UnmarshalParam` 拡張を呼びません。標準 JSON、XML、Text デコーダーへ移すか native Echo ルートを使います。Echo の応答出力拡張は維持します。

## 外部サーバーと独自 HTTP アダプターの移行 {#prepared}

`PreparedApplication.Handler()` を `(http.Handler, error)` を返す `spine.NetHTTPHandler(prepared)` に変更します。`prepared.HTTPAdapter()` は同じ準備済みアダプターを返し、HTTP 無効時は nil です。アダプターの実行と終了を重複させないでください。外部サーバーの終了と `prepared.Close(ctx)` は呼び出し側が管理します。Close は新規進入を止め、WebSocket と native ミドルウェアの後処理を含むリクエストを整理します。待機 context の期限後もクリーンアップは続きます。

独自 HTTP プラットフォームは `spine.http-adapter/v3` に移行し、`Serve(net.Listener, ...httpcontract.ServeOption) error` と TLS capability を反映します。`adapter` と `adapter/http` の別名は v2 実装を自動変換しません。net/http は独立モジュールで、`DisableRecover: true` には対応しません。[HTTP v3 移行の詳細](https://github.com/NARUBROWN/spine/blob/v0.7.1/docs/migration/http-v3.md)を参照してください。

## その他の実行動作 {#merged}

以下は `v0.7.1` のパス、終了、イベント処理の動作です。

- パス値: `/users/:id` と `/users/:userID/posts` は各ルートのキーでバインドします。`/files/:name` の `a%2Fb` は `a/b`、`a%252Fb` は `a%2Fb` に一度だけデコードします。実際の `/files/a/b` はこのルートに一致しません。
- 終了: WebSocket のクリーンアップが panic になっても後続アプリ資源を整理し、HTTP の実際の Serve エラーを正常終了として隠しません。
- イベント: `spine.WithEventPublisherErrorHistory` と `spine.WithEventConsumerErrorHistory` に `boot.CleanupErrorHistoryOptions{MaxEntries, MaxAge}` を渡して役割別の整理失敗履歴を設定します。既定値は直近 32 件、最大 1 時間で、先に達した制限を適用します。0 は既定値、負の値は事前検査エラーです。ログの保存期間と返却済み終了結果は変えません。
- nil イベント本文: raw byte ハンドラーは nil tombstone と長さ 0 の nonnil slice を区別します。本文が必要な DTO の失敗方針は維持します。
- Swagger UI: base64url、指数表記 multipleOf、items のない contains の例生成を修正しました。
- リリース構成: net/http を含む 6 つのプラットフォームを検証します。コアタグやソース CI の成功だけでは公開構成全体の検証完了を意味しません。

## リクエストで確認する {#verify}

独立参考アプリを `go run main.go` で実行します。`/hello` と仕様および両 UI の HEAD は HTTP 200 を返す必要があります。ブラウザーで `/docs` と `/redoc` の表示も確認してください。CLI 生成アプリは設定済みエントリーポイントを実行するため、同じオプションを `BuildApplication` に反映した場合は `spine run` を使います。

```bash
curl -i http://localhost:8080/hello
curl -I http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

## 関連文書とマージの根拠 {#sources}

- [OpenAPI](/ja/reference/api/openapi)
- [v0.7.1](/ja/learn/migration/v0.7.1-preview)
- [Preview → RC → Production](/ja/community/release-channels)
- [Spine #26: OpenAPI UI](https://github.com/NARUBROWN/spine/pull/26)
- [Spine #32: HTTP v3 / TLS](https://github.com/NARUBROWN/spine/pull/32)
- [Spine #33: Preview](https://github.com/NARUBROWN/spine/pull/33)
- [Spine #34: Preview](https://github.com/NARUBROWN/spine/pull/34)
- [Spine CLI #39: HTTP v3 / net/http](https://github.com/NARUBROWN/spine-cli/pull/39)
