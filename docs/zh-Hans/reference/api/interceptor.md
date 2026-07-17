# core.Interceptor

## 概览

拦截器在控制器调用前后插入横切逻辑，如认证、日志、计时和事务。

```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```

## 生命周期

- `PreHandle`：调用控制器前执行；返回错误即可中止管道。
- `PostHandle`：控制器与返回值处理成功后执行。
- `AfterCompletion`：无论成功、失败或中止均执行，适合资源清理。

## 全局与路由拦截器

```go
app.Interceptor(&LoggingInterceptor{})
app.Route("GET", "/me", (*UserController).Me,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

全局拦截器覆盖所有路由，路由拦截器仅覆盖指定路由。前置阶段按注册顺序运行，后置阶段反向运行。

## 示例

```go
type TimingInterceptor struct{}
func (TimingInterceptor) PreHandle(ctx core.ExecutionContext, _ core.HandlerMeta) error {
    ctx.Set("startedAt", time.Now()); return nil
}
func (TimingInterceptor) PostHandle(core.ExecutionContext, core.HandlerMeta) {}
func (TimingInterceptor) AfterCompletion(ctx core.ExecutionContext, _ core.HandlerMeta, _ error) {
    log.Println(time.Since(ctx.Get("startedAt")))
}
```
