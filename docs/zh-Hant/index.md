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


<BenchmarkSection />

<section class="home-start">

## 建立第一個應用程式

<div class="home-next-steps">

<a href="/zh-Hant/learn/getting-started/first-app">
<strong>使用CLI建立第一個應用程式 <span aria-hidden="true">→</span></strong>
<span>安裝CLI，產生專案並確認 /health 回應。</span>
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

</section>
