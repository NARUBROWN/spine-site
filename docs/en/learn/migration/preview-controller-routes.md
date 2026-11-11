# Controller and route migration for v0.7.1

::: info
This page records 0.7.1 behavior and migration history. For current inputs, context and validation, use the [0.7.5 migration guide](/en/learn/migration/v0.7.5).
:::


This guide targets Spine `v0.7.1`. Core requires Go 1.25.5 or later; the playground validator requires Go 1.26 or later.

## Register routes in a controller {#routes}

In v0.7.1, `app.Route` and the HTTP controller pattern using a constructor function, separate route.go, and method expressions are Deprecated. They remain available during migration; the removal version is undecided. General DI constructor functions are not deprecated.

This is a registration example, not a standalone app. Add an HTTP platform and run configuration to your application.

```go
import (
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)

type UserController struct{}
type UserPath struct { ID int64 `path:"id"` }
type User struct { ID int64 `json:"id"` }

func (*UserController) Constructor() *UserController { return &UserController{} }

func (c *UserController) RegisterRoutes(r *api.Registry) {
    users := r.Group("/users", api.Tags("Users"))
    users.GET("/:id",
        func(p input.Path[UserPath]) httpx.Response[User] {
            return httpx.Response[User]{Body: User{ID: p.ID}}
        }, api.Summary("Get user"))
}

func register(app interface{ Constructor(...any) }) {
    app.Constructor(constructor.Controller(&UserController{}))
}
```

You can retain existing method logic and call it from a callback. Old and new routes may coexist, but duplicate method and path pairs fail preparation. Remove the old registration for each migrated route. `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS` are supported.

## Constructors and roles {#constructors}

`app.Constructor` accepts `constructor.Custom`, `Repository`, `Service`, `Controller`, and `Interceptor` role registrations as well as existing constructor functions. An object registration uses a struct pointer and a nonvariadic `Constructor(dependencies...) *OwnType` method. Fields on the registration value are not copied; the constructed instance is cached per app. `Custom` also accepts an existing single-return constructor function.

A Controller also implements `api.Controller` with `RegisterRoutes(*api.Registry)`; an Interceptor implements `core.Interceptor`. Interceptor registration supplies DI only; configure global or route application separately. Constructor contracts and dependency graphs are checked before startup. Nil results and panics are detected when the constructor actually runs.

## Inputs and groups {#groups}

The `T` in `input.Query[T]` and `input.Body[T]` must be a struct. Path and query tags take precedence; otherwise names default to lowerCamel. Receive headers through a separate struct pointer with `header` tags.

The `T` in `input.Query[T]` and `input.Body[T]` must be a struct. `input.Path[T]` also supports a basic scalar when the route has exactly one variable in v0.7.1. Use a path DTO for multiple variables. Path and query tags take precedence; without one, names default to lowerCamel. Receive headers through a separate struct pointer with `header` tags. Keep body, path, query, and headers in separate inputs.

Both Group and Registry use `GET(path, handler, options...)`. Groups inherit prefixes and tags and can add interceptors with `api.Interceptors(...)`. The `example` and `description` tags describe documentation; they are not runtime defaults or validation rules.

## Deprecated inputs and compatibility {#deprecated}

`path.Int`, `path.String`, `path.Boolean`, `query.Values`, `header.Values`, the Values constructors and lookup methods, and `query.Pagination` are Deprecated. Mixing these inputs with new Path, Query, or Header DTOs in one handler fails preparation. Existing body DTOs and context remain supported. Compatibility paths `adapter`, `adapter/http`, `adapter/event`, and `adapter/websocket` are also Deprecated; use `contract/http`, `contract/event`, `contract/validator`, or `contract/websocket` as appropriate. Existing HTTP v2 implementations are not automatically converted to v3.

## Descriptions and verification {#verification}

For an app with new controllers, `spine.DescribeHTTP` returns `spine.ErrRoutesNotCollected` before preparation. Call `app.Prepare`, inspect with `spine.DescribePreparedHTTP`, and close the prepared result. Preparation can initialize configured databases or brokers. CLI static analysis does not execute user code and may not resolve dynamic paths or interceptor lists. `--source runtime` does not automatically prepare new controllers either.

Static OpenAPI does not run the validator and cannot establish its constraints. Inspect the prepared app for a description reflecting the selected validator. Unsupported examples or rules can produce diagnostics; equivalence for email, URI, UUID, and regular expressions is not guaranteed. Integer bounds remain exact in the specification.

After migration, run `spine contract check` and `spine verify`, then check actual HTTP requests and the description. See the following guides for input migration and additional HTTP v3 constraints.

- [v0.7.1](/en/learn/migration/v0.7.1-preview)
- [HTTP v3](/en/learn/migration/preview-features#body)
