# Runtime OpenAPI

Starting with Spine `v0.7.0-preview.1`, you can generate OpenAPI 3.1.2 JSON from registered HTTP routes, handler types, and the validator's description contract.

`boot.OpenAPIOptions.UI` and embedded Swagger UI and ReDoc are available from `v0.7.0-preview.2`. This is later than `v0.7.0-preview.1`, which introduced JSON document generation.

::: warning v0.7.0 Preview APIs
This API is not included in stable `v0.6.5`. Use Echo `v0.2.0-preview.1` for HTTP, and select playground `v0.2.0-preview.1` if you use it for validation and detailed input schema descriptions. For input parameters, first read [Migrate handler inputs to Preview](/en/learn/migration/v0.7.0-preview).
:::

## Enable generation and configure boot options {#options}

Automatic generation and HTTP serving are disabled by default. Enable them explicitly in your existing app's `boot.Options` as shown below. The import path for `boot` is `github.com/NARUBROWN/spine/pkg/boot`.

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

| Field | Default | Behavior |
| --- | --- | --- |
| `Enabled` | `false` | When `true`, generate the document during preparation and serve it over HTTP |
| `Path` | `/openapi.json` | Static absolute path served with GET and HEAD |
| `Title` | `Spine API` | OpenAPI `info.title` |
| `Version` | `unversioned` | The app's `info.version`, independent of the framework version |
| `UI` | `nil` | `[]boot.OpenAPIUI`, available from `v0.7.0-preview.2`. Omit it to serve only the JSON document |

`HTTP: nil` disables both HTTP and the document resource. Setting only `Path`, `Title`, or `Version` does not enable it. To disable it, set `Enabled: false` or omit the OpenAPI options. Use the public Preview's `Enabled` option instead of the `Disabled` option used in unpublished development sources.

The document path is independent of `GlobalPrefix`. The options above apply `/api` to business APIs while serving the document at `/openapi.json`. A prepared app reuses the document snapshot and does not save a file automatically.

## Retrieve the document and resolve conflicts {#http}

The enabled resource is publicly accessible and passes through HTTP server middleware. Retrieving the document does not execute business controllers, DTO binding, validation by the validator, or Spine business interceptors.

If an app GET, HEAD, or WebSocket route matches the document path, startup fails with `OPENAPI_PATH_CONFLICT`. Dynamic routes such as `/:id` can also conflict. Change `Path` to a static path that does not overlap, or disable the document. When disabled, it does not reserve the path. Native routes registered directly with the platform are outside the core's conflict checks.

```bash
curl -i http://localhost:8080/openapi.json
curl -I http://localhost:8080/openapi.json
```

## Describe or export without running the app {#export}

The following function accepts an app that has already been configured, HTTP options, and an output destination. It does not replace the existing `spine.App` interface.

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

This function requires imports for the standard `errors` and `io` packages, `github.com/NARUBROWN/spine`, `github.com/NARUBROWN/spine/pkg/boot`, and `github.com/NARUBROWN/spine/pkg/openapi`. `DescribeHTTP` does not execute constructors, factories, handlers, or validation rules. It can call description methods on a registered `SchemaDescriber`. To write a file, the caller supplies an `io.Writer`.

Explicit calls to `DescribeHTTP` and `openapi.Generate` also work when automatic HTTP serving is disabled. Custom App implementations without description support return `ErrHTTPDescriptionUnavailable`.

## Validator support and description scope {#validation}

| Registration state | Generated information |
| --- | --- |
| No validator registered | Route- and HTTP-method-oriented information, with a `VALIDATOR_NOT_CONFIGURED` diagnostic |
| Validator registered without `SchemaDescriber` support | Request validation remains active; detailed DTO inputs are omitted, with an `INPUT_SCHEMA_DESCRIPTION_UNAVAILABLE` diagnostic when describing a DTO |
| Validator registered with description contract support | DTOs by input source and validation constraints that can be described |

Without a validator, the generator does not infer input parameters, request and response models, or error status codes. It retains the minimum response placeholders required by OpenAPI and placeholders for path variables without specified types.

A validator without `SchemaDescriber` can still describe the types of existing path wrappers and the page, size, and defaults of `query.Pagination`. `SchemaDescriber` is required for detailed DTO input descriptions.

