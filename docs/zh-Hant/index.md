---
layout: home
description: "Spine是提供建構函式注入與請求執行管線的Go後端框架。查看使用範例與內部實驗室效能比較，開始建立第一個應用程式。"

hero:
  name: "Spine"
  text: "用Go建立分層後端服務"
  tagline: "透過建構函式注入連接控制器和服務。註冊路由與攔截器後，Spine會管理從參數解析到回應完成的請求執行流程。"
  actions:
    - theme: brand
      text: "建立第一個應用程式"
      link: /zh-Hant/learn/getting-started/first-app
    - theme: alt
      text: "比較效能"
      link: "#benchmarks"

features:
  - title: "透過建構函式連接依賴"
    details: "將需要的物件宣告為建構函式參數。Spine使用已註冊的建構函式建立物件並連接依賴。"
    link: /zh-Hant/learn/tutorial/3-dependency-injection
    linkText: "了解依賴注入"
  - title: "用型別表達輸入與輸出"
    details: "透過方法參數接收請求值，透過回傳型別表達回應。在控制器中撰寫要執行的操作。"
    link: /zh-Hant/learn/tutorial/2-controller
    linkText: "撰寫控制器"
  - title: "將共用處理放入攔截器"
    details: "將驗證、交易和記錄等共用處理與業務邏輯分開，並放在需要的執行時點。"
    link: /zh-Hant/learn/tutorial/4-interceptor
    linkText: "使用攔截器"
---

## 註冊建構函式並連接請求

以下摘自使用者查詢應用程式，展示建構函式和路由的註冊部分。建構函式與控制器方法已在應用程式碼中定義。

```go
app := spine.New()

app.Constructor(NewUserService, NewUserController)
app.Route("GET", "/users", (*UserController).GetUser)
```

Spine根據`NewUserController`的參數型別傳入`UserService`。`GET /users`請求會連接到`UserController.GetUser`方法。

[伺服器啟動程式碼與完整專案請參閱第一個應用程式指南。](/zh-Hant/learn/getting-started/first-app)

<BenchmarkSection />

## 在建立應用程式中學習

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
