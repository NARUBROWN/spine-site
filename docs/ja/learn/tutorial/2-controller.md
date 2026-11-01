# コントローラー

CLI で作成した `hello-spine` プロジェクトに `GET /user/:id` のコントローラーを追加し、リクエストパスの整数を JSON レスポンスとして返します。続いて、クエリ、ヘッダー、リクエストボディの受け取り方とレスポンスの型を確認します。

[最初のアプリ](/ja/learn/getting-started/first-app)のインストールとプロジェクト作成を済ませ、プロジェクトルートで進めてください。すでに `spine generate resource user` を実行した場合は、生成手順を省略してファイルを確認します。

## CLI でコントローラーを生成する

```bash
spine generate resource user --dry-run
```

プレビューで生成ファイルと登録コードの変更を確認してから、次のコマンドで生成します。

```bash
spine generate resource user
```

### 生成されるファイル

```text
src/user/
├── user_controller.go
├── user_service.go
├── user_repository.go
└── user_route.go
```

生成された `src/user/user_controller.go` はパスの `id` を受け取り、`{"id":1}` という形式のレスポンスを返します。`UserService` と同じ `user` パッケージにあるため、サービス用のパッケージを別途インポートする必要はありません。

```go
package user

import (
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
)

type UserController struct { service *UserService }

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) Get(id path.Int) httpx.Response[map[string]any] {
    return httpx.Response[map[string]any]{Body: map[string]any{"id": id.Value}}
}
```

::: info
`resource` は、取得用のルートと依存性の登録を含む基本構成を生成します。データベース、ドメインモデル、データ転送オブジェクト（DTO）、作成や更新の機能は自分で実装する必要があります。
:::

## 生成されたルートの登録を確認する

CLI は `src/user/user_route.go` にコンストラクタとルートを登録します。`BuildApplication()` には `user.Register(app)` の呼び出しとエラー処理を追加します。次のコードは生成済みの登録内容を示しているため、再度追加しないでください。

```go
// src/user/user_route.go
package user

import "github.com/NARUBROWN/spine"

func Register(app spine.App) error {
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    app.Route("GET", "/user/:id", (*UserController).Get)
    return nil
}
```

```go
// internal/application/application.go: BuildApplication
if err := user.Register(app); err != nil {
    return nil, boot.Options{}, err
}
```

`main.go` の `BuildApplication → Validate → Run` という流れを維持します。以降、新しいハンドラーを実装したら、そのパッケージの `Register` 内にルートを追加してください。

## 生成結果を検証して実行する

プロジェクトルートで契約とローカルコードを検査してから、サーバーを起動します。

```bash
spine doctor
spine contract check
spine verify
spine dev
```

別のターミナルから、生成されたルートを呼び出します。

```bash
curl http://localhost:8080/user/1
```

`GET /user/1` は HTTP 200 と `{"id":1}` を返すはずです。このレスポンスで確認できるのは、パスのバインディングとルートの実行です。データベースからユーザーを取得した結果ではありません。`spine contract check` と `spine verify` の成否は、実際の HTTP レスポンスとは別に確認してください。

## 拡張例の前提

以下のコードは、入力とレスポンスを拡張する、それぞれ独立した例です。生成されたアプリ全体を置き換えるコードではありません。同じ名前のメソッドを複数まとめて貼り付けると、重複宣言エラーが発生します。必要なハンドラーを一つ選んで実装し、ルートに登録してください。

