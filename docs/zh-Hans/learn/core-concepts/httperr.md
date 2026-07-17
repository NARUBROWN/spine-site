# httperr 包

## 概览

`httperr` 让控制器以语义化错误表达 HTTP 失败，而无需直接操作响应写入器。

```go
if user == nil {
    return httperr.NotFound("未找到用户")
}
```

## 为什么使用 httperr？

控制器关注业务结果，不必了解响应编码细节。`httperr` 将状态码、消息和可选原因封装为错误类型，`ErrorReturnHandler` 再将它转换为一致的 HTTP 响应。

## 常用帮助函数

- `httperr.BadRequest(message)`：400，请求无效。
- `httperr.Unauthorized(message)`：401，尚未认证。
- `httperr.NotFound(message)`：404，资源不存在。

## 使用示例

```go
if err := validate(req); err != nil {
    return httperr.BadRequest("请求参数无效")
}
if !authorized(user) {
    return httperr.Unauthorized("需要登录")
}
```

## 错误流

返回值处理阶段优先识别 `HTTPError`；普通 `error` 则进入通用错误处理。管道的最终安全网负责处理执行过程中产生的错误，并避免重复写入响应。

## 扩展

可以创建新的语义状态码帮助函数，或为错误附带原因。保持错误作为返回值，能够让业务逻辑、测试和管道处理保持简单。
