# はじめに

Spineは、コンストラクタ、ルート、インターセプターをGoコードで登録するWebフレームワークです。リクエストを受け取るハンドラーと、その前後に実行する処理を登録コードで確認できます。

このページの機能別 `src/user` の例は、[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で `--layout legacy` を指定して作成した `my-app` を使用します。CLI `v0.4.0` の標準レイアウトは役割別の `layered-v1` です。どちらも Spine `v0.6.0` と Echo プラットフォーム `v0.1.0` を使用します。

初めて使う場合は、[最初のアプリ](/ja/learn/getting-started/first-app)でCLIからプロジェクトを作成し、`GET /health`のレスポンスを確認してください。このページでは、アプリの構成に使う基本的な概念を紹介します。

## アプリの構成と実行

CLIで生成したプロジェクトでは、アプリの構成コードを`internal/application/application.go`の`BuildApplication()`にまとめます。`main.go`は`BuildApplication` → `Validate` → `Run`の順にアプリを構成し、検証してから実行します。

次のコードは、ユーザー機能を自分で実装した場合の登録例です。`UserController`とインターセプターの実装を省略しているため、生成されたファイルをこの例で上書きしないでください。

```go
func BuildApplication() (spine.App, boot.Options, error) {
    app := platform.New()

    // 생성자를 등록하면 등록 순서와 관계없이 의존성을 해결합니다.
    app.Constructor(NewUserRepository, NewUserService, NewUserController)

    // 인터셉터를 실행할 순서대로 등록합니다.
    app.InterceptorFor(boot.InterceptorHTTP, &TxInterceptor{}, &LoggingInterceptor{})

    // HTTP 메서드와 경로에 핸들러를 연결합니다.
    app.Route("GET", "/users", (*UserController).GetUser)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```


CLIの`spine generate resource user`が生成するコードは、上の例と名前やパスが異なります。生成されるハンドラーは`src/user`の`UserController.Get`で、パスは`GET /user/:id`です。コンストラクタが登録されている状態で、同じコンストラクタやルートを再度登録しないでください。`BuildApplication`に追加された`user.Register(app)`の呼び出しとエラー処理も維持してください。詳しい手順は[プロジェクト構造](/ja/learn/tutorial/1-project-structure)で確認できます。

## 基本的な概念

### 1. コンストラクタによる依存性注入

コンストラクタのパラメーターで必要な依存関係を宣言し、`app.Constructor`にコンストラクタを登録します。次の例では、`UserService`が`UserRepository`を受け取ります。

```go
// 생성자 파라미터가 곧 의존성 선언
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

// 등록만 하면 자동으로 의존성 그래프 해결
app.Constructor(NewUserRepository, NewUserService, NewUserController)
```

### 2. インターセプターのパイプライン

インターセプターは、コントローラーの呼び出し前後に、認証、トランザクション、ロギングなどの共通処理を実行します。次の例は、自分で実装した3つのインターセプターの登録順序を示しています。

```go
app.Interceptor(
    &TxInterceptor{},      // 1. 트랜잭션 시작
    &AuthInterceptor{},    // 2. 인증 확인
    &LoggingInterceptor{}, // 3. 로깅
)

```

`PreHandle`は登録順に実行されます。コントローラーが戻った後の`PostHandle`、レスポンス処理前の`BeforeResponse`、レスポンス処理後の`AfterCompletion`は逆順に実行されます。エラー発生時の呼び出し条件は[インターセプター](/ja/learn/tutorial/4-interceptor)で説明します。

### 3. 明示的なルーティング

`app.Route`でHTTPメソッド、パス、ハンドラーを関連付けます。機能ごとに登録関数を用意すると、関連するルートを1か所で管理できます。

```go
// 한 곳에서 모든 라우트를 관리
func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
    app.Route("PUT", "/users", (*UserController).UpdateUser)
    app.Route("DELETE", "/users", (*UserController).DeleteUser)
}
```

### 4. 型安全なハンドラー

ハンドラーのパラメーターと戻り値の型で、リクエストから読み取る値とレスポンスの形式を表します。次の例では、取得ハンドラーがクエリパラメーターを読み取り、作成ハンドラーがJSONリクエストボディを構造体へのポインターとして受け取ります。サービスとリクエスト、レスポンスの型は自分で実装する必要があります。

```go
// 함수 시그니처가 곧 API 스펙
func (c *UserController) GetUser(
    ctx context.Context,      // 컨텍스트
    q query.Values,           // 쿼리 파라미터
) (httpx.Response[UserResponse], error) {     // 응답 타입
    user, err := c.svc.Get(ctx, q.Int("id", 0))
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}

// DTO는 자동으로 바인딩
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,    // JSON body → 구조체 (포인터)
) (httpx.Response[UserResponse], error) {
    user, err := c.svc.Create(ctx, req)
    if err != nil {
        return httpx.Response[UserResponse]{}, err
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}
```

## 始める

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.0
spine version
```

CLIをインストールしたら、[最初のアプリ](/ja/learn/getting-started/first-app)でプロジェクトを生成し、HTTPレスポンスを確認してください。コマンドが見つからない場合は、[インストール手順](/ja/learn/getting-started/installation)のパス設定を参照してください。
