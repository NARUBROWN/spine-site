# Project structure

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Use the default layered-v1 layout to separate assembly, HTTP controllers and startup. New code uses the current route registration API.

## Create the project

Use a Preview CLI supporting the 0.7.5 API. CLI and app channels are separate; inspect go.mod for the actual selected versions.

```sh
spine new my-app --module example.com/my-app --channel preview --validator playground --no-interactive
cd my-app
spine doctor
spine inspect
```

```text
my-app/
├── main.go
├── go.mod
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/controller/health_controller.go
```

## Startup and assembly

These three files show the minimum role separation. Replace the corresponding generated files instead of adding duplicate types or registrations. main calls assembly, Validate and Run; BuildApplication does not start the server.

```go
// main.go
package main

import (
	"example.com/my-app/internal/application"
	"log"
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

```go
// src/controller/health_controller.go
package controller

import (
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
)

type HealthController struct{}

func (*HealthController) Constructor() *HealthController   { return &HealthController{} }
func (c *HealthController) RegisterRoutes(r *api.Registry) { r.GET("/health", c.Get) }
func (*HealthController) Get(ctx spinectx.Ctx) httpx.Response[map[string]string] {
	return httpx.Response[map[string]string]{Body: map[string]string{"status": "ok"}}
}
```

```go
// internal/application/application.go
package application

import (
	"example.com/my-app/src/controller"
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	playground "github.com/NARUBROWN/spine-validator-playground"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
	engine, err := playground.New()
	if err != nil {
		return nil, boot.Options{}, err
	}
	app := spine.New(echoplatform.Option(), spine.WithValidator(engine))
	app.Constructor(constructor.Controller(&controller.HealthController{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
```

## Add features with generators

```sh
spine generate resource user --dry-run
spine generate resource user
spine --help
```

The default layered-v1 resource generator creates a lookup skeleton. Implement full CRUD, database access and business rules yourself. Do not duplicate generated role registrations. Check RegisterRoutes and constructor roles. Inspect spine --help for the generators supported by each layout.

## Verify and run

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

Expect {"status":"ok"}. contract check checks static contracts; verify also runs formatting, vet and Go tests. app.Validate does not prove constructor execution or external connectivity. Verify HTTP and external resources with actual requests.

## Next steps

[Controllers](/en/learn/tutorial/2-controller) / [DI](/en/learn/tutorial/3-dependency-injection) / [Interceptors](/en/learn/tutorial/4-interceptor)
