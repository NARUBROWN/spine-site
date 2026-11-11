# HTTP 错误

::: info 0.7.5 API
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

处理器和拦截器通过公开 httperr 契约指定状态与公开消息，内部详情以普通错误返回。

## 公开辅助函数

```go
func BadRequest(msg string) error
func Unauthorized(msg string) error
func NotFound(msg string) error
func InternalServerError(msg string) error
```

分别对应 400、401、404、500。其他错误可使用 &httperr.HTTPError{Status: 409, Message: "conflict"}。仅 400–599 有效，将 200 或 302 作为错误会得到隐藏详情的 500。成功状态使用 httpx.Response.Options，重定向使用 httpx.Redirect。

## 普通错误与包装

普通错误返回 500，不暴露 err.Error()。HTTPError 通过 errors.As 查找，支持 fmt.Errorf 的 %w 包装。显式消息会公开，不应直接填入数据库原始错误。解析和已注册验证器失败在处理器前返回 400。

## 拦截器优先级

PreHandle 在绑定前执行，因此即使正文错误，认证失败也优先返回 401。后续 BeforeResponse 的错误优先于处理器错误决定 HTTP 响应；多个失败时使用最后一个，AfterCompletion 仍保留先前错误。完成钩子在写入尝试后运行，不能修改状态或执行提交。

## 示例

[Errors and validation](/zh-Hans/learn/tutorial/7-error-handling) / [拦截器](/zh-Hans/learn/tutorial/4-interceptor) / [事务](/zh-Hans/learn/tutorial/6-transaction)