`UserResponse`、リクエスト DTO、`HeaderInfo`、サービスの `Get`、`List`、`Create`、`Login` などは、各例に合わせて自分で実装する必要があります。型は対応するコントローラーと同じパッケージに置き、必要な Go 標準パッケージと Spine パッケージをインポートしてください。以下のサービス呼び出しで省略しているエラー処理は、[エラーレスポンス](#error-response)の例を参考に実装します。

## ハンドラーのシグネチャ

Spine は、ハンドラーのパラメーターの型に応じてリクエストの値を渡します。これを入力バインディングと呼びます。戻り値の型は、レスポンスの作り方を決めます。

### サポートするパラメーターの型

| 型 | 説明 | 例 |
|------|------|------|
| `context.Context` | リクエストコンテキスト | `ctx context.Context` |
| `query.Values` | クエリパラメーター | `q query.Values` |
| `query.Pagination` | ページネーション | `page query.Pagination` |
| `header.Values` | HTTP ヘッダー | `headers header.Values` |
| `*struct`（DTO） | JSON リクエストボディ | `req *CreateUserRequest` |
| `*struct`（フォーム DTO） | フォームのテキストフィールド | `form *CreatePostForm` |
| `multipart.UploadedFiles` | マルチパートでアップロードされたファイル | `files multipart.UploadedFiles` |
| `path.*` | パスパラメーター | `userId path.Int` |
| `spine.Ctx` | コントローラーコンテキスト | `spineCtx spine.Ctx` |

### サポートする戻り値の型

| 型 | 説明 |
|------|------|
| `httpx.Response[T]` | JSON または文字列のレスポンス（ステータスコード、ヘッダー、Cookie を含む） |
| `httpx.Redirect` | リダイレクトレスポンス |
| `error` | エラーレスポンス |
| `httpx.Binary` | バイト列のレスポンス |

レスポンス型へのポインターや、`(サポートするレスポンス型, error)` という組み合わせも使用できます。`httpx.Binary` は、`Content-Type` とバイト列のボディを指定する場合に使います。


## 入力を受け取る

### クエリパラメーター

`query.Values` でクエリ文字列を読み取ります。次のリクエストでは、`id` は `1`、`name` は `alice`、`active` は `true` です。

```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64, 기본값 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, 기본값 false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### query.Values のメソッド

| メソッド | 戻り値の型 | 説明 |
|--------|----------|------|
| `Get(key)` | `string` | 最初の値（存在しない場合は空文字列） |
| `String(key)` | `string` | 文字列の値 |
| `Int(key, default)` | `int64` | 値が存在しない、または整数に変換できない場合は指定したデフォルト値 |
| `GetBoolByKey(key, default)` | `bool` | 値が存在しない、または真偽値に変換できない場合は指定したデフォルト値 |
| `Has(key)` | `bool` | キーが存在するかどうか |


### ページネーション

`query.Pagination` は、`page` と `size` のクエリパラメーターを整数に変換します。値が存在しない、または整数に変換できない場合は、それぞれ `1` と `20` を使います。負の数や `0` も整数として扱うため、許容範囲はアプリで検証してください。

```go
// GET /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // page.Page = 2 (기본값: 1)
    // page.Size = 10 (기본값: 20)
    users, _ := c.service.List(ctx, page.Page, page.Size)
    return httpx.Response[[]UserResponse]{Body: users}
}
```


### HTTP ヘッダー

`header.Values` を使って HTTP ヘッダーにアクセスします。

```go
import "github.com/NARUBROWN/spine/pkg/header"

func (c *CommonController) CheckHeader(
    headers header.Values,
) httpx.Response[HeaderInfo] {
    return httpx.Response[HeaderInfo]{
        Body: HeaderInfo{
            UserAgent:   headers.Get("User-Agent"),
            ContentType: headers.Get("Content-Type"),
        },
    }
}
```

#### header.Values のメソッド

| メソッド | 戻り値の型 | 説明 |
|--------|----------|------|
| `Get(key)` | `string` | ヘッダーの値 |
| `Has(key)` | `bool` | ヘッダーが存在するかどうか |


### パスパラメーター

ルートパスのパラメーターを `path.Int`、`path.String`、`path.Boolean` で受け取ります。パスで宣言したパラメーターの順序と、ハンドラーの `path` 型パラメーターの順序が対応します。Go の変数名はパスパラメーター名と異なっていても構いません。

```go
// GET /user/:id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### path パッケージの構造体

