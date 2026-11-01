---
layout: home
description: "用熟悉的方式，构建更快的后端。 在Go中使用熟悉的控制器、服务、构造函数注入与拦截器。查看Spine内部实验室的吞吐量与内存测量结果。"

hero:
  name: "Spine"
  text: "用熟悉的方式，<br>构建更快的后端。"
  tagline: "将NestJS和Spring中熟悉的控制器与服务结构带到Go。使用构造函数注入与拦截器构建应用，再比较相同资源预算下的吞吐量与内存占用。"
  actions:
    - theme: brand
      text: "构建第一个应用"
      link: /zh-Hans/learn/getting-started/first-app
    - theme: alt
      text: "比较性能"
      link: "#benchmarks"

features:
  - title: "熟悉的控制器与服务"
    details: "控制器接收请求，服务处理业务逻辑。通过Go结构体和方法延续熟悉的职责分离。"
    link: /zh-Hans/learn/tutorial/2-controller
    linkText: "编写控制器"
  - title: "通过构造函数连接依赖"
    details: "将需要的服务声明为构造函数参数。Spine使用已注册的构造函数创建对象并连接依赖。"
    link: /zh-Hans/learn/tutorial/3-dependency-injection
    linkText: "了解依赖注入"
  - title: "将公共处理放入拦截器"
    details: "将认证、事务和日志与业务逻辑分离。注册拦截器并指定它们在请求流程中的执行时点。"
    link: /zh-Hans/learn/tutorial/4-interceptor
    linkText: "使用拦截器"
---


<BenchmarkSection />

<section class="home-start">

## 构建第一个应用

<div class="home-next-steps">

<a href="/zh-Hans/learn/getting-started/first-app">
<strong>使用CLI创建第一个应用 <span aria-hidden="true">→</span></strong>
<span>安装CLI，生成项目并确认 /health 响应。</span>
</a>

<a href="/zh-Hans/reference/examples/login">
<strong>查看JWT登录示例 <span aria-hidden="true">→</span></strong>
<span>了解令牌签发与认证请求的处理结构。</span>
</a>

<a href="/zh-Hans/reference/api/spine-app">
<strong>查询API行为 <span aria-hidden="true">→</span></strong>
<span>确认构造函数、路由和拦截器的注册方法与返回值。</span>
</a>

</div>

</section>
