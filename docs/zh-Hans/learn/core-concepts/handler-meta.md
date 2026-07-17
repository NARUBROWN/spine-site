# HandlerMeta

## 概览

`HandlerMeta` 是路由处理器的已验证元数据。它保存控制器类型、方法、路由拦截器及参数信息，供 Router、Pipeline 和拦截器共同使用。

```go
type HandlerMeta struct {
    ControllerType reflect.Type
    Method         reflect.Method
    Interceptors   []core.Interceptor
}
```

## 创建方式

使用方法表达式注册路由：

```go
app.Route("GET", "/users/:id", (*UserController).Get,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

启动时，Spine 会验证函数是否为方法表达式、接收者是否为指针，并提取方法名和控制器类型。配置错误会在启动阶段暴露，而非首次请求时。

## 在 Router 与 Pipeline 中的用途

Router 匹配路径后返回 `HandlerMeta`。Pipeline 依据其方法签名创建参数元数据、解析控制器依赖并按顺序执行全局和路由拦截器，最后调用该方法。

## 设计原则

- 仅允许方法表达式，路由与实际处理器的关联明确。
- 强制指针接收者，确保控制器实例可从容器解析。
- 在启动时验证，避免运行时反射错误。

## 总结

`HandlerMeta` 将一次路由声明转化为可验证、可复用的执行计划。