Required inputs follow the validator contract. Pointers or `json:",omitempty"` alone do not determine whether an input is required. Path segments are always required, and path pointers do not represent optional or nullable inputs.

Unsupported custom rules and dynamic values are recorded as limitations in `x-spine-diagnostics`. The generator does not guess which keys existing `query.Values` and `header.Values` inputs will read inside a function. `query.Pagination` describes its declared page and size inputs but remains Deprecated along with the other existing inputs.

The T in `httpx.Response[T]` describes the response body type. Status codes and error branches selected by the handler cannot be determined without executing it, so they remain under `default`. When a validator is registered and the document includes a request body or input parameters, it also adds a `400` response for framework binding and DTO validation failures. Defaults applied inside the handler are not added to the generated document either.

## Serve Swagger UI and ReDoc {#tools}

From `v0.7.0-preview.2`, add `UI` to your existing `boot.Options.HTTP.OpenAPI` settings to select documentation screens. Set `Enabled: true` and register the UIs. Omit `UI` to serve only JSON. Pin the core version explicitly and use the existing Preview tag for the HTTP platform.

```bash
go get github.com/NARUBROWN/spine@v0.7.0-preview.2 github.com/NARUBROWN/spine-echo-platform@v0.2.0-preview.1
```

The following `main.go` is a standalone app that registers the selected UIs. In an existing app, add the imports and `OpenAPI.UI` settings to your current composition.

```go
package main

import (
    "log"

    "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/redoc"
    "github.com/NARUBROWN/spine/pkg/openapi/ui/swaggerui"
)

type Controller struct{}

func (*Controller) Hello() httpx.Response[string] {
    return httpx.Response[string]{Body: "hello"}
}

func main() {
    app := spine.New(echoplatform.Option())
    app.Constructor(func() *Controller { return &Controller{} })
    app.Route("GET", "/hello", (*Controller).Hello)

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

Running the app serves `/openapi.json`, `/docs`, and `/redoc`. To use only Swagger UI, omit the ReDoc import and registration. `go:embed` includes the selected UIs' JS, CSS, and license notices in the binary, so serving the default UI assets requires no CDN, npm, or separate static-file directory.

### Options for each UI {#ui-options}

| Option | Swagger UI default | ReDoc default | Meaning |
| --- | --- | --- | --- |
| `Path` | `/docs` | `/redoc` | Static absolute path for the documentation screen |
| `Title` | `API documentation` | `API reference` | Browser tab title. Set the document's `info.title` through `OpenAPIOptions.Title` |

Set the document URL through the shared `OpenAPIOptions.Path` option. Document and asset paths are independent of `HTTP.GlobalPrefix`. Assets and redistribution notices are served under `/_assets/` beneath each UI path. Relative URLs also support proxies that strip an external prefix before forwarding requests.

Documents and assets support GET and HEAD and do not execute Spine business interceptors. HTTP server middleware still applies. To restrict access, protect the JSON document, UI, and asset paths with the same proxy access policy. API requests executed through Swagger use the original API's interceptors.

### UI provider contract and preparation {#ui-provider}

Both packages' `New` functions return the following `boot.OpenAPIUI` type. Resource bodies are strings.

```go
type OpenAPIResource struct {
    Path        string
    ContentType string
    Body        string
}

type OpenAPIUI func(documentPath string) ([]OpenAPIResource, error)
```

`Prepare` and `Run` call each UI provider once during preflight and connect the validated resources to the HTTP adapter. A separate `Validate` call also invokes the providers, and later preparation validates them again. Custom providers must return static resources without opening external connections or executing user handlers.

Preparation rejects document or asset paths that overlap existing GET, HEAD, or WebSocket routes with `OPENAPI_PATH_CONFLICT`. A nil provider or invalid UI options produce `OPENAPI_UI_INVALID`; an invalid resource path or Content-Type produces `OPENAPI_UI_RESOURCE_INVALID`.

For separate UI setup on stable `v0.6.5`, see the [Swagger and OpenAPI tutorial](/en/learn/tutorial/8-swagger). See [Migrate handler inputs to Preview](/en/learn/migration/v0.7.0-preview) for input models and [spine.App](/en/reference/api/spine-app) for the stable API.
