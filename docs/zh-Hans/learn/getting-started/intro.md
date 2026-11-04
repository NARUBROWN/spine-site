# 简介

::: warning v0.7.0 Preview 输入 API 迁移
本页现有 API 说明和示例以稳定版 `v0.6.5` 为基准。从 `v0.7.0-preview.1` 起，可按输入来源使用独立的 Path、Query 和 Header DTO。`query.Values`、`header.Values` 及其构造和读取 API、`query.Pagination`、`path.Int`、`path.String`、`path.Boolean` 均标记为 Deprecated。

新的 DTO 方式不能直接用于 `v0.6.5`。在 Preview 中，同一处理器混用新 DTO 和 Deprecated 输入也会在启动时被拒绝。现有请求体 DTO 和上下文仍可与任一方式一起使用。

适用版本和迁移示例见 [Preview 处理器输入迁移](/zh-Hans/learn/migration/v0.7.0-preview)，规范选项见 [运行时 OpenAPI](/zh-Hans/reference/api/openapi)。
:::

Spine 是一个通过 Go 代码注册构造函数、路由和拦截器的 Web 框架。通过注册代码，可以了解由哪个处理器接收请求，以及在处理器调用前后执行哪些操作。

本页按功能划分的 `src/user` 示例使用[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中通过 `--layout legacy` 创建的 `my-app`。CLI `v0.4.2` 默认生成按角色划分的 `layered-v1` 结构。两种布局都使用 Spine `v0.6.5` 和 Echo 平台 `v0.1.0`。

如果是第一次使用，请先按照[第一个应用](/zh-Hans/learn/getting-started/first-app)通过 CLI 创建项目，并确认 `GET /health` 的响应。本文介绍构建应用时使用的核心概念。

## 应用配置与运行

在 CLI 生成的项目中，应用配置代码集中在 `internal/application/application.go` 的 `BuildApplication()` 中。`main.go` 按照 `BuildApplication` → `Validate` → `Run` 的顺序构建、验证并运行应用。

下面展示手动实现用户功能时的注册示例。代码省略了 `UserController` 和拦截器的实现，请勿用此示例覆盖生成的文件。

```go
func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New(echoplatform.Option())

    // 注册构造函数后，无论注册顺序如何，都会解析依赖。
    app.Constructor(NewUserRepository, NewUserService, NewUserController)

    // 按执行顺序注册拦截器。
    app.InterceptorFor(boot.InterceptorHTTP, &TxInterceptor{}, &LoggingInterceptor{})

    // 将处理器关联到 HTTP 方法与路径。
    app.Route("GET", "/users", (*UserController).GetUser)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```


CLI 命令 `spine generate resource user` 生成的代码，其名称和路径与上例不同。生成的处理器是 `src/user` 中的 `UserController.Get`，路径为 `GET /user/:id`。如果构造函数已注册，请勿重复注册相同的构造函数或路由。还应保留添加到 `BuildApplication` 中的 `user.Register(app)` 调用及其错误处理。详细步骤请参阅[项目结构](/zh-Hans/learn/tutorial/1-project-structure)。

## 核心概念

### 1. 基于构造函数的依赖注入

通过构造函数参数声明所需的依赖，并将构造函数注册到 `app.Constructor`。在下面的示例中，`UserService` 接收 `UserRepository`。

```go
// 构造函数参数即依赖声明
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

// 注册后自动解析依赖图
app.Constructor(NewUserRepository, NewUserService, NewUserController)
```

### 2. 拦截器流水线

拦截器在控制器调用前后执行认证、事务、日志记录等公共操作。下面的示例展示了三个自行实现的拦截器的注册顺序。

```go
app.Interceptor(
    &TxInterceptor{},      // 1. 开始事务
    &AuthInterceptor{},    // 2. 检查身份验证
    &LoggingInterceptor{}, // 3. 记录日志
)

```

`PreHandle` 按注册顺序执行。控制器返回后的 `PostHandle`、响应处理前的 `BeforeResponse` 和响应处理后的 `AfterCompletion` 按相反顺序执行。发生错误时的调用条件请参阅[拦截器](/zh-Hans/learn/tutorial/4-interceptor)。

### 3. 显式路由

使用 `app.Route` 将 HTTP 方法、路径和处理器关联起来。为每项功能设置注册函数，可以集中管理相关路由。

```go
// 在同一处管理所有路由
func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
    app.Route("PUT", "/users", (*UserController).UpdateUser)
    app.Route("DELETE", "/users", (*UserController).DeleteUser)
}
```

### 4. 类型安全的处理器

通过处理器的参数和返回类型，表达要从请求中读取的值以及响应的结构。下面示例中的查询处理器读取查询参数，创建处理器则通过结构体指针接收 JSON 请求体。服务以及请求和响应类型需要自行实现。

```go
// 函数签名即 API 规范
func (c *UserController) GetUser(
    ctx context.Context,      // 上下文
    q query.Values,           // 查询参数
) (httpx.Response[UserResponse], error) {     // 响应类型
    user, err := c.svc.Get(ctx, q.Int("id", 0))
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}

// 自动绑定 DTO
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,    // JSON body → 结构体（指针）
) (httpx.Response[UserResponse], error) {
    user, err := c.svc.Create(ctx, req)
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}
```

## 开始使用

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

安装 CLI 后，请按照[第一个应用](/zh-Hans/learn/getting-started/first-app)创建项目并确认 HTTP 响应。如果找不到命令，请参阅[安装指南](/zh-Hans/learn/getting-started/installation)中的路径设置。
