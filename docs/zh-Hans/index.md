---
layout: home
description: "Spine 是提供 HTTP、WebSocket、事件和 DTO 验证公共契约的 Go 后端框架。通过 CLI 选择独立实现、创建项目并检查应用执行契约。"

hero:
  name: "Spine"
  text: "用熟悉的开发方式，<br>构建更快的服务器。"
  tagline: "使用您在 NestJS 和 Spring 中熟悉的控制器与服务结构来组织 Go 应用。您可以使用构造函数注入和拦截器，并查看相同资源条件下测得的吞吐量和内存使用量。"
  actions:
    - theme: brand
      text: "创建第一个应用"
      link: /zh-Hans/learn/getting-started/first-app
    - theme: alt
      text: "查看性能比较"
      link: "#benchmarks"

features:
  - title: "熟悉的控制器与服务"
    details: "控制器接收请求，服务处理业务。通过 Go 的结构体和方法划分各自的职责。"
    link: /zh-Hans/learn/tutorial/2-controller
    linkText: "查看控制器编写方法"
  - title: "通过构造函数连接依赖"
    details: "将所需的服务声明为构造函数参数。Spine 调用已注册的构造函数来创建对象并连接依赖。"
    link: /zh-Hans/learn/tutorial/3-dependency-injection
    linkText: "查看依赖注入"
  - title: "用拦截器集中处理通用逻辑"
    details: "将认证、事务和日志记录从业务代码中分离。注册拦截器，并指定它们在请求流程中的执行时机。"
    link: /zh-Hans/learn/tutorial/4-interceptor
    linkText: "查看拦截器使用方法"
---

<BenchmarkSection />

<section class="home-start">

## 创建第一个应用

<div class="home-next-steps">

<a href="/zh-Hans/learn/getting-started/first-app">
<strong>使用 CLI 创建第一个应用</strong>
<span>从安装 CLI、创建项目开始，逐步完成 /health 响应验证。</span>
</a>

<a href="/zh-Hans/reference/examples/login">
<strong>查看 JWT 登录示例</strong>
<span>了解签发令牌和处理需要认证的请求的结构。</span>
</a>

<a href="/zh-Hans/reference/api/spine-app">
<strong>查看 API 行为</strong>
<span>查看构造函数、路由和拦截器的注册方法及返回值。</span>
</a>

</div>

</section>
