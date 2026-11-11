# query.Values compatibility API

::: info 0.7.5
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Deprecated reference for maintaining existing apps. New code uses input.Query[T].

## Compatibility behavior {#compatibility}

| Method | Behavior |
| --- | --- |
| Get / String | First value, or empty string |
| Int(key, def) | def for both missing and invalid values |
| GetBoolByKey(key, def) | Legacy true/false, yes/no, on/off forms; def on failure |
| Has | true when the key exists, including empty values |

Values and Pagination remain compatible only as value arguments. Do not mix them with new Path/Query/Header inputs in one handler. New DTOs reject invalid numbers with 400 rather than substituting defaults. Use pointer fields to distinguish absence.

[Current query inputs](/en/learn/core-concepts/query-values) | [DTO definitions](/en/learn/tutorial/2-controller#dto-validation)
