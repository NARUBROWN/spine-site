# Project Structure

Create a project with the Spine CLI and add a user resource. Read the generated files to learn where to put app configuration code and what controllers, services, and repositories do.

First, complete the [CLI installation](/en/learn/getting-started/installation). If you already created a project by following [Your First App](/en/learn/getting-started/first-app), skip the creation step and continue in that project. Read the module paths in the code below as your own project's module path.

## Create a Project with the CLI

Run these commands in the parent directory where you want to place the project. If a `my-app` directory already exists, use a different name.

```sh
spine version
spine new my-app --module example.com/my-app
cd my-app
go mod tidy
spine doctor
spine inspect
```

The `my-app` directory is created and its dependencies are prepared. `doctor` diagnoses tools and project settings, and `inspect` lets you check that the default route, `GET /health`, is registered.

## Generated Base Structure

`spine new` generates the following files. `go.sum` is created later by `go mod tidy`.

```text
my-app/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/
    └── application/
        ├── application.go
        └── application_test.go
```

## CLI Configuration

`spine.toml` contains the settings the CLI needs to find and run the project. It supports the four keys below. Manage app settings such as database connections separately.

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

| Key | Purpose |
| --- | --- |
| `module` | The Go module path. It must match the module path in `go.mod`. |
| `entrypoint` | The target to run or build |
| `composition` | The location where the CLI inspects app configuration and automatically registers generated code |
| `port` | The port used by the development server |

## Separate Execution from App Configuration

`main.go` calls the app configuration function, validates the configuration, and starts the server. Register constructors, routes, and interceptors in `BuildApplication` in `internal/application/application.go`.

```go
package main

import (
    "log"

    "example.com/my-app/internal/application"
)

func main() {
    app, options, err := application.BuildApplication()
    if err != nil {
        log.Fatal(err)
    }
    if err := app.Validate(options); err != nil {
        log.Fatal(err)
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

`BuildApplication` returns the app and its runtime options without starting the server. The generated code registers the default HTTP route, `GET /health`.

```go
package application

import (
    "os"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type HealthController struct{}

func NewHealthController() *HealthController { return &HealthController{} }

func (c *HealthController) Get() httpx.Response[map[string]string] {
    return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New()
    app.Constructor(NewHealthController)
    app.Route("GET", "/health", (*HealthController).Get)

    address := ":8080"
    if port := os.Getenv("SPINE_PORT"); port != "" {
        address = ":" + port
    }
    return app, boot.Options{Address: address, HTTP: &boot.HTTPOptions{}}, nil
}
```

## Add a Feature with the CLI

Generate a user resource from the project root. If you have already generated it in an existing project, skip this command.

```sh
spine generate resource user
```

```text
src/user/
├── user_route.go
├── user_repository.go
├── user_service.go
└── user_controller.go
```

When the command finishes, four files are created in `src/user`. By default, the CLI adds the following registration code to `BuildApplication`. Check the generated result, and do not register the same code again manually.

```go
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`user_route.go` registers the constructors and `GET /user/:id`. The other files have the following roles:

| File | Purpose |
| --- | --- |
| `user_controller.go` | Receives HTTP requests, passes them to the service, and returns responses. |
| `user_service.go` | Handles business logic. |
| `user_repository.go` | Handles data access. |

The resource generator only creates starter code for a GET handler that returns an ID. You must implement database models and persistent data storage yourself.

For typed creation and lookup examples, use a different name with `spine generate slice order --storage memory --field name:string`. This command's in-memory store is for development, and its data is lost when the app stops.

## Registration Rules and Validation

To let the CLI inspect the registration code, keep `app := spine.New()` at the top level of the body of `BuildApplication() (spine.App, boot.Options, error)`. Do not move registration code into conditionals, loops, or arbitrary helper functions. You must also check and return errors from `Register(app)`.

Inspect the app configuration, then run the server.

```sh
spine contract check
spine verify
spine dev
```

`contract check` checks the execution contract extracted from the registration code. `verify` runs the contract check, `gofmt`, `go vet`, and Go tests. If both commands complete without errors, `dev` starts the development server. Check actual HTTP behavior and connections to external databases and message brokers separately in the runtime environment.

## Next Steps

- [Controllers](/en/learn/tutorial/2-controller)
- [Dependency Injection](/en/learn/tutorial/3-dependency-injection)
- [Interceptors](/en/learn/tutorial/4-interceptor)
