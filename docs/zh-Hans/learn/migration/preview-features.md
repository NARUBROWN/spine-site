# v0.7.0 Preview 功能与启动选项

::: warning Preview
以下可执行示例需要 Spine `v0.7.0-preview.7` 或更高版本。 [Preview](/zh-Hans/learn/migration/preview-controller-routes)
:::

通过启动选项启用 Swagger UI 和 ReDoc，并了解迁移到 HTTP v3 与 net/http 平台所需的修改。本页还整理了已合并到 Preview 的路径处理、关闭处理与事件清理历史变更。

::: warning 仅适用于 Preview
本页以 `preview` 分支为准，不能直接应用于稳定版 `v0.6.5`。请区分功能首次发布版本与当前分支变更。`@preview` 会移动，请一起保存应用源码、`go.mod` 与 `go.sum`。
:::

## 版本与安装 {#versions}

| 功能 | 首次发布版本 |
| --- | --- |
| 按来源划分的输入 DTO 与 OpenAPI JSON | Spine `v0.7.0-preview.1` |
| 内嵌 Swagger UI 与 ReDoc | Spine `v0.7.0-preview.2` |
| HTTP v3、TLS 与 net/http 平台 | Spine `v0.7.0-preview.3`, Echo `v0.2.0-preview.2`, net/http `v0.1.0-preview.1` |
| HTTP v3 分析及 net/http 应用生成与更新 | CLI `v0.4.3-preview.4` |
| 控制器路由、角色构造器与 API 分组 | Spine `v0.7.0-preview.7`, CLI `v0.4.3-preview.8` |

需要 Go 1.25.5 或更高版本。选择 playground 验证器时需要 Go 1.26 或更高版本。也可通过 `--platform nethttp` 选择 net/http。使用默认 Go 代理设置时，Preview 分支元数据从源仓库查询，因此需要 Git。安装 CLI 与更新应用依赖是两个操作。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
spine new preview-api --module example.com/preview-api --platform echo
cd preview-api
spine contract check
spine verify
```

现有应用按[输入迁移指南](/zh-Hans/learn/migration/v0.7.0-preview#versions)选择 `recipe = "platform-contracts-preview"`。检查 `spine update --dry-run` 的变更后，运行输出中提供的应用命令。`update` 不改写应用源码，下面的启动选项与 Prepared API 需要手动修改。

## Swagger UI 与 ReDoc 启动选项 {#boot}

::: warning 当前 net/http 文档 UI 限制
2026-11-06 验证：核心 `83b1e03` 与 net/http `v0.1.0-preview.2` 组合将文档与资源的 Content-Type 覆盖为 `text/plain`，导致 Swagger UI 与 ReDoc 无法正常渲染。下面的 UI 运行示例使用 Echo `v0.2.0-preview.3`。
:::

下面是独立参考应用的 `main.go`。请先用上述 CLI 准备依赖，再在单独目录中运行。现有应用应在当前 composition 与 `BuildApplication` 中加入 import 和 `HTTP.OpenAPI` 配置。

```go
package main

import (
    "log"

    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }

