# 运行时 OpenAPI

从 Spine `v0.7.0-preview.1` 起，可以根据实际注册的 HTTP 路由、处理器类型与 validator 描述契约生成 OpenAPI 3.1.2 JSON。

::: warning 从 v0.7.0-preview.1 起提供的 Preview API
此 API 不包含在稳定版 `v0.6.5` 中。HTTP 请使用 Echo `v0.2.0-preview.1`；如果使用 playground 进行验证与详细输入规范描述，也请选择 `v0.2.0-preview.1`。输入参数请先参阅 [Preview 处理器输入迁移](/zh-Hans/learn/migration/v0.7.0-preview)。
:::

## 启用与启动选项 {#options}

自动生成与 HTTP 提供默认关闭。在现有应用的 `boot.Options` 中按以下方式显式启用。`boot` 的 import 路径为 `github.com/NARUBROWN/spine/pkg/boot`。

```go
options := boot.Options{
    Address: ":8080",
    HTTP: &boot.HTTPOptions{
        GlobalPrefix: "/api",
        OpenAPI: boot.OpenAPIOptions{
            Enabled: true,
            Path: "/openapi.json",
            Title: "User API",
            Version: "1.0.0",
        },
    },
}
```

| 字段 | 默认值 | 行为 |
| --- | --- | --- |
| `Enabled` | `false` | 为 `true` 时，在准备阶段自动生成并通过 HTTP 提供 |
| `Path` | `/openapi.json` | 通过 GET 与 HEAD 提供的静态绝对路径 |
| `Title` | `Spine API` | OpenAPI `info.title` |
| `Version` | `unversioned` | 应用的 `info.version`，与框架版本无关 |

`HTTP: nil` 会同时关闭 HTTP 与规范资源。仅设置 `Path`、`Title` 或 `Version` 不会启用该功能。要关闭它，请设置 `Enabled: false` 或省略 OpenAPI 选项。请使用已公开 Preview 中的 `Enabled`，而非未发布开发源码中使用的 `Disabled`。

规范路径独立于 `GlobalPrefix`。上述选项会为业务 API 应用 `/api`，但规范仍通过 `/openapi.json` 提供。完成准备的应用会复用规范快照，不会自动保存文件。

## 规范查询与冲突 {#http}

启用后的资源可以公开查询，并经过 HTTP 服务器中间件。文档查询不会执行业务控制器、DTO 绑定、validator 验证或 Spine 业务拦截器。

如果应用的 GET、HEAD 或 WebSocket 路由匹配规范路径，启动时会出现 `OPENAPI_PATH_CONFLICT`。`/:id` 等动态路径也可能冲突。请将 `Path` 改为不重叠的静态路径，或关闭规范。未启用时不会保留此路径。直接向平台注册的 native 路由不在核心的冲突检查范围内。

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/openapi.json
```

## 不运行应用即可描述或导出 {#export}

以下函数接收已配置的应用、HTTP 选项与输出目标，不会替换现有的 `spine.App` 接口。

```go
func ExportOpenAPI(app spine.App, options boot.Options, output io.Writer) error {
    if options.HTTP == nil {
        return errors.New("HTTP options are required")
    }
    description, err := spine.DescribeHTTP(app, options)
    if err != nil {
        return err
    }
    document, err := openapi.Generate(description, options.HTTP.OpenAPI)
    if err != nil {
        return err
    }
    _, err = output.Write(document)
    return err
}
```

此函数需要导入标准库 `errors`、`io`，以及 `github.com/NARUBROWN/spine`、`github.com/NARUBROWN/spine/pkg/boot` 与 `github.com/NARUBROWN/spine/pkg/openapi`。`DescribeHTTP` 不会执行构造函数、factory、处理器或验证规则，但可能调用已注册 `SchemaDescriber` 的描述方法。如果需要输出文件，由调用方提供 `io.Writer`。

即使关闭自动 HTTP 提供，也可以显式使用 `DescribeHTTP` 与 `openapi.Generate`。不支持描述功能的自定义 App 会返回 `ErrHTTPDescriptionUnavailable`。

## validator 与描述范围 {#validation}

| 注册状态 | 生成的信息 |
| --- | --- |
| 未注册 validator | 以路径与 HTTP 方法为主的信息，以及 `VALIDATOR_NOT_CONFIGURED` 诊断 |
| 已注册 validator，但不支持 `SchemaDescriber` | 保留请求验证，省略 DTO 详细输入，并在描述 DTO 时提供 `INPUT_SCHEMA_DESCRIPTION_UNAVAILABLE` 诊断 |
| 已注册支持描述契约的 validator | 按来源划分的 DTO 与可描述的验证约束 |

未配置 validator 时，不会推断输入参数、请求与响应模型或错误状态码。仍会保留 OpenAPI 格式所需的最小响应占位，以及未指定类型的路径变量占位。

即使 validator 不支持 `SchemaDescriber`，仍可描述原有 path 包装类型，以及 `query.Pagination` 的 page、size 和默认值。DTO 详细输入描述才需要 `SchemaDescriber`。

输入是否必填遵循 validator 契约。不会仅根据指针或 `json:",omitempty"` 决定 required。路径段始终必填，路径指针也不代表 optional 或 nullable 输入。

对于不支持的自定义规则与动态值，会通过 `x-spine-diagnostics` 记录限制。不会猜测原有 `query.Values` 与 `header.Values` 在函数内部读取哪些键。`query.Pagination` 会描述已声明的 page 与 size，但与其他原有输入一样，仍标记为 Deprecated。

`httpx.Response[T]` 中的 T 描述响应正文类型。无法在不运行处理器的情况下确定其选择的状态码与错误分支，因此将其记录在 `default` 下。如果已注册 validator，且规范包含请求正文或输入参数，还会添加表示框架绑定与 DTO 验证失败的 `400` 响应。处理器内部设置的默认值也不会补入自动生成的规范。

## 集成 Swagger UI 与 ReDoc {#tools}

可以将生成的 JSON 连接到 Swagger UI 或 ReDoc。UI 需要在应用中单独配置。稳定版的 UI 配置示例请参阅 [Swagger 与 OpenAPI 教程](/zh-Hans/learn/tutorial/8-swagger)。

迁移输入模型时，请遵循 [Preview 处理器输入迁移](/zh-Hans/learn/migration/v0.7.0-preview)。稳定版 API 请参阅 [spine.App](/zh-Hans/reference/api/spine-app)。
