# リリースチャンネルとインストール

現在の API は [0.7.5 移行案内](/ja/learn/migration/v0.7.5)を参照してください。以下の公開情報と過去の記録は各タグの内容です。

Spine と CLI は Preview、RC、安定版 (Production) の順にリリースします。開発中の変更を試すか、リリース候補を検証するか、安定版を使うかに応じて CLI のチャンネルを選びます。

このページでは Spine と CLI の公開手順を説明します。アプリの開発、ステージング、本番環境の設定は別途管理してください。

## チャンネルの選択 {#choose}

| チャンネル | 用途 | CLI のインストール先 |
| --- | --- | --- |
| Preview | 開発中の変更と新しい API を試す | `@preview` ブランチ |
| RC | Preview から昇格したリリース候補を検証する | `@rc` ブランチまたは公開済みの RC タグ |
| 安定版 (Production) | 通常の開発と本番運用の基準にする | `@latest` または公開済みの安定版タグ |

`@preview` と `@rc` は同名ブランチの最新コミットを選択します。そのコミットにバージョンタグがあればそのバージョン、なければコミットを識別する pseudo-version に解決されることがあります。`@latest` は安定版を優先します。[Go のバージョン選択規則](https://go.dev/ref/mod#version-queries)

## チャンネル別 CLI のインストール {#install}

以下から必要なチャンネルを 1 つ選んでください。同じ場所に再インストールすると既存の `spine` 実行ファイルを置き換えます。複数のチャンネルを併用する場合は、異なる `GOBIN` ディレクトリを指定します。Go と PATH の準備は[インストールガイド](/ja/learn/getting-started/installation)を参照してください。

### 安定版 {#stable}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

通常の開始方法です。実際のバージョンは `spine version` で確認します。`@main` は main ブランチのコードを選ぶため、安定版リリースをインストールする `@latest` と区別します。

### Preview {#preview}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

Preview にマージされた変更を確認できます。公開済み Preview タグ間の変更も含む場合があるため、検証済みの特定候補を再現する際はそのタグを指定します。

### RC {#rc}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@rc
spine version
```

RC ブランチの現在のコードをインストールします。Preview の変更は昇格後に含まれ、それまでは以前の機能やレシピが残る場合があります。ブランチが存在するだけで公式 RC が公開済みだとは判断できません。検証済み候補を再現するには、実際に公開された `vX.Y.Z-rc.N` タグと検証記録を確認してください。

## CLI チャンネルとアプリの依存関係 {#dependencies}

CLI のインストールとアプリの依存関係チャンネルは別です。CLI `v0.4.3` 以降、新規プロジェクトは対話型の作成でも `main` が既定です。`rc` は RC またはそれより新しい正式タグを選び、`preview` は Preview ブランチを参照します。既存プロジェクトのチャンネルは自動変更されません。

```bash
spine new channel-check --module example.com/channel-check --channel main
cd channel-check
go list -m github.com/NARUBROWN/spine
```

選択したチャンネルは `spine.toml` の `dependency_channel` に記録され、`spine update` が維持します。CLI の更新だけでは既存プロジェクトは変更されません。生成後に `go.mod` と `go.sum` を確認して管理してください。

## リリースの公開手順 {#process}

検証した候補を **Preview → RC → Production** の順に昇格します。ブランチのマージとタグの公開は別の段階です。

1. 変更を Preview にマージし、ソース CI を通過させます。
2. 公開するソースと依存関係の組み合わせを決め、そのソースのテストと公開モジュールを使う利用側の検査を実行します。CLI は Linux、macOS、Windows での公開インストールも確認します。
3. メンテナーが計画と結果を確認して承認した後、新しいタグを公開します。
4. 公開タグで再インストールして検査し、成功結果を release manifest に記録します。
5. 観察期間と昇格検査を通過した候補を RC、次に main に昇格します。昇格に必要なチャンネル別のバージョン固定変更はポリシーで検査し、それ以外のコードや依存関係の変更は新しい Preview から再検証します。
6. 安定版タグの公開検証まで成功した後、GitHub Release を公開します。コアは 6 つのプラットフォームを含む組み合わせ全体の検証も完了する必要があります。

Spine コアとプラットフォームは **コア候補の公開 → 6 つのプラットフォームの公開 → 組み合わせ全体の検証完了** の順に進めます。コアタグの公開だけで、プラットフォーム全体の昇格準備が完了するわけではありません。

CLI はコアと異なるバージョンと日程でリリースします。コアのバージョン変更ごとに CLI の番号もそろえる構造ではありません。アプリを生成または更新するときに、選択された組み合わせを確認してください。

## 観察期間 {#observation}

| 条件 | 現在のポリシー | 起点または範囲 |
| --- | --- | --- |
| Preview から RC | 最低 72 時間 | Preview の公開検証完了 manifest 作成後 |
| RC から安定版 | 最低 24 時間 | RC の公開検証完了 manifest 作成後 |
| 安定版公開の追加間隔 | コア 168 時間、CLI 0 時間 | 各リポジトリの前回の安定版公開が基準 |

時間が経過すると自動で次のバージョンが公開される日程ではありません。検証と承認の条件も満たす必要があります。緊急に観察期間を短縮する場合は理由を記録し、テスト、公開検証、承認は省略しません。

## タグと検証記録の確認 {#evidence}

- Preview タグは `vX.Y.Z-preview.N`、RC タグは `vX.Y.Z-rc.N`、安定版タグは `vX.Y.Z` 形式です。
- Preview と RC はタグと GitHub Actions の `release-manifest-<tag>` artifact に検証結果を残します。GitHub Releases に表示がなくても候補タグは存在する場合があります。
- 安定版は GitHub Release に検証 manifest を添付します。コアはプラットフォーム全体の完了記録を確認します。
- 候補を選ぶ際は、成功した公開実行、タグと一致するソースおよび依存関係、公開インストール結果を併せて確認します。

タグと公開バージョンは[現在のリリース](/ja/community/changelog)を参照してください。ブランチからのインストール結果だけでは、検証済み候補タグの公開完了を証明できません。

## バージョンの固定と復元 {#pin}

CI や本番環境では、実際に公開された CLI タグを固定し、アプリのソース、`go.mod`、`go.sum` も一緒にバージョン管理します。CLI タグが固定するのはツールのコードだけです。Preview の動的レシピは同じ CLI でも `new` や `update` の実行時に `@preview` を再度解決するため、アプリの再現には保存したソースと依存関係を使ってください。次の例は公開済みの正式 CLI `v0.4.3` に固定するもので、最新バージョンの指定ではありません。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.3
spine version
```

古い CLI に戻してもアプリのソース、`go.mod`、`go.sum` は戻りません。アプリはプロジェクトの Git 履歴から別途復元します。公開タグは移動や再利用をせず、修正した候補は新しい番号で公開します。

## 関連ドキュメント {#related}

- [最初のアプリ](/ja/learn/getting-started/first-app)
- [Spine リリース運用手順](https://github.com/NARUBROWN/spine/blob/preview/RELEASING.md)
- [CLI リリース運用手順](https://github.com/NARUBROWN/spine-cli/blob/preview/release/README.md)
