---
layout: home
description: "Spine是提供构造函数注入与请求执行管道的Go后端框架。查看使用示例与内部实验室性能比较，开始构建第一个应用。"

hero:
  name: "Spine"
  text: "用Go构建分层后端服务"
  tagline: "通过构造函数注入连接控制器和服务。注册路由与拦截器后，Spine会管理从参数解析到响应完成的请求执行流程。"
  actions:
    - theme: brand
      text: "构建第一个应用"
      link: /zh-Hans/learn/getting-started/first-app
    - theme: alt
      text: "比较性能"
      link: "#benchmarks"

features:
  - title: "通过构造函数连接依赖"
    details: "将需要的对象声明为构造函数参数。Spine使用已注册的构造函数创建对象并连接依赖。"
    link: /zh-Hans/learn/tutorial/3-dependency-injection
    linkText: "了解依赖注入"
  - title: "用类型表达输入与输出"
    details: "通过方法参数接收请求值，通过返回类型表达响应。在控制器中编写要执行的操作。"
    link: /zh-Hans/learn/tutorial/2-controller
    linkText: "编写控制器"
  - title: "将公共处理放入拦截器"
    details: "将认证、事务和日志等公共处理与业务逻辑分开，并放在需要的执行时点。"
    link: /zh-Hans/learn/tutorial/4-interceptor
    linkText: "使用拦截器"
---

## 注册构造函数并连接请求

以下摘自用户查询应用，展示构造函数和路由的注册部分。构造函数与控制器方法已在应用代码中定义。

```go
app := spine.New()

app.Constructor(NewUserService, NewUserController)
app.Route("GET", "/users", (*UserController).GetUser)
```

Spine根据`NewUserController`的参数类型传入`UserService`。`GET /users`请求会连接到`UserController.GetUser`方法。

[服务器启动代码与完整项目请参阅第一个应用指南。](/zh-Hans/learn/getting-started/first-app)

<BenchmarkSection />

## 在构建应用中学习

<div class="home-next-steps">

<a href="/zh-Hans/learn/getting-started/first-app">
<strong>构建用户查询API <span aria-hidden="true">→</span></strong>
<span>从创建项目到发送请求并确认响应。</span>
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
