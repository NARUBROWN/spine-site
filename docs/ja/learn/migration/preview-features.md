# v0.7.0 Preview の機能と起動オプション

::: warning Preview
以下の実行例には Spine `v0.7.0-preview.7` 以降が必要です。 [Preview](/ja/learn/migration/preview-controller-routes)
:::

起動オプションで Swagger UI と ReDoc を有効にし、HTTP v3 と net/http プラットフォームへの移行点を確認します。Preview にマージされたパス処理、終了処理、イベントのクリーンアップ履歴の変更もまとめています。

::: warning Preview 専用
このページは `preview` ブランチを対象とし、安定版 `v0.6.5` にはそのまま適用できません。最初の公開バージョンと現在のブランチ変更を区別します。`@preview` は移動するため、アプリのソース、`go.mod`、`go.sum` を一緒に保存してください。
:::

## 対象バージョンとインストール {#versions}

| 機能 | 最初の公開バージョン |
| --- | --- |
| 入力元別 DTO と OpenAPI JSON | Spine `v0.7.0-preview.1` |
| 埋め込み Swagger UI と ReDoc | Spine `v0.7.0-preview.2` |
| HTTP v3、TLS、net/http プラットフォーム | Spine `v0.7.0-preview.3`, Echo `v0.2.0-preview.2`, net/http `v0.1.0-preview.1` |
| HTTP v3 解析と net/http アプリの生成および更新 | CLI `v0.4.3-preview.4` |
| コントローラールート、役割別生成、API グループ | Spine `v0.7.0-preview.7`, CLI `v0.4.3-preview.8` |

Go 1.25.5 以上が必要です。playground 検証器を選ぶ場合は Go 1.26 以上が必要です。net/http は `--platform nethttp` で選択できます。既定の Go プロキシ設定では Preview のブランチ情報を元のリポジトリから取得するため Git が必要です。CLI のインストールとアプリ依存関係の更新は別の操作です。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
spine new preview-api --module example.com/preview-api --platform echo
cd preview-api
spine contract check
spine verify
```

既存アプリは[入力移行ガイド](/ja/learn/migration/v0.7.0-preview#versions)に従い `recipe = "platform-contracts-preview"` を選択します。`spine update --dry-run` の変更内容を確認し、出力に示された適用コマンドを実行してください。`update` はアプリのソースを変更しないため、起動オプションと Prepared API は手動で反映します。

## Swagger UI と ReDoc の起動オプション {#boot}

::: warning 現在の net/http 文書 UI の制限
2026-11-06 確認: コア `83b1e03` と net/http `v0.1.0-preview.2` の組み合わせは文書とアセットの Content-Type を `text/plain` に上書きし、Swagger UI と ReDoc が正常に表示されません。以下の UI 実行例は Echo `v0.2.0-preview.3` を使用します。
:::

以下は独立した参考アプリの `main.go` です。上記 CLI で依存関係を準備した別ディレクトリで実行してください。既存アプリでは現在の composition と `BuildApplication` に import と `HTTP.OpenAPI` 設定を反映します。

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
                Title:   "Preview API",
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

HTTP v3 ではコアが JSON、XML、urlencoded form、multipart を共通実装で解析します。パスとクエリは本文 DTO にマージしません。認証インターセプターの後で必要な DTO を解析し、バインドした DTO ごとに検証します。

`MaxBodyBytes: 0` は本文全体の上限 32 MiB、正の値は指定バイト数、負の値は制限解除です。`MultipartMemoryBytes: 0` はファイルのメモリ予算 32 MiB、正の値は指定予算、負の値は準備エラーです。multipart 予算はリクエスト全体のメモリ上限ではなく、超過したファイルはディスクに保存します。

フォーム DTO とアップロードファイルは同じ multipart 結果を共有します。ファイルはすべての `AfterCompletion` が終わるまで有効で、その後に一時ファイルを削除します。後で使うファイルはフック終了前に別途保存してください。Spine DTO 入力は Echo Binder、JSONSerializer、`UnmarshalParam` 拡張を呼びません。標準 JSON、XML、Text デコーダーへ移すか native Echo ルートを使います。Echo の応答出力拡張は維持します。

## 外部サーバーと独自 HTTP アダプターの移行 {#prepared}

`PreparedApplication.Handler()` を `(http.Handler, error)` を返す `spine.NetHTTPHandler(prepared)` に変更します。`prepared.HTTPAdapter()` は同じ準備済みアダプターを返し、HTTP 無効時は nil です。アダプターの実行と終了を重複させないでください。外部サーバーの終了と `prepared.Close(ctx)` は呼び出し側が管理します。Close は新規進入を止め、WebSocket と native ミドルウェアの後処理を含むリクエストを整理します。待機 context の期限後もクリーンアップは続きます。

独自 HTTP プラットフォームは `spine.http-adapter/v3` に移行し、`Serve(net.Listener, ...httpcontract.ServeOption) error` と TLS capability を反映します。`adapter` と `adapter/http` の別名は v2 実装を自動変換しません。net/http は独立モジュールで、`DisableRecover: true` には対応しません。[HTTP v3 移行の詳細](https://github.com/NARUBROWN/spine/blob/preview/docs/migration/http-v3.md)を参照してください。

## 今回のマージによる追加変更 {#merged}

追加変更は[コア PR #34](https://github.com/NARUBROWN/spine/pull/34)のマージ済みソースに基づきます。次の候補は `v0.7.0-preview.5` ですが、候補番号だけでタグ公開やリリース全体の完了は判断できません。

- パス値: `/users/:id` と `/users/:userID/posts` は各ルートのキーでバインドします。`/files/:name` の `a%2Fb` は `a/b`、`a%252Fb` は `a%2Fb` に一度だけデコードします。実際の `/files/a/b` はこのルートに一致しません。
- 終了: WebSocket のクリーンアップが panic になっても後続アプリ資源を整理し、HTTP の実際の Serve エラーを正常終了として隠しません。
- イベント: `spine.WithEventPublisherErrorHistory` と `spine.WithEventConsumerErrorHistory` に `boot.CleanupErrorHistoryOptions{MaxEntries, MaxAge}` を渡して役割別の整理失敗履歴を設定します。既定値は直近 32 件、最大 1 時間で、先に達した制限を適用します。0 は既定値、負の値は事前検査エラーです。ログの保存期間と返却済み終了結果は変えません。新 helper の CLI 静的解析対応は後続作業です。
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
- [v0.7.0](/ja/learn/migration/v0.7.0-preview)
- [Preview → RC → Production](/ja/community/release-channels)
- [Spine #26: OpenAPI UI](https://github.com/NARUBROWN/spine/pull/26)
- [Spine #32: HTTP v3 / TLS](https://github.com/NARUBROWN/spine/pull/32)
- [Spine #33: Preview](https://github.com/NARUBROWN/spine/pull/33)
- [Spine #34: Preview](https://github.com/NARUBROWN/spine/pull/34)
- [Spine CLI #39: HTTP v3 / net/http](https://github.com/NARUBROWN/spine-cli/pull/39)
