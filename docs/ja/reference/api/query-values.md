# query.Values 互換 API

::: info 0.7.5
0.7.5 API を対象とする文書です。公開タグと対応プラットフォームは[バージョン一覧](/ja/community/versions)で確認してください。
:::

既存アプリ保守用の非推奨リファレンスです。新規コードには input.Query[T] を使います。

## 互換動作 {#compatibility}

| メソッド | 動作 |
| --- | --- |
| Get / String | 最初の値、なければ空文字列 |
| Int(key, def) | 欠落と変換失敗の両方で def |
| GetBoolByKey(key, def) | 従来の true/false、yes/no、on/off。失敗時は def |
| Has | 空の値でもキーが存在すれば true |

Values と Pagination は値引数でのみ互換対応します。同一ハンドラーで新しい Path/Query/Header と混在させません。新 DTO は不正な数値を既定値にせず 400 で拒否します。欠落の判定にはポインターフィールドを使います。

[現在のクエリ入力](/ja/learn/core-concepts/query-values) | [DTO 定義](/ja/learn/tutorial/2-controller#dto-validation)
