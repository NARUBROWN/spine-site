# Swagger 与 OpenAPI

Spine `v0.7.1` 可以根据已注册的 HTTP 路由生成 OpenAPI JSON，并提供内置 Swagger UI 和 ReDoc。本教程先在独立应用中运行文档与界面，再使用 CLI 导出静态文档。

## 1. 准备应用

在独立 Go 模块中安装以下正式版依赖。请保留 `go.mod` 和 `go.sum` 以便重现。

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

将以下代码保存为 `main.go` 并运行 `go run .`。省略 `Enabled` 时自动提供功能关闭；仅提供 JSON 时省略 `UI`。

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
        HTTP: &boot.HTTPOptions{
            OpenAPI: boot.OpenAPIOptions{
                Enabled: true,
                Title:   "Example API",
                Version: "1.0.0",
                UI: []boot.OpenAPIUI{
                    swaggerui.New(swaggerui.Options{}),
                    redoc.New(redoc.Options{}),
                },
            },
        },
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

## 2. 通过 HTTP 检查

在另一个终端请求文档和界面。三个资源都会返回 200，也可以在浏览器中打开 `/docs` 或 `/redoc`。

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

文档和界面不会运行业务拦截器。如果需要限制访问，请在 HTTP 中间件或代理中配置策略。

## 3. 使用 CLI 导出静态文档

在[项目结构](/zh-Hans/learn/tutorial/1-project-structure)中创建的应用根目录执行。该命令分析源代码而不运行应用。使用 `--force` 覆盖已有文件前，请先检查文件内容。

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

检查生成文档中的 `/health` 和 `/user/{id}`。静态分析无法确定所有动态路由、运行时 validator 约束或处理器选择的响应状态。请查看诊断，并验证实际请求和运行时文档。

## 下一步

路径冲突、validator、文档查询与 UI 选项请参阅[运行时 OpenAPI 参考](/zh-Hans/reference/api/openapi)。[输入迁移指南](/zh-Hans/learn/migration/v0.7.1-preview)说明旧输入 API 的兼容规则。