```go
package path

type Int struct {
    Value int64
}

type String struct {
    Value string
}

type Boolean struct {
    Value bool
}
```


### JSON リクエストボディ

JSON リクエストボディを受け取る DTO は構造体へのポインターとして宣言し、フィールドに `json` タグを付けます。次の例では、`Content-Type: application/json` のリクエストにある `name` と `email` を `CreateUserRequest` にバインドし、HTTP 201 を返します。

DTO に `form` タグが一つでもあると、フォーム DTO に分類されます。実際のボディの解析はリクエストの `Content-Type` にも影響されるため、JSON とフォームのタグをリクエスト形式に合わせてください。

```go
// POST /user
// Body: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← 포인터로 선언
) httpx.Response[UserResponse] {
    user, _ := c.service.Create(ctx, req.Name, req.Email)
    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201,
        },
    }
}
```

```go
// src/user/user_request.go
type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}
```


### コントローラーコンテキスト `spine.Ctx`

インターセプターが `ctx.Set` で保存した値は、コントローラーから `spine.Ctx.Get` で取得します。コントローラーには読み取り機能だけが提供されます。次の例は `userRole` キーに文字列を保存したことを前提にしているため、実際のアプリでは保存側と読み取り側の型を合わせてください。

```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // 인터셉터에서 Set한 값 조회
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```


## レスポンスを返す


### 1. httpx.Response[T] で JSON と文字列のレスポンスを返す

`httpx.Response[T]` の `Body` にレスポンスボディを入れ、`Options` でステータスコード、ヘッダー、Cookie を設定します。ステータスコードを省略すると HTTP 200 を使います。

```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### 基本的な JSON レスポンス

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

    return httpx.Response[UserResponse]{
        Body: user,  // 200 OK (기본값)
    }
}
```

#### 文字列のレスポンス

```go
func (c *UserController) Health() httpx.Response[string] {
    return httpx.Response[string]{
        Body: "OK",
    }
}
```

#### ステータスコードを指定する

```go
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,
) httpx.Response[UserResponse] {
    user, _ := c.service.Create(ctx, req.Name, req.Email)

    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201, // Created
        },
    }
}
```

#### レスポンスヘッダーを追加する

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Headers: map[string]string{
                "X-Custom-Header": "custom-value",
                "Cache-Control":   "max-age=3600",
            },
        },
    }
}
```

#### Cookie を設定する

```go
func (c *AuthController) Login(
    ctx context.Context,
    req *LoginRequest,
) httpx.Response[LoginResponse] {
    token, refreshToken, _ := c.service.Login(ctx, req.Email, req.Password)

    return httpx.Response[LoginResponse]{
        Body: LoginResponse{Success: true},
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
                httpx.RefreshTokenCookie(refreshToken, 7*24*time.Hour),
            },
        },
    }
}
```

#### httpx.Cookie 構造体

```go
type Cookie struct {
    Name     string
    Value    string
    Path     string
    Domain   string
    MaxAge   int
    Expires  *time.Time
    HttpOnly bool
    Secure   bool
    SameSite SameSite  // SameSiteLax, SameSiteStrict, SameSiteNone
    Priority string    // "Low" | "Medium" | "High"
}
```

#### Cookie のヘルパー関数

| 関数 | 説明 |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | アクセストークンの Cookie を作成 |
| `httpx.RefreshTokenCookie(token, ttl)` | リフレッシュトークンの Cookie を作成 |
| `httpx.DefaultRefreshTokenCookie(token)` | 有効期間が 7 日間のリフレッシュトークンの Cookie を作成 |
| `httpx.ClearAccessTokenCookie()` | アクセストークンの Cookie を削除 |
| `httpx.ClearRefreshTokenCookie()` | リフレッシュトークンの Cookie を削除 |


### 2. httpx.Redirect でリダイレクトレスポンスを返す

`httpx.Redirect` を使うと、クライアントを別の URL にリダイレクトします。

#### 基本的なリダイレクト（302 Found）

```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.service.ProcessOAuthCode(ctx, code)

    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (기본값)
    }
}
```

#### ステータスコードを指定する

```go
import "net/http"

