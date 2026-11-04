# Runtime OpenAPI

Starting with Spine `v0.7.0-preview.1`, you can generate OpenAPI 3.1.2 JSON from registered HTTP routes, handler types, and the validator's description contract.

::: warning Preview API available from v0.7.0-preview.1
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

## Integrating Swagger UI and ReDoc {#tools}

You can connect the generated JSON to Swagger UI or ReDoc. Configure the UI separately in your app. See the [Swagger and OpenAPI tutorial](/en/learn/tutorial/8-swagger) for a stable-version UI setup example.

To migrate input models, follow [Migrate handler inputs to Preview](/en/learn/migration/v0.7.0-preview). For the stable API, see [spine.App](/en/reference/api/spine-app).
