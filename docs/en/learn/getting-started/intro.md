# Introduction

Spine is a Go backend framework configured with constructors, routes, and interceptors. In `v0.7.1`, a controller registers its HTTP routes and handler signatures describe input sources and response types.

## Configure and run an application

This standalone app configures a controller with an injected service and repository. Install Spine `v0.7.1` and a compatible Echo platform in a separate Go module, save it as `main.go`, and run `go run .`.

In a new directory, create a Go module and install the stable dependencies.

```bash
go mod init example.com/spine-intro
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	"log"
)

type Repository struct{}

func (*Repository) Constructor() *Repository { return &Repository{} }
func (*Repository) Greeting() string         { return "hello" }

type Service struct{ repository *Repository }

func (*Service) Constructor(repository *Repository) *Service { return &Service{repository: repository} }

type Controller struct{ service *Service }

func (*Controller) Constructor(service *Service) *Controller { return &Controller{service: service} }
func (c *Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/greeting", func() httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(
		constructor.Controller(&Controller{}),
		constructor.Service(&Service{}),
		constructor.Repository(&Repository{}),
	)
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

A request from another terminal returns `hello`. A CLI-generated project keeps application configuration in `BuildApplication()` and validates and runs it from `main.go`.

```bash
curl http://localhost:8080/greeting
```

## Core concepts

### Constructors and dependencies

Declare required types in `Constructor` methods and register them using `constructor.Repository`, `constructor.Service`, and `constructor.Controller`. The container resolves dependencies by type, not registration order. Existing constructor functions also remain supported.

### Routes and inputs

Register paths and callbacks with `api.Registry` in `RegisterRoutes`. `input.Path[T]`, `input.Query[T]`, and `input.Body[T]` identify input sources; headers use a separate tagged struct. Existing `app.Route` remains for compatibility but is deprecated.

### Interceptors and responses

Interceptors run common work such as authentication, logging, and transactions around a handler. Return successful responses with `httpx.Response[T]` and failures as `error`. For authentication that must run before body binding, check the execution point of global interceptors.

### Platforms

Choose an Echo or net/http implementation for HTTP. WebSocket, event brokers, and validators are also connected through independent platforms.

## Get started

After [installation](/en/learn/getting-started/installation), create a CLI project and check its response in [Your first app](/en/learn/getting-started/first-app). Continue with [controllers](/en/learn/tutorial/2-controller), [dependency injection](/en/learn/tutorial/3-dependency-injection), and [interceptors](/en/learn/tutorial/4-interceptor).
