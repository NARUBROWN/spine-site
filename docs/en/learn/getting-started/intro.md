# Introduction

Spine is a Go backend framework assembled from role-based constructors, controller routes and interceptors.

## Runnable example

```sh
go mod init example.com/spine-intro
go get github.com/NARUBROWN/spine@v0.7.5 github.com/NARUBROWN/spine-echo-platform@v0.2.1
```

With Go 1.26 or later, save as main.go and run go run .. In another terminal, curl `http://localhost:8080/greeting` returns hello.

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
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
	r.GET("/greeting", func(ctx spinectx.Ctx) httpx.Response[string] {
		return httpx.Response[string]{Body: c.service.repository.Greeting()}
	})
}
func BuildApplication() (spine.App, boot.Options, error) {

	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}), constructor.Service(&Service{}), constructor.Repository(&Repository{}))
	return app, boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}, EnableGracefulShutdown: true}, nil
}
func main() {
	app, options, err := BuildApplication()
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

## Common development model

Choose platforms and a validator and register roles in BuildApplication. Constructor resolves DI by type; RegisterRoutes declares HTTP routes. input.Path, Query, Header and Body declare input sources. Handlers and four interceptor hooks use public spine.Ctx. The registered validator checks tags automatically; httpx expresses success responses and error expresses failures.

## Get started

[Installation](/en/learn/getting-started/installation) / [First app](/en/learn/getting-started/first-app) / [Controllers](/en/learn/tutorial/2-controller)
