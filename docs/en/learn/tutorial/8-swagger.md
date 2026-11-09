# Swagger and OpenAPI

Spine `v0.7.1` can generate OpenAPI JSON from registered HTTP routes and serve embedded Swagger UI and ReDoc. This tutorial runs the documentation in a standalone app and then exports a static document with the CLI.

## 1. Prepare the application

Install these dependencies in a separate Go module. The Echo RC is the combination tested for this example. For deployment, pin a published compatible platform tag together with `go.mod` and `go.sum`.

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0-rc.1
```

Save the following as `main.go` and run `go run .`. Automatic serving is disabled unless `Enabled` is set. Omit `UI` to serve JSON only.

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

## 2. Check over HTTP

Request the document and UIs from another terminal. All three return 200. You can also open `/docs` or `/redoc` in a browser.

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

The document and UIs do not run business interceptors. If access must be restricted, apply a policy in HTTP middleware or a proxy.

## 3. Export a static document with the CLI

Run these commands in the root of the app created in [Project Structure](/en/learn/tutorial/1-project-structure). The command analyzes source without running the app. Review an existing file before replacing it with `--force`.

```bash
spine doctor
spine contract check
spine contract export --format openapi --output openapi.json
```

Check `/health` and `/user/{id}` in the generated document. Static analysis cannot establish every dynamic route, runtime validator constraint, or response status selected by a handler. Review diagnostics and verify actual requests and the runtime document.

## Next steps

See the [runtime OpenAPI reference](/en/reference/api/openapi) for path conflicts, validators, document inspection, and UI options. The [input migration guide](/en/learn/migration/v0.7.1-preview) explains compatibility with older input APIs.