func (c *UserController) MovedPermanently() httpx.Redirect {
    return httpx.Redirect{
        Location: "/new-location",
        Options: httpx.ResponseOptions{
            Status: http.StatusMovedPermanently, // 301
        },
    }
}
```

#### リダイレクトと同時に Cookie を設定する

```go
func (c *AuthController) Login(
    ctx context.Context,
    req *LoginRequest,
) httpx.Redirect {
    token, _ := c.service.Login(ctx, req.Email, req.Password)

    return httpx.Redirect{
        Location: "/dashboard",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
            },
        },
    }
}
```

#### ログアウト（Cookie を削除してからリダイレクト）

```go
func (c *AuthController) Logout() httpx.Redirect {
    return httpx.Redirect{
        Location: "/login",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.ClearAccessTokenCookie(),
                httpx.ClearRefreshTokenCookie(),
            },
        },
    }
}
```


### 3. error でエラーレスポンスを返す {#error-response}

`httperr` でエラーを返すと、指定した HTTP ステータスコードと `message` フィールドを持つ JSON レスポンスを作成します。次の例では、サービスのエラーをユーザー取得の失敗として扱い、HTTP 404 を返します。実際のアプリではエラーの原因を区別し、適切なステータスコードに変換してください。

```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) error {
    _, err := c.service.Get(ctx, int(userId.Value))
    if err != nil {
        return httperr.NotFound("유저를 찾을 수 없습니다.")
    }
    return nil
}
```

#### httperr 関数

| 関数 | ステータスコード |
|------|----------|
| `httperr.BadRequest(msg)` | 400 |
| `httperr.Unauthorized(msg)` | 401 |
| `httperr.NotFound(msg)` | 404 |

この例のエラーレスポンスボディは次のとおりです。

```json
{
  "message": "유저를 찾을 수 없습니다."
}
```

#### httpx.Response[T] と error を組み合わせる

成功時のレスポンスとエラーを両方返すには、`(httpx.Response[T], error)` を使います。失敗した場合は空のレスポンス値とエラーを返し、成功した場合はボディのあるレスポンスと `nil` を返します。エラーがある場合、成功時のレスポンスボディは使いません。

```go
func (c *UserController) GetUser(
    ctx context.Context,
    userID path.Int,
) (httpx.Response[UserResponse], error) {
    user, err := c.service.Get(ctx, int(userID.Value))
    if err != nil {
        return httpx.Response[UserResponse]{}, httperr.NotFound("user not found")
    }
    return httpx.Response[UserResponse]{Body: user}, nil
}
```


### レスポンスの型を選ぶ

| 状況 | 推奨する戻り値の型 |
|------|---------------|
| JSON レスポンス（ステータスコード、ヘッダー、Cookie を含む） | `httpx.Response[T]` |
| 文字列のレスポンス | `httpx.Response[string]` |
| リダイレクト | `httpx.Redirect` |
| バイト列のボディと Content-Type を指定 | `httpx.Binary` |
| エラーのみを返す | `error` |


## フォーム DTO とマルチパートファイル

フォームのテキストフィールドは構造体へのポインターであるフォーム DTO で、アップロードファイルは `multipart.UploadedFiles` で受け取ります。この二つの型を同じハンドラーのパラメーターとして宣言すると、一つのリクエストでテキストとファイルを一緒に処理できます。

以下の例にある `PostController` と `FileController` は、自分で実装してコンストラクタとルートを登録する必要があります。以下の `curl` リクエストを実行するには `/posts` と `/upload` が登録されている必要があります。ファイルアップロードのリクエストでは、指定したパスに実際のファイルが必要です。

### 1. フォームのテキストフィールドを受け取る

フォーム DTO は、`multipart/form-data` または `application/x-www-form-urlencoded` のリクエストからテキストフィールドを受け取ります。DTO のフィールドに `form` タグでリクエストのフィールド名を指定します。

#### フォーム DTO を定義する

```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### ハンドラーを実装する

