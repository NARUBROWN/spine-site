---
layout: home
description: "用熟悉的方式，打造更快的後端。 在Go中使用熟悉的控制器、服務、建構函式注入與攔截器。查看Spine內部實驗室的吞吐量與記憶體量測結果。"

hero:
  name: "Spine"
  text: "用熟悉的方式，<br>打造更快的後端。"
  tagline: "將NestJS和Spring中熟悉的控制器與服務結構帶到Go。使用建構函式注入與攔截器建立應用程式，再比較相同資源預算下的吞吐量與記憶體用量。"
  actions:
    - theme: brand
      text: "建立第一個應用程式"
      link: /zh-Hant/learn/getting-started/first-app
    - theme: alt
      text: "比較效能"
      link: "#benchmarks"

features:
  - title: "熟悉的控制器與服務"
    details: "控制器接收請求，服務處理業務邏輯。透過Go結構體和方法延續熟悉的職責分離。"
    link: /zh-Hant/learn/tutorial/2-controller
    linkText: "撰寫控制器"
  - title: "透過建構函式連接依賴"
    details: "將需要的服務宣告為建構函式參數。Spine使用已註冊的建構函式建立物件並連接依賴。"
    link: /zh-Hant/learn/tutorial/3-dependency-injection
    linkText: "了解依賴注入"
  - title: "將共用處理放入攔截器"
    details: "將驗證、交易和記錄與業務邏輯分離。註冊攔截器並指定它們在請求流程中的執行時點。"
    link: /zh-Hant/learn/tutorial/4-interceptor
    linkText: "使用攔截器"
---

<section class="home-workflow">
<div class="workflow-copy">

## 用Go程式碼延續熟悉的結構

使用者查詢應用程式同樣將控制器與服務分離，並透過建構函式連接。以下展示建構函式和路由的註冊部分。建構函式與控制器方法已在應用程式碼中定義。

Spine根據`NewUserController`的參數型別傳入`UserService`。`GET /users`請求會連接到`UserController.GetUser`方法。

[伺服器啟動程式碼與完整專案請參閱第一個應用程式指南。](/zh-Hant/learn/getting-started/first-app)

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

## 用熟悉的方式建立第一個應用程式

<div class="home-next-steps">

<a href="/zh-Hant/learn/getting-started/first-app">
<strong>建立使用者查詢API <span aria-hidden="true">→</span></strong>
<span>從建立專案到傳送請求並確認回應。</span>
</a>

<a href="/zh-Hant/reference/examples/login">
<strong>查看JWT登入範例 <span aria-hidden="true">→</span></strong>
<span>了解權杖簽發與驗證請求的處理結構。</span>
</a>

<a href="/zh-Hant/reference/api/spine-app">
<strong>查詢API行為 <span aria-hidden="true">→</span></strong>
<span>確認建構函式、路由和攔截器的註冊方法與回傳值。</span>
</a>

</div>
