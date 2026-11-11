# Handler metadata

::: info 0.7.5
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

`core.HandlerMeta` is a copy of handler information. It cannot change execution registration or the writer.

## Fields {#fields}

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

## Queries {#methods}

`FunctionType()` returns the function type. `ArgumentOffset()` is 0 for callbacks and 1 for legacy method expressions. For callbacks, `HandlerName()` names the controller’s RegisterRoutes method rather than a unique callback. PathKeys contains key names, not values. Use public queries and InterceptorTypes instead of the removed Method, Callback, and Interceptors fields.

## Timing and lifetime {#lifetime}

Global PreHandle receives empty metadata before routing. Route PreHandle receives selected metadata and runs before binding. Editing fields or slices does not change registration. Read request information through Ctx’s public views.

[Public context](/en/reference/api/execution-context) | [Interceptors](/en/learn/tutorial/4-interceptor)
