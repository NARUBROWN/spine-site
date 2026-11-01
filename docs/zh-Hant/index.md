---
layout: home
description: "以熟悉的開發方式打造更快的伺服器。使用控制器、服務、建構函式注入與攔截器來組織 Go 應用程式，並查看內部實驗室測得的吞吐量與記憶體用量。"

hero:
  name: "Spine"
  text: "以熟悉的開發方式，<br>打造更快的伺服器。"
  tagline: "沿用 NestJS 與 Spring 的控制器和服務結構來組織 Go 應用程式。使用建構函式注入與攔截器，並查看在相同資源下測得的吞吐量與記憶體用量。"
  actions:
    - theme: brand
      text: "建立第一個應用程式"
      link: /zh-Hant/learn/getting-started/first-app
    - theme: alt
      text: "查看效能比較"
      link: "#benchmarks"

features:
  - title: "熟悉的控制器與服務"
    details: "控制器接收請求，服務處理業務。使用 Go 的結構體與方法區分各自的職責。"
    link: /zh-Hant/learn/tutorial/2-controller
    linkText: "查看控制器寫法"
  - title: "透過建構函式連接相依性"
    details: "將所需的服務宣告為建構函式參數。Spine 會呼叫已註冊的建構函式來建立物件，並連接相依性。"
    link: /zh-Hant/learn/tutorial/3-dependency-injection
    linkText: "查看相依性注入"
  - title: "以攔截器集中共用處理"
    details: "將驗證、交易與日誌記錄從業務程式碼中分離。註冊攔截器，並指定在請求流程中的執行時機。"
    link: /zh-Hant/learn/tutorial/4-interceptor
    linkText: "查看攔截器用法"
---

<BenchmarkSection />

<section class="home-start">

## 建立第一個應用程式

<div class="home-next-steps">

<a href="/zh-Hant/learn/getting-started/first-app">
<strong>使用 CLI 建立第一個應用程式</strong>
<span>從安裝 CLI、建立專案，一路操作到確認 /health 回應。</span>
</a>

<a href="/zh-Hant/reference/examples/login">
<strong>查看 JWT 登入範例</strong>
<span>了解如何簽發權杖，以及處理需要驗證的請求。</span>
</a>

<a href="/zh-Hant/reference/api/spine-app">
<strong>確認 API 行為</strong>
<span>查看建構函式、路由與攔截器的註冊方式及回傳值。</span>
</a>

</div>

</section>
