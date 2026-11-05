# 現在のリリース

最新タグと次の目標バージョンは[バージョン一覧](/ja/community/versions)で確認してください。

Preview、RC、安定版の選択と公開手順は[リリースチャンネルとインストール](/ja/community/release-channels)を参照してください。

::: warning v0.7.0 Preview 入力 API の移行
このページの既存 API の説明と例は安定版 `v0.6.5` を対象としています。`v0.7.0-preview.1` から入力元別の Path、Query、Header DTO を利用できます。`query.Values`、`header.Values` とその生成および取得 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` は Deprecated です。

新しい DTO 方式は `v0.6.5` にそのまま適用できません。Preview でも、同じハンドラーで新しい DTO と Deprecated な入力を混在させると起動時に拒否されます。既存のボディ DTO とコンテキストは、どちらの方式とも併用できます。

対象バージョンと移行例は [Preview ハンドラー入力の移行](/ja/learn/migration/v0.7.0-preview)、仕様の設定は [ランタイム OpenAPI](/ja/reference/api/openapi)を参照してください。
:::

通常のインストールには `@latest` を使います。現在の文書はSpine v0.6.5とCLI v0.4.2を対象とします。CLIは `spine version`、実際の依存関係は生成した `go.mod` で確認します。

## Preview CLI @preview {#cli-preview-branch}

CLI と新しいアプリの依存関係は Preview ブランチに追従できます。CLI は `@preview` でインストールし、新しいアプリは `platform-contracts-preview` レシピを使用します。生成と `spine update` はコアと選択したプラットフォームの `@preview` を解決し、実際のバージョンを `go.mod` に記録します。既存のバージョン付きレシピは明示的に変更するまで固定バージョンを維持します。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

## Spine CLI v0.4.3-preview.3 {#cli-preview}

Preview CLI `v0.4.3-preview.3` の新しいプロジェクトは `platform-contracts-v0.7.0-preview.2` レシピを使用します。コアは `v0.7.0-preview.2`、Echo、Gorilla、Kafka、RabbitMQ と playground は選択したものに限り `v0.2.0-preview.1` を使用します。

CLI のインストールだけでは既存アプリのレシピ変更や Swagger UI、ReDoc の有効化は行いません。既存の Preview 1 と安定版レシピは明示的に変更するまで維持します。

[Preview のインストール](/ja/learn/getting-started/installation#preview-cli)、[既存アプリの移行](/ja/learn/migration/v0.7.0-preview)、[CLI タグ](https://github.com/NARUBROWN/spine-cli/tree/v0.4.3-preview.3)、[3 つの OS での発行検証](https://github.com/NARUBROWN/spine-cli/actions/runs/41971655264)を参照してください。

## Spine v0.7.0-preview.2 {#spine-preview-ui}

コア `v0.7.0-preview.2` 以降では、`boot.OpenAPIOptions.UI` から Swagger UI と ReDoc を選択できます。UI アセットとライセンス通知はバイナリに含まれます。既定のパスは `/docs` と `/redoc` で、それぞれ `Path` と `Title` を設定できます。

ランタイム OpenAPI JSON は `v0.7.0-preview.1` 以降、`UI` 登録オプションと両埋め込み UI パッケージは `v0.7.0-preview.2` 以降で利用できます。HTTP には Echo `v0.2.0-preview.1` を使用します。安定版 `v0.6.5` と区別して選択してください。

```bash
go get github.com/NARUBROWN/spine@v0.7.0-preview.2 github.com/NARUBROWN/spine-echo-platform@v0.2.0-preview.1
```

[起動オプション](/ja/reference/api/openapi#options)、[UI 登録と実行例](/ja/reference/api/openapi#tools)、[コアのタグ](https://github.com/NARUBROWN/spine/tree/v0.7.0-preview.2)を確認してください。

## Spine v0.7.0-preview.1 {#spine-preview}

公開済みの Preview タグはコアの `v0.7.0-preview.1` と、各独立プラットフォームおよび playground の `v0.2.0-preview.1` です。安定版ドキュメントの基準である `v0.6.5` と区別して選択してください。

入力元別の Path、Query、Header DTO、従来入力 API の Deprecated、混在時の起動拒否とボディバインディングの変更を説明します。標準 OpenAPI は `Enabled: true` で明示的に有効にします。

対象バージョン、互換性と使用方法は [ハンドラー入力の移行](/ja/learn/migration/v0.7.0-preview)と [ランタイム OpenAPI リファレンス](/ja/reference/api/openapi)を参照してください。

## Spine v0.6.5 / CLI v0.4.2

HTTP、WebSocket、イベント、DTO検証の公開契約を `contract/` に統合しました。`spine.New(...)` で独立プラットフォームを選び、Kafka、RabbitMQのbootオプションは削除しました。CLI 0.4.2は実装の選択とv0.6.5レシピを生成します。

[プラットフォームとDTO検証の選択](/ja/learn/getting-started/platforms)

## Spine v0.6.0

Spine v0.6.0 の公開 API とランタイムは、次の機能を提供します。

- HTTP 契約と Echo 実装を分離し、`spine-echo-platform` で HTTP アプリを作成
- CLI `v0.4.0` の標準 `new` でプラットフォームのインストール、静的契約の検査、ビルドを実行

- `BeforeResponse` を含む 4 段階のインターセプターと、送信前に準備する HTTP レスポンス
- ネットワークに接続せずに設定を検証し、構造化された `boot.ConfigError` を返す `App.Validate`
- `InterceptorFor` による HTTP と WebSocket のインターセプターの適用範囲の指定
- Kafka の TLS とコンシューマーの再試行設定、ACK/NACK 失敗後のリーダーの再生成と安全な終了
- RabbitMQ の暗号化接続、永続メッセージの発行確認、prefetch、失敗時のポリシーと DLX
- WebSocket の同一オリジン検証、信頼するプロキシの設定、接続数の制限、アップグレード前の認証
- 認証情報を含む CORS リクエストと Cookie 設定の厳格な検証
- 起動中の準備状態の確認と、定められた順序での終了
- 安全な DI シングルトンの解決、ルーターのフォールバック処理、引数の変換

本番環境のデフォルト値と制約は、[セキュリティ設定](/ja/reference/security-configuration)を参照してください。

## Spine CLI v0.4.1

公式のインストール先は `github.com/NARUBROWN/spine-cli/cmd/spine`、実行コマンドは `spine` です。既存アプリの移行ガイドと、オフライン契約検査に必要なモジュールキャッシュの準備手順を追加したパッチです。CLI v0.4.0 のコマンドと生成動作は維持します。

- [CLI v0.4.1 リリース](https://github.com/NARUBROWN/spine-cli/releases/tag/v0.4.1)
- [既存アプリの移行ガイド](https://github.com/NARUBROWN/spine-cli/blob/v0.4.1/migration/v0.4.0.md)

## Spine CLI v0.4.0

CLI v0.4.0 は Spine v0.6.0、Echo プラットフォーム v0.1.0、HTTP アダプター v2 契約をサポートします。

- [CLI のインストール](/ja/learn/getting-started/installation)
- [最初のアプリを作る](/ja/learn/getting-started/first-app)
