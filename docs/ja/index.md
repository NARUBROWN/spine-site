---
layout: home
description: "慣れ親しんだ開発スタイルで、より高速なサーバーを作りましょう。コントローラーとサービス、コンストラクタ注入とインターセプターで Go アプリを構成し、内部ラボで測定したスループットとメモリ使用量を確認できます。"

hero:
  name: "Spine"
  text: "慣れ親しんだ開発スタイルで、<br>より高速なサーバーを。"
  tagline: "NestJS や Spring で使っていたコントローラーとサービスの構造で Go アプリを構成しましょう。コンストラクタ注入とインターセプターを使い、同じリソースで測定したスループットとメモリ使用量を確認できます。"
  actions:
    - theme: brand
      text: "最初のアプリを作る"
      link: /ja/learn/getting-started/first-app
    - theme: alt
      text: "性能比較を見る"
      link: "#benchmarks"

features:
  - title: "慣れ親しんだコントローラーとサービス"
    details: "コントローラーがリクエストを受け、サービスが業務処理を担当します。Go の構造体とメソッドで、それぞれの役割を分けます。"
    link: /ja/learn/tutorial/2-controller
    linkText: "コントローラーの書き方を見る"
  - title: "コンストラクタでつなぐ依存関係"
    details: "必要なサービスをコンストラクタのパラメーターとして宣言します。Spine が登録済みのコンストラクタを呼び出してオブジェクトを生成し、依存関係をつなぎます。"
    link: /ja/learn/tutorial/3-dependency-injection
    linkText: "依存性注入を見る"
  - title: "共通処理をインターセプターに集約"
    details: "認証、トランザクション、ログ出力を業務コードから分離します。インターセプターを登録し、リクエストの流れの中で実行するタイミングを指定します。"
    link: /ja/learn/tutorial/4-interceptor
    linkText: "インターセプターの使い方を見る"
---

<BenchmarkSection />

<section class="home-start">

## 最初のアプリを作る

<div class="home-next-steps">

<a href="/ja/learn/getting-started/first-app">
<strong>CLI で最初のアプリを作る</strong>
<span>CLI のインストールとプロジェクトの作成から、/health のレスポンス確認まで順に進めます。</span>
</a>

<a href="/ja/reference/examples/login">
<strong>JWT ログインの例を見る</strong>
<span>トークンを発行し、認証が必要なリクエストを処理する構造を確認します。</span>
</a>

<a href="/ja/reference/api/spine-app">
<strong>API の動作を確認する</strong>
<span>コンストラクタ、ルート、インターセプターの登録方法と戻り値を確認します。</span>
</a>

</div>

</section>
