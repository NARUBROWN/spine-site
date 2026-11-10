# v0.7.1 HTTP and boot options

This guide covers OpenAPI UI, HTTP v3 input handling, TLS, and shutdown in Spine `v0.7.1`. When migrating an existing application, review the platform and application code together.

## Versions for the example {#versions}

This standalone example uses stable core `v0.7.1` and Echo `v0.2.0`. Go 1.25.5 or later is required. Create a module in a new directory, install the dependencies, and save the code below as `main.go`. Retain `go.mod` and `go.sum`.

```bash
go mod init example.com/boot-example
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

## Swagger UI and ReDoc boot options {#boot}

The following is a standalone `main.go`. In an existing application, add the imports and `HTTP.OpenAPI` settings to your current composition.

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
                Title:   "Example API",
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

`Enabled` defaults to `false`. Setting only `Enabled: true` serves `/openapi.json`; only UIs registered in `UI` are added. Swagger UI defaults to `/docs` and ReDoc to `/redoc`. Each UI accepts `Path` and `Title`. Both UIs and their assets are embedded in the binary and served without a CDN or npm.

Document, UI, and asset paths are independent of `GlobalPrefix` and support GET and HEAD. They bypass business interceptors, so configure access controls in HTTP server middleware or a proxy when needed. This example has no validator and produces route/method-oriented metadata. Register a validator implementing `SchemaDescriber` for detailed DTO schemas. Dynamic response statuses remain under `default`. See the [full OpenAPI options](/en/reference/api/openapi#options).

## TLS for the managed server {#tls}

Pass a `*tls.Config` to `boot.HTTPOptions.TLS` to run the managed server with HTTPS. This function requires the `spine`, `boot`, and standard `crypto/tls` imports.

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

`TLS: nil` uses plain HTTP. Preparation checks certificates and capabilities and copies the configuration. `Serve(listener)` uses the prepared TLS settings; override them with `Serve(listener, httpcontract.WithTLS(config))`. The `httpcontract` import is `github.com/NARUBROWN/spine/contract/http`. The last option wins, and `WithTLS(nil)` is an error. When attaching only a handler to an external `http.Server`, its owner controls TLS and server shutdown. This change does not add HTTP version selection or an ALPN policy.

## HTTP v3 inputs and file lifetime {#body}

In HTTP v3, core parses JSON, XML, urlencoded forms, and multipart through a shared implementation. Path and query values are not merged into body DTOs. Parsing and per-DTO validation occur after global interceptor `PreHandle` methods and before route interceptor `PreHandle` methods.

`MaxBodyBytes: 0` means a 32 MiB total body limit; positive values set the byte limit and negative values disable it. `MultipartMemoryBytes: 0` means a 32 MiB file memory budget; positive values set that budget and negative values fail preparation. The multipart budget is not a total request memory limit; excess files spill to disk.

Form DTOs and uploaded files share one multipart result. Files remain valid through every `AfterCompletion`; temporary files are removed afterward. Save files elsewhere before completion hooks finish if they are needed after the request. Spine DTO input does not call Echo Binder, JSONSerializer, or `UnmarshalParam` extensions. Move decoding to standard JSON, XML, or Text decoders, or use native Echo routes. Echo response output extensions remain available.

## External servers and custom HTTP adapters {#prepared}

Replace `PreparedApplication.Handler()` with `spine.NetHTTPHandler(prepared)`, which returns `(http.Handler, error)`. `prepared.HTTPAdapter()` returns the same prepared adapter, or nil when HTTP is disabled. Do not duplicate adapter serve or shutdown calls. The caller owns external server shutdown and `prepared.Close(ctx)`. Close blocks new entry and cleans up WebSocket connections and requests, including native middleware post-processing. Cleanup continues after the waiting context expires.

Custom HTTP platforms must migrate to `spine.http-adapter/v3`, including `Serve(net.Listener, ...httpcontract.ServeOption) error` and TLS capabilities. The `adapter` and `adapter/http` aliases do not convert v2 implementations automatically. The net/http platform is an independent module and does not support `DisableRecover: true`. See the [complete HTTP v3 migration guide](https://github.com/NARUBROWN/spine/blob/v0.7.1/docs/migration/http-v3.md).

## Additional runtime behavior {#merged}

The following path, shutdown, and event behavior is present in `v0.7.1`.

- Path values: `/users/:id` and `/users/:userID/posts` bind using each route’s keys. For `/files/:name`, `a%2Fb` decodes once to `a/b`, and `a%252Fb` to `a%2Fb`. The actual path `/files/a/b` does not match that route.
- Shutdown: later app resources are cleaned up after a WebSocket cleanup panic, and actual HTTP Serve errors are not hidden as normal shutdown.
- Events: pass `boot.CleanupErrorHistoryOptions{MaxEntries, MaxAge}` to `spine.WithEventPublisherErrorHistory` and `spine.WithEventConsumerErrorHistory` to configure cleanup failure history per role. Defaults are the latest 32 entries and a maximum age of one hour, whichever limit is reached first. Zero uses defaults; negative values fail preflight. Log retention and already returned shutdown results do not change.
- Nil event bodies: raw byte handlers distinguish nil tombstones from nonnil slices of length zero. DTO handlers that require a body retain their failure policy.
- Swagger UI: fixes cover example generation for base64url, exponential multipleOf values, and contains without items.
- Release combinations: validation includes six platforms, including net/http. A core tag or passing source CI alone does not establish completion of public combination validation.

## Verify with requests {#verify}

Run the standalone reference app with `go run main.go`. `/hello` should return HTTP 200, as should HEAD requests for the document and both UIs. Open `/docs` and `/redoc` in a browser to check rendering. CLI-generated apps run their configured entrypoint; use `spine run` after applying the same options in `BuildApplication`.

```bash
curl -i http://localhost:8080/hello
curl -I http://localhost:8080/openapi.json
curl -I http://localhost:8080/docs
curl -I http://localhost:8080/redoc
```

## Related documentation and merge sources {#sources}

- [OpenAPI](/en/reference/api/openapi)
- [v0.7.1](/en/learn/migration/v0.7.1-preview)
- [Preview → RC → Production](/en/community/release-channels)
- [Spine #26: OpenAPI UI](https://github.com/NARUBROWN/spine/pull/26)
- [Spine #32: HTTP v3 / TLS](https://github.com/NARUBROWN/spine/pull/32)
- [Spine #33: Preview](https://github.com/NARUBROWN/spine/pull/33)
- [Spine #34: Preview](https://github.com/NARUBROWN/spine/pull/34)
- [Spine CLI #39: HTTP v3 / net/http](https://github.com/NARUBROWN/spine-cli/pull/39)
