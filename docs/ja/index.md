---
layout: home
description: "使い慣れた設計で、高速なサーバーを。 使い慣れたコントローラー、サービス、コンストラクタ注入、インターセプターをGoで。内部ラボの処理量とメモリ測定結果を公開しています。"

hero:
  name: "Spine"
  text: "使い慣れた設計で、<br>高速なサーバーを。"
  tagline: "NestJSやSpringで使い慣れたコントローラーとサービスの構成をGoでも。コンストラクタ注入とインターセプターでアプリを構築し、同じリソース制約での処理量とメモリ使用量を比較できます。"
  actions:
    - theme: brand
      text: "最初のアプリを作る"
      link: /ja/learn/getting-started/first-app
    - theme: alt
      text: "性能を比較する"
      link: "#benchmarks"

features:
  - title: "使い慣れたコントローラーとサービス"
    details: "コントローラーがリクエストを受け取り、サービスが業務処理を担当します。Goの構造体とメソッドで責務を分離します。"
    link: /ja/learn/tutorial/2-controller
    linkText: "コントローラーを書く"
  - title: "コンストラクタで依存関係を接続"
    details: "必要なサービスを引数として宣言します。Spineが登録されたコンストラクタでオブジェクトを作り、依存関係を接続します。"
    link: /ja/learn/tutorial/3-dependency-injection
    linkText: "依存性注入を見る"
  - title: "共通処理をインターセプターに集約"
    details: "認証、トランザクション、ログを業務処理から分離します。インターセプターを登録し、リクエスト処理のどこで実行するかを指定します。"
    link: /ja/learn/tutorial/4-interceptor
    linkText: "インターセプターを使う"
---

<section class="home-workflow">
<div class="workflow-copy">

## 使い慣れた構成をGoのコードで

ユーザー取得アプリでもコントローラーとサービスを分け、コンストラクタで接続します。以下はコンストラクタとルートの登録部分です。コンストラクタ関数とコントローラーメソッドはアプリ側に定義済みです。

Spineは`NewUserController`の引数の型を見て`UserService`を渡します。`GET /users`は`UserController.GetUser`メソッドに接続されます。

[サーバー起動コードとプロジェクト全体は、最初のアプリのガイドで確認できます。](/ja/learn/getting-started/first-app)

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

## 使い慣れた構成で最初のアプリを作る

<div class="home-next-steps">

<a href="/ja/learn/getting-started/first-app">
<strong>ユーザー取得APIを作る <span aria-hidden="true">→</span></strong>
<span>プロジェクトを作成し、リクエストを送り、レスポンスを確認します。</span>
</a>

<a href="/ja/reference/examples/login">
<strong>JWTログインの例を見る <span aria-hidden="true">→</span></strong>
<span>トークンの発行と認証付きリクエストの処理を確認します。</span>
</a>

<a href="/ja/reference/api/spine-app">
<strong>APIの動作を調べる <span aria-hidden="true">→</span></strong>
<span>コンストラクタ、ルート、インターセプターの登録方法と戻り値を確認します。</span>
</a>

</div>
