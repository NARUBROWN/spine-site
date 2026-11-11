# リリースノート

現在の API は [0.7.5 移行案内](/ja/learn/migration/v0.7.5)を参照してください。以下の公開情報と過去の記録は各タグの内容です。

最新タグと次の目標バージョンは[バージョン一覧](/ja/community/versions)で確認してください。

Preview、RC、安定版の選択と公開手順は[リリースチャンネルとインストール](/ja/community/release-channels)を参照してください。

## Spine v0.7.5 / CLI v0.4.4

Spine `v0.7.5` では HTTP 入力を `input.Path`、`input.Query`、`input.Header`、`input.Body` で宣言します。HTTP、イベント、WebSocket のハンドラーとインターセプターは共通の `spine.Ctx` を使います。

CLI `v0.4.4` は入力の契約を検査し、生成コードと OpenAPI に反映します。正式版の依存関係チャネルでは、新規 HTTP アプリにコア `v0.7.5` と Echo プラットフォーム `v0.2.1` を選びます。

Go モジュールで撤回された `v0.7.0`、`v0.7.1`、`v0.7.2-preview.1` を使用している場合は、`v0.7.5` に更新してください。

- [Spine v0.7.5 リリース](https://github.com/NARUBROWN/spine/releases/tag/v0.7.5)
- [CLI v0.4.4 リリース](https://github.com/NARUBROWN/spine-cli/releases/tag/v0.4.4)
- [0.7.5 移行ガイド](/ja/learn/migration/v0.7.5)

## Spine v0.7.1

Spine `v0.7.1` はコントローラールート、役割別コンストラクター、入力元別の HTTP 入力、ランタイム OpenAPI、HTTP v3 を提供します。従来の入力 API は互換性を維持しますが Deprecated で、同じハンドラーで新しい入力と混在できません。

[0.7.5 移行ガイド](/ja/learn/migration/v0.7.5#from-v071)と[ランタイム OpenAPI](/ja/reference/api/openapi)を参照してください。CLI のバージョンとアプリの依存関係は別々に選択します。CLI は `spine version`、依存関係は `go.mod` で確認します。以下は各バージョンの過去の記録です。

## Preview CLI @preview {#cli-preview-branch}

CLI は `@preview` でインストールできます。アプリの依存関係は `spine new --channel preview`、`rc`、`main` から別に選択します。Preview チャンネルは選択した依存関係の移動する `@preview` ブランチを解決します。再現にはソース、`go.mod`、`go.sum` を保管します。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

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
