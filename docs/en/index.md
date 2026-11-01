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


<BenchmarkSection />

<section class="home-start">

## Build your first app

<div class="home-next-steps">

<a href="/en/learn/getting-started/first-app">
<strong>Create your first app with the CLI <span aria-hidden="true">→</span></strong>
<span>Install the CLI, generate a project and check its /health response.</span>
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

</section>
