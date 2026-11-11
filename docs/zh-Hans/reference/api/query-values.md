# query.Values 兼容 API

::: info 0.7.5
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

用于维护旧应用的弃用 API 参考。新代码使用 input.Query[T]。

## 兼容行为 {#compatibility}

| 方法 | 行为 |
| --- | --- |
| Get / String | 第一个值，不存在时为空字符串 |
| Int(key, def) | 缺失或转换失败均返回 def |
| GetBoolByKey(key, def) | 旧 true/false、yes/no、on/off 格式，失败时返回 def |
| Has | 键存在即为 true，包括空值 |

Values 与 Pagination 仅兼容值参数，不能与新 Path/Query/Header 输入在同一处理器中混用。新 DTO 对无效数字返回 400，不会替换为默认值。使用指针字段区分缺失。

[当前查询输入](/zh-Hans/learn/core-concepts/query-values) | [DTO 定义](/zh-Hans/learn/tutorial/2-controller#dto-validation)
