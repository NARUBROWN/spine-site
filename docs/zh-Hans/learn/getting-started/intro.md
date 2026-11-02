# 简介

Spine 是一个通过 Go 代码注册构造函数、路由和拦截器的 Web 框架。通过注册代码，可以了解由哪个处理器接收请求，以及在处理器调用前后执行哪些操作。

本页按功能划分的 `src/user` 示例使用[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中通过 `--layout legacy` 创建的 `my-app`。CLI `v0.4.0` 默认生成按角色划分的 `layered-v1` 结构。两种布局都使用 Spine `v0.6.0` 和 Echo 平台 `v0.1.0`。

如果是第一次使用，请先按照[第一个应用](/zh-Hans/learn/getting-started/first-app)通过 CLI 创建项目，并确认 `GET /health` 的响应。本文介绍构建应用时使用的核心概念。

## 应用配置与运行

在 CLI 生成的项目中，应用配置代码集中在 `internal/application/application.go` 的 `BuildApplication()` 中。`main.go` 按照 `BuildApplication` → `Validate` → `Run` 的顺序构建、验证并运行应用。

下面展示手动实现用户功能时的注册示例。代码省略了 `UserController` 和拦截器的实现，请勿用此示例覆盖生成的文件。

```go
func BuildApplication() (spine.App, boot.Options, error) {
    app := platform.New()

    // 생성자를 등록하면 등록 순서와 관계없이 의존성을 해결합니다.
    app.Constructor(NewUserRepository, NewUserService, NewUserController)

    // 인터셉터를 실행할 순서대로 등록합니다.
    app.InterceptorFor(boot.InterceptorHTTP, &TxInterceptor{}, &LoggingInterceptor{})

    // HTTP 메서드와 경로에 핸들러를 연결합니다.
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
// 생성자 파라미터가 곧 의존성 선언
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

// 등록만 하면 자동으로 의존성 그래프 해결
app.Constructor(NewUserRepository, NewUserService, NewUserController)
```

### 2. 拦截器流水线

拦截器在控制器调用前后执行认证、事务、日志记录等公共操作。下面的示例展示了三个自行实现的拦截器的注册顺序。

```go
app.Interceptor(
    &TxInterceptor{},      // 1. 트랜잭션 시작
    &AuthInterceptor{},    // 2. 인증 확인
    &LoggingInterceptor{}, // 3. 로깅
)

```

`PreHandle` 按注册顺序执行。控制器返回后的 `PostHandle`、响应处理前的 `BeforeResponse` 和响应处理后的 `AfterCompletion` 按相反顺序执行。发生错误时的调用条件请参阅[拦截器](/zh-Hans/learn/tutorial/4-interceptor)。

### 3. 显式路由

使用 `app.Route` 将 HTTP 方法、路径和处理器关联起来。为每项功能设置注册函数，可以集中管理相关路由。

```go
// 한 곳에서 모든 라우트를 관리
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
// 함수 시그니처가 곧 API 스펙
func (c *UserController) GetUser(
    ctx context.Context,      // 컨텍스트
    q query.Values,           // 쿼리 파라미터
) (httpx.Response[UserResponse], error) {     // 응답 타입
    user, err := c.svc.Get(ctx, q.Int("id", 0))
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}

// DTO는 자동으로 바인딩
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,    // JSON body → 구조체 (포인터)
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
