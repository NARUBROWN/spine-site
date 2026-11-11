# 处理器元数据

::: info 0.7.5
本文以 0.7.5 API 为准。已发布标签和兼容平台请查看[版本列表](/zh-Hans/community/versions)。
:::

`core.HandlerMeta` 是处理器信息的副本，不能修改执行注册或 writer。

## 字段 {#fields}

```go
type HandlerMeta struct {
	ControllerType   reflect.Type
	MethodName       string
	Signature        reflect.Type
	PathKeys         []string
	InterceptorTypes []reflect.Type
	CallbackRoute    bool
}
```

## 查询 {#methods}

`FunctionType()` 返回函数类型。`ArgumentOffset()` 对回调为 0，对旧方法表达式为 1。回调的 `HandlerName()` 返回控制器的 RegisterRoutes 名称，并非每个回调的唯一标识。PathKeys 包含键名而非值。使用公开查询与 InterceptorTypes 替代已移除的 Method、Callback、Interceptors 字段。

## 时机与生命周期 {#lifetime}

全局 PreHandle 在路由前接收空元数据。路由 PreHandle 接收已选择的元数据，在绑定前执行。修改字段或切片不会改变注册。通过 Ctx 的公开视图读取请求信息。

[公开上下文](/zh-Hans/reference/api/execution-context) | [拦截器](/zh-Hans/learn/tutorial/4-interceptor)