func (c *Controller) RegisterRoutes(r *api.Registry) {
    r.GET("/hello", func() httpx.Response[string] {
        return httpx.Response[string]{Body: "hello"}
    })
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(constructor.Controller(&Controller{}))
    options := boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        HTTP: &boot.HTTPOptions{
            MaxBodyBytes:         32 << 20,
            MultipartMemoryBytes: 8 << 20,
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Path:    "/openapi.json",
                Title:   "Preview API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{Path: "/docs"}),
                    redoc.New(redoc.Options{Path: "/redoc"}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

`Enabled` 默认为 `false`。只设置 `Enabled: true` 时提供 `/openapi.json`，仅添加 `UI` 中注册的界面。Swagger UI 默认路径为 `/docs`，ReDoc 为 `/redoc`。各 UI 可设置 `Path` 与 `Title`。界面与资源内嵌于二进制文件，无需 CDN 或 npm。

规范、UI 与资源路径独立于 `GlobalPrefix`，支持 GET 与 HEAD。它们不执行业务拦截器，需要限制访问时应在 HTTP 服务器中间件或代理中配置。此示例没有注册验证器，因此规范以路径与方法信息为主。DTO 详细规范需要支持 `SchemaDescriber` 的验证器。动态响应状态保留在 `default` 下。请参阅[完整 OpenAPI 选项](/zh-Hans/reference/api/openapi#options)。

## 托管服务器的 TLS {#tls}

向 `boot.HTTPOptions.TLS` 传入 `*tls.Config` 即可通过 HTTPS 运行托管服务器。以下函数需要 `spine`、`boot` 与标准库 `crypto/tls` import。

```go
func runTLS(app spine.App) error {
    certificate, err := tls.LoadX509KeyPair("server.crt", "server.key")
    if err != nil {
        return err
    }
    return app.Run(boot.Options{
        Address: ":8443",
        HTTP: &boot.HTTPOptions{
            TLS: &tls.Config{Certificates: []tls.Certificate{certificate}},
        },
    })
}
```

`TLS: nil` 使用明文 HTTP。准备阶段检查证书与能力并复制配置。`Serve(listener)` 使用准备好的 TLS 设置，可通过 `Serve(listener, httpcontract.WithTLS(config))` 覆盖。`httpcontract` 的 import 路径为 `github.com/NARUBROWN/spine/contract/http`。最后一个选项优先，`WithTLS(nil)` 返回错误。仅向外部 `http.Server` 连接 handler 时，TLS 运行与服务器关闭由外部所有者管理。本次变更没有增加 HTTP 版本选择或 ALPN 策略。

## HTTP v3 输入与文件生命周期 {#body}

HTTP v3 由核心使用公共实现解析 JSON、XML、urlencoded form 与 multipart。路径与查询值不会合并到正文 DTO。需要的 DTO 在认证拦截器之后解析，每个绑定成功的 DTO 分别验证。

`MaxBodyBytes: 0` 表示正文总上限 32 MiB，正值指定字节上限，负值取消限制。`MultipartMemoryBytes: 0` 表示文件内存预算 32 MiB，正值指定预算，负值导致准备失败。multipart 预算不是整个请求的内存上限，超出预算的文件写入磁盘。

表单 DTO 与上传文件共享同一 multipart 结果。文件在所有 `AfterCompletion` 结束前有效，之后删除临时文件。请求结束后仍需使用的文件应在完成钩子结束前另行保存。Spine DTO 输入不调用 Echo Binder、JSONSerializer 或 `UnmarshalParam` 扩展。请迁移到标准 JSON、XML 或 Text 解码器，或在 native Echo 路由使用扩展。Echo 响应输出扩展保持可用。

## 外部服务器与自定义 HTTP 适配器迁移 {#prepared}

将 `PreparedApplication.Handler()` 改为返回 `(http.Handler, error)` 的 `spine.NetHTTPHandler(prepared)`。`prepared.HTTPAdapter()` 返回同一已准备适配器，HTTP 关闭时返回 nil。不要重复调用适配器的运行与关闭。调用方负责外部服务器关闭与 `prepared.Close(ctx)`。Close 阻止新请求进入，并清理 WebSocket 与包含 native 中间件后处理的请求。等待 context 超时后清理仍会继续。

自定义 HTTP 平台必须迁移到 `spine.http-adapter/v3`，实现 `Serve(net.Listener, ...httpcontract.ServeOption) error` 并声明 TLS capability。`adapter` 与 `adapter/http` 别名不会自动转换 v2 实现。net/http 是独立模块，不支持 `DisableRecover: true`。请参阅[完整 HTTP v3 迁移指南](https://github.com/NARUBROWN/spine/blob/preview/docs/migration/http-v3.md)。

## 本次合并的其他变更 {#merged}

上述其他变更以[核心 PR #34](https://github.com/NARUBROWN/spine/pull/34)合并源码为准。该源码的下一候选版本是 `v0.7.0-preview.5`，候选编号不代表标签已发布或完整发布流程已完成。

- 路径值：`/users/:id` 与 `/users/:userID/posts` 使用各自路由的键绑定。`/files/:name` 中的 `a%2Fb` 只解码一次为 `a/b`，`a%252Fb` 为 `a%2Fb`。实际路径 `/files/a/b` 不匹配该路由。
- 关闭：WebSocket 清理发生 panic 后仍继续清理后续应用资源，并且不会把实际 HTTP Serve 错误隐藏为正常关闭。
- 事件：向 `spine.WithEventPublisherErrorHistory` 与 `spine.WithEventConsumerErrorHistory` 传入 `boot.CleanupErrorHistoryOptions{MaxEntries, MaxAge}`，分别设置各角色的清理失败历史。默认保留最近 32 条、最长 1 小时，先达到的限制生效。0 使用默认值，负值导致预检失败。不改变日志保留策略和已返回的关闭结果。CLI 对新 helper 的静态分析支持仍是后续工作。
- nil 事件正文：raw byte handler 区分 nil tombstone 与长度为 0 的 nonnil slice。需要正文的 DTO handler 保持原有失败策略。
- Swagger UI：修复 base64url、指数表示的 multipleOf 与没有 items 的 contains 示例生成问题。
- 发布组合：验证包括 net/http 在内的六个平台。仅发布核心标签或通过源码 CI，不代表公开组合验证已完成。

## 通过请求验证 {#verify}

通过 `go run main.go` 运行独立参考应用。`/hello` 应返回 HTTP 200，规范与两个 UI 的 HEAD 请求也应返回 200。在浏览器打开 `/docs` 与 `/redoc` 检查渲染。CLI 生成应用执行配置的入口；将相同选项加入 `BuildApplication` 后可使用 `spine run`。

```bash
curl -i http://localhost:8080/hello
curl -I http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

## 相关文档与合并依据 {#sources}

- [OpenAPI](/zh-Hans/reference/api/openapi)
- [v0.7.0](/zh-Hans/learn/migration/v0.7.0-preview)
- [Preview → RC → Production](/zh-Hans/community/release-channels)
- [Spine #26: OpenAPI UI](https://github.com/NARUBROWN/spine/pull/26)
- [Spine #32: HTTP v3 / TLS](https://github.com/NARUBROWN/spine/pull/32)
- [Spine #33: Preview](https://github.com/NARUBROWN/spine/pull/33)
- [Spine #34: Preview](https://github.com/NARUBROWN/spine/pull/34)
- [Spine CLI #39: HTTP v3 / net/http](https://github.com/NARUBROWN/spine-cli/pull/39)
