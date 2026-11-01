---
layout: home
description: "Spineはコンストラクタ注入とリクエスト実行パイプラインを備えたGoバックエンドフレームワークです。使用例と内部ラボの測定結果を確認し、最初のアプリを作成できます。"

hero:
  name: "Spine"
  text: "使い慣れたサーバー構成をGoで作る"
  tagline: "コンストラクタ注入でコントローラーとサービスを接続します。ルートとインターセプターを登録すると、Spineが引数の解決からレスポンスの完了までリクエストの実行を管理します。"
  actions:
    - theme: brand
      text: "最初のアプリを作る"
      link: /ja/learn/getting-started/first-app
    - theme: alt
      text: "性能を比較する"
      link: "#benchmarks"

features:
  - title: "依存関係をコンストラクタで接続する"
    details: "必要なオブジェクトを引数として宣言します。Spineが登録されたコンストラクタでインスタンスを作り、依存関係を接続します。"
    link: /ja/learn/tutorial/3-dependency-injection
    linkText: "依存性注入を見る"
  - title: "入出力を型で表現する"
    details: "メソッドの引数でリクエスト値を受け取り、戻り値の型でレスポンスを表現します。コントローラーには処理する操作を書きます。"
    link: /ja/learn/tutorial/2-controller
    linkText: "コントローラーを書く"
  - title: "共通処理をインターセプターにまとめる"
    details: "認証、トランザクション、ログなどの共通処理をビジネスロジックから分離し、必要な実行時点に配置します。"
    link: /ja/learn/tutorial/4-interceptor
    linkText: "インターセプターを使う"
---

## コンストラクタを登録してリクエストを接続する

ユーザー取得アプリから、コンストラクタとルートを登録する部分を抜粋しました。コンストラクタ関数とコントローラーメソッドはアプリ側に定義済みです。

```go
app := spine.New()

app.Constructor(NewUserService, NewUserController)
app.Route("GET", "/users", (*UserController).GetUser)
```

Spineは`NewUserController`の引数の型を見て`UserService`を渡します。`GET /users`は`UserController.GetUser`メソッドに接続されます。

[サーバー起動コードとプロジェクト全体は、最初のアプリのガイドで確認できます。](/ja/learn/getting-started/first-app)

<BenchmarkSection />

## アプリを作りながら学ぶ

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
