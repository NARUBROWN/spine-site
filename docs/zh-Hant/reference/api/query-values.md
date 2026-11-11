# query.Values 相容 API

::: info 0.7.5
本文以 0.7.5 API 為準。已發布標籤與相容平台請查看[版本列表](/zh-Hant/community/versions)。
:::

用於維護舊應用的棄用 API 參考。新程式碼使用 input.Query[T]。

## 相容行為 {#compatibility}

| 方法 | 行為 |
| --- | --- |
| Get / String | 第一個值，不存在時為空字串 |
| Int(key, def) | 缺失或轉換失敗均回傳 def |
| GetBoolByKey(key, def) | 舊 true/false、yes/no、on/off 格式，失敗時回傳 def |
| Has | 鍵存在即為 true，包括空值 |

Values 與 Pagination 僅相容值參數，不能與新 Path/Query/Header 輸入在同一處理器中混用。新 DTO 對無效數字回傳 400，不會替換為預設值。使用指標欄位區分缺失。

[目前的查詢輸入](/zh-Hant/learn/core-concepts/query-values) | [DTO 定義](/zh-Hant/learn/tutorial/2-controller#dto-validation)