```go
func (c *PostController) Create(
    form *CreatePostForm, // Form DTO
) httpx.Response[string] {
    fmt.Println("Title  :", form.Title)
    fmt.Println("Content:", form.Content)

    return httpx.Response[string]{Body: "OK"}
}
```

#### リクエスト例（curl）

```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. アップロードファイルを受け取る

アップロードファイルは DTO のフィールドに入れず、独立した `multipart.UploadedFiles` パラメーターで受け取ります。次の例では、ファイルのフィールド名、ファイル名、サイズをログに出力します。

#### アップロードファイルの型

`github.com/NARUBROWN/spine/pkg/multipart` パッケージの型を使います。

```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### ハンドラーを実装する

```go
func (c *FileController) Upload(
    files multipart.UploadedFiles, // Multipart files
) httpx.Response[string] {
    fmt.Println("Files count:", len(files.Files))

    for _, f := range files.Files {
        fmt.Println(
            "field:", f.FieldName,
            "name:", f.Filename,
            "size:", f.Size,
        )
    }

    return httpx.Response[string]{Body: "OK"}
}
```

#### UploadedFile 構造体

```go
type UploadedFile struct {
    FieldName   string
    Filename    string
    ContentType string
    Size        int64
    Open        func() (io.ReadCloser, error)
}
```

#### リクエスト例（curl）

```bash
curl -X POST http://localhost:8080/upload \
  -F "file=@test1.png" \
  -F "file=@test2.jpg"
```

### 3. フォーム、ファイル、クエリを一緒に受け取る

同じハンドラーでフォーム DTO、アップロードファイル、ページネーションを一緒に受け取れます。次の例では各値を読み取って出力しますが、ファイルは保存しません。

#### ハンドラーを実装する

```go
func (c *PostController) Upload(
    ctx context.Context,
    form  *CreatePostForm,           // form fields
    files multipart.UploadedFiles,   // multipart files
    page  query.Pagination,          // query
) httpx.Response[string] {
    fmt.Println("[FORM] Title  :", form.Title)
    fmt.Println("[FORM] Content:", form.Content)

    fmt.Println("[QUERY] Page:", page.Page)
    fmt.Println("[QUERY] Size:", page.Size)

    fmt.Println("[FILES] Count:", len(files.Files))

    return httpx.Response[string]{Body: "OK"}
}
```

### 入力の型を区別する基準

JSON とフォームの DTO は、構造体へのポインターで受け取ります。クエリ、パス、アップロードファイルは、`query.Pagination`、`path.Int`、`multipart.UploadedFiles` のように Spine がサポートする値型で受け取ります。任意の構造体を値として宣言しても、自動的にバインドされるわけではありません。


## 入力エラーを処理する際の注意点

パスの値を整数に変換できない場合や、JSON ボディを解析できない場合は、コントローラーを呼び出す前に入力バインディングが失敗します。Spine v0.5.1 では、この失敗が必ず HTTP 400 に変換されるわけではありません。不正な JSON や整数ではないパスの値に対し、デフォルトの実行経路では HTTP 500 を返す場合があります。必要なエラーポリシーを実装し、実際のリクエストで確認してください。

## 次のステップ

- [チュートリアル: 依存性注入](/ja/learn/tutorial/3-dependency-injection) — コンストラクタの登録と依存性の解決
- [チュートリアル: インターセプター](/ja/learn/tutorial/4-interceptor) — リクエストの前後の処理
