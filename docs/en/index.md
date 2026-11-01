---
layout: home
description: "Familiar patterns. Faster backends. Bring familiar controllers, services, constructor injection and interceptors to Go. Explore throughput and memory results from the Spine internal lab."

hero:
  name: "Spine"
  text: "Familiar patterns.<br>Faster backends."
  tagline: "Bring the controller and service structure you know from NestJS and Spring to Go. Build with constructor injection and interceptors, then compare throughput and memory use within the same resource budget."
  actions:
    - theme: brand
      text: "Build your first app"
      link: /en/learn/getting-started/first-app
    - theme: alt
      text: "Compare performance"
      link: "#benchmarks"

features:
  - title: "Familiar controllers and services"
    details: "Controllers receive requests and services handle business logic. Keep that separation of responsibilities with Go structs and methods."
    link: /en/learn/tutorial/2-controller
    linkText: "Write a controller"
  - title: "Dependencies connected through constructors"
    details: "Declare the services you need as constructor parameters. Spine creates objects from registered constructors and connects their dependencies."
    link: /en/learn/tutorial/3-dependency-injection
    linkText: "Explore dependency injection"
  - title: "Shared work handled by interceptors"
    details: "Separate authentication, transactions and logging from business logic. Register interceptors and choose where they run in the request flow."
    link: /en/learn/tutorial/4-interceptor
    linkText: "Use interceptors"
---

<section class="home-workflow">
<div class="workflow-copy">

## Bring familiar structure to Go code

A user lookup app separates controllers from services and connects them through constructors. This excerpt registers the constructors and route. The constructor functions and controller method are defined elsewhere in the app.

Spine reads the parameter type of `NewUserController` and supplies `UserService`. `GET /users` is routed to `UserController.GetUser`.

[Find the server startup code and complete project in the first-app guide.](/en/learn/getting-started/first-app)

</div>
<div class="workflow-code" data-ui>

```go
app := spine.New()

app.Constructor(NewUserService, NewUserController)
app.Route("GET", "/users", (*UserController).GetUser)
```

</div>
</section>

<BenchmarkSection />

## Build your first app with familiar patterns

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
