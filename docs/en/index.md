---
layout: home
description: "Spine is a Go backend framework with constructor injection and a request execution pipeline. Explore an example, compare internal lab results, and build your first app."

hero:
  name: "Spine"
  text: "Build structured backends in Go"
  tagline: "Connect controllers and services through constructor injection. Register routes and interceptors, and let Spine manage request execution from argument resolution to response completion."
  actions:
    - theme: brand
      text: "Build your first app"
      link: /en/learn/getting-started/first-app
    - theme: alt
      text: "Compare performance"
      link: "#benchmarks"

features:
  - title: "Connect dependencies through constructors"
    details: "Declare the objects you need as constructor parameters. Spine creates instances from registered constructors and connects their dependencies."
    link: /en/learn/tutorial/3-dependency-injection
    linkText: "Explore dependency injection"
  - title: "Express inputs and outputs with types"
    details: "Receive request values through method parameters and express responses through return types. Write the operation in your controller."
    link: /en/learn/tutorial/2-controller
    linkText: "Write a controller"
  - title: "Keep shared work in interceptors"
    details: "Separate authentication, transactions and logging from business logic, and place them at the required points in request execution."
    link: /en/learn/tutorial/4-interceptor
    linkText: "Use interceptors"
---

## Register constructors and connect a request

This excerpt registers the constructors and route in a user lookup app. The constructor functions and controller method are defined elsewhere in the app.

```go
app := spine.New()

app.Constructor(NewUserService, NewUserController)
app.Route("GET", "/users", (*UserController).GetUser)
```

Spine reads the parameter type of `NewUserController` and supplies `UserService`. `GET /users` is routed to `UserController.GetUser`.

[Find the server startup code and complete project in the first-app guide.](/en/learn/getting-started/first-app)

<BenchmarkSection />

## Learn by building an app

<div class="home-next-steps">

<a href="/en/learn/getting-started/first-app">
<strong>Build a user lookup API <span aria-hidden="true">→</span></strong>
<span>Create a project, send a request and check the response.</span>
</a>

<a href="/en/reference/examples/login">
<strong>Explore JWT login <span aria-hidden="true">→</span></strong>
<span>See how to issue tokens and handle authenticated requests.</span>
</a>

<a href="/en/reference/api/spine-app">
<strong>Look up API behavior <span aria-hidden="true">→</span></strong>
<span>Check constructor, route and interceptor registration methods and return values.</span>
</a>

</div>
