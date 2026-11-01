---
layout: home
description: "Build faster servers with familiar development patterns. Structure Go apps with controllers, services, constructor injection, and interceptors, and explore throughput and memory usage measured in our internal lab."

hero:
  name: "Spine"
  text: "Build faster servers<br>with familiar patterns."
  tagline: "Structure Go apps with the controllers and services you know from NestJS and Spring. Use constructor injection and interceptors, and explore throughput and memory usage measured with the same resources."
  actions:
    - theme: brand
      text: "Build your first app"
      link: /en/learn/getting-started/first-app
    - theme: alt
      text: "Compare performance"
      link: "#benchmarks"

features:
  - title: "Familiar controllers and services"
    details: "Controllers receive requests, and services handle business logic. Separate these roles with Go structs and methods."
    link: /en/learn/tutorial/2-controller
    linkText: "Learn to write controllers"
  - title: "Dependencies wired through constructors"
    details: "Declare the services you need as constructor parameters. Spine calls registered constructors to create objects and wire their dependencies."
    link: /en/learn/tutorial/3-dependency-injection
    linkText: "Explore dependency injection"
  - title: "Shared processing in interceptors"
    details: "Separate authentication, transactions, and logging from business logic. Register interceptors and choose when they run in the request flow."
    link: /en/learn/tutorial/4-interceptor
    linkText: "Learn to use interceptors"
---

<BenchmarkSection />

<section class="home-start">

## Build your first app

<div class="home-next-steps">

<a href="/en/learn/getting-started/first-app">
<strong>Build your first app with the CLI</strong>
<span>Follow the steps from installing the CLI and creating a project to checking the /health response.</span>
</a>

<a href="/en/reference/examples/login">
<strong>Explore the JWT login example</strong>
<span>See how to issue tokens and handle requests that require authentication.</span>
</a>

<a href="/en/reference/api/spine-app">
<strong>Check API behavior</strong>
<span>Review how to register constructors, routes, and interceptors, and check their return values.</span>
</a>

</div>

</section>
