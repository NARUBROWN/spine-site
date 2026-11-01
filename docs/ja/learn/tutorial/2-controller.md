# コントローラー

CLI で生成した `hello-spine` にユーザー照会コントローラーを追加します。インストールとプロジェクト生成は[最初のアプリ](/ja/learn/getting-started/first-app)を参照してください。すでに `resource user` を生成している場合は、再生成せずにファイルを確認します。

## CLI でコントローラーを生成

```bash
spine generate resource user --dry-run
```

プレビューで生成ファイルと登録コードの変更を確認し、以下のコマンドで生成します。

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

生成された `src/user/user_controller.go` は次のとおりです。`UserService` と同じ `user` パッケージにあるため、別の `service` パッケージを import しません。

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
`resource` が生成するのは照会用の骨格です。データベース・ドメインモデル・DTO・CRUD 全体は実装しません。以下の入力・応答コードは、この骨格を手動で拡張する独立したハンドラー例です。`UserResponse`、リクエスト DTO、`UserService.Get/List/Create/Login` などは各例に合わせて実装してください。型は `src/user` の `package user` に置き、必要な標準・Spine パッケージを import します。同じ名前のメソッド例をまとめて貼り付けないでください。
:::

## ハンドラーのシグネチャ

Spineはハンドラーの関数シグネチャを分析して、入力を自動的にバインドします。

### サポートするパラメータタイプ

| タイプ | 説明 | 例 |
|------|------|------|
| `context.Context` | リクエストコンテキスト | `ctx context.Context` |
| `query.Values` | クエリパラメータ | `q query.Values` |
| `query.Pagination` | ページネーション | `page query.Pagination` |
| `header.Values` | HTTPヘッダー | `headers header.Values` |
| `*struct` (DTO) | JSONリクエスト本文 | `req *CreateUserRequest` |
| `*struct` (Form) | フォームデータ | `form *CreatePostForm` |
| `multipart.UploadedFiles` | マルチパートファイル | `files multipart.UploadedFiles` |
| `path.*` | パスパラメータ | `userId path.Int` |
| `spine.Ctx` | コントローラーコンテキスト | `spineCtx spine.Ctx` |

### サポートする戻り値のタイプ

| タイプ | 説明 |
|------|------|
| `httpx.Response[T]` | JSONまたは文字列の応答（ステータスコード、ヘッダー、Cookieを含む） |
| `httpx.Redirect` | リダイレクト応答 |
| `error` | エラー応答 |
| `httpx.Binary` | バイト応答 |

ポインタ応答と `(サポートされる応答型, error)` も使用できます。`httpx.Binary` は明示的な Content-Type とバイト列を返します。


## 入力の受け取り

### クエリパラメータ

`query.Values` を使用してクエリストリングを解析します。


```go
// GET /user?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[UserResponse] {
    id := q.Int("id", 0)                      // int64, デフォルト値 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, デフォルト値 false
    _ = name
    _ = active

    user, _ := c.service.Get(ctx, int(id))
    return httpx.Response[UserResponse]{Body: user}
}
```

#### query.Values メソッド

| メソッド | 戻り値のタイプ | 説明 |
|--------|----------|------|
| `Get(key)` | `string` | 最初の値（ない場合は空文字列） |
| `String(key)` | `string` | 文字列の値 |
| `Int(key, default)` | `int64` | 整数の値 |
| `GetBoolByKey(key, default)` | `bool` | ブール値 |
| `Has(key)` | `bool` | キーの存在有無 |


### ページネーション

`query.Pagination` を使用すると、 `page` と `size` クエリパラメータが自動的に解析されます。


```go
// GET /user?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]UserResponse] {
    // page.Page = 2 (デフォルト: 1)
    // page.Size = 10 (デフォルト: 20)
    users, _ := c.service.List(ctx, page.Page, page.Size)
    return httpx.Response[[]UserResponse]{Body: users}
}
```


### HTTPヘッダー

`header.Values` を使用してHTTPヘッダーにアクセスします。


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

#### header.Values メソッド

| メソッド | 戻り値のタイプ | 説明 |
|--------|----------|------|
| `Get(key)` | `string` | ヘッダーの値 |
| `Has(key)` | `bool` | ヘッダーの存在有無 |


### パスパラメータ

パスパラメータは宣言順に `path.Int`、`path.String`、`path.Boolean` にバインドされます。

`path` パッケージのタイプを使用して、ルートパスのパラメータをバインドします。


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


### JSONリクエスト本文

DTO はポインタで受け取ります。JSON/Form バインディングは DTO の `form` タグとリクエストの Content-Type で決まります。

DTO構造体をポインターとして宣言すると、自動的にJSONがバインドされます。


```go
// POST /user
// リクエスト本文: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,  // ← ポインターとして宣言
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


### コントローラーコンテキスト (spine.Ctx)

インターセプターから注入された値をコントローラーで参照する場合に `spine.Ctx` を使用します。


```go
import "github.com/NARUBROWN/spine/pkg/spine"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
    spineCtx spine.Ctx,
) httpx.Response[UserResponse] {
    // インターセプターで設定した値を取得
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }

    user, _ := c.service.Get(ctx, int(userId.Value))
    return httpx.Response[UserResponse]{Body: user}
}
```


## 応答の返却


### 1. httpx.Response[T] — JSON/文字列の応答

`httpx.Response[T]` を使用すると、ステータスコード、ヘッダー、Cookieを細かく制御できます。


```go
import "github.com/NARUBROWN/spine/pkg/httpx"
```

#### 基本的なJSON応答


```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[UserResponse] {
    user, _ := c.service.Get(ctx, int(userId.Value))

    return httpx.Response[UserResponse]{
        Body: user,  // 200 OK (デフォルト)
    }
}
```

#### 文字列の応答


```go
func (c *UserController) Health() httpx.Response[string] {
    return httpx.Response[string]{
        Body: "OK",
    }
}
```

#### ステータスコードの指定


```go
func (c *UserController) CreateUser(
    ctx context.Context,
    req *CreateUserRequest,
) httpx.Response[UserResponse] {
    user, _ := c.service.Create(ctx, req.Name, req.Email)

    return httpx.Response[UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201, // 作成成功
        },
    }
}
```

#### カスタムヘッダーの追加


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

#### Cookieの設定


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

#### Cookieヘルパー関数

| 関数 | 説明 |
|------|------|
| `httpx.AccessTokenCookie(token, ttl)` | Access TokenのCookie生成 |
| `httpx.RefreshTokenCookie(token, ttl)` | Refresh TokenのCookie生成 |
| `httpx.DefaultRefreshTokenCookie(token)` | 7日間のTTLのRefresh TokenのCookie |
| `httpx.ClearAccessTokenCookie()` | Access TokenのCookie削除 |
| `httpx.ClearRefreshTokenCookie()` | Refresh TokenのCookie削除 |


### 2. httpx.Redirect — リダイレクト応答

`httpx.Redirect` を使用して、クライアントを別のURLにリダイレクトします。

#### 基本的なリダイレクト (302 Found)


```go
func (c *AuthController) OAuthCallback(
    ctx context.Context,
    q query.Values,
) httpx.Redirect {
    code := q.String("code")
    c.service.ProcessOAuthCode(ctx, code)

    return httpx.Redirect{
        Location: "/dashboard",  // 302 Found (デフォルト)
    }
}
```

#### ステータスコードの指定


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

#### リダイレクトとともにCookieを設定


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

#### ログアウト (Cookieを削除してリダイレクト)


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


### 3. error — エラー応答

`httperr` パッケージを使用して、HTTPステータスコードとメッセージを返します。


```go
import "github.com/NARUBROWN/spine/pkg/httperr"

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) error {
    _, err := c.service.Get(ctx, int(userId.Value))
    if err != nil {
        return httperr.NotFound("ユーザーが見つかりません。")
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

エラー応答の形式:

```json
{
  "message": "ユーザーが見つかりません。"
}
```

#### httpx.Response[T] と error の併用

成功応答とエラーの両方を返すには `(httpx.Response[T], error)` を使います。サービスのエラーを `httperr` に変換し、成功時は nil エラーを返します。

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


### 応答方式の選択ガイド

| 状況 | 推奨される戻り値のタイプ |
|------|---------------|
| JSON応答 (ステータスコード/ヘッダー/Cookieを含む) | `httpx.Response[T]` |
| 文字列の応答 | `httpx.Response[string]` |
| リダイレクト | `httpx.Redirect` |
| エラーのみを返す | `error` |


## Form DTO および Multipart の使用

Spineでは、**Form DTO**、**Multipart**、およびこれらを一緒に使用する**定石パターン**をサポートしています。

Spineの主な原則は以下の通りです。

- DTOは必ず `*Struct` (ポインター) で受け取る
- 値タイプの `Struct` は意味タイプ (Semantic Type) である
- ファイルのアップロードはDTOではなく別の意味タイプで処理する
- Resolverは1つの意味のみを担当する

### 1. Form DTO の例 (multipart/form-data)

Form DTOは `multipart/form-data` または `application/x-www-form-urlencoded` リクエストで**テキストフィールドのみをバインド**するためのDTOです。

#### Form DTO の定義


```go
type CreatePostForm struct {
    Title   string `form:"title"`
    Content string `form:"content"`
}
```

#### Controller


```go
func (c *PostController) Create(
    form *CreatePostForm, // フォームDTO
) httpx.Response[string] {
    fmt.Println("Title  :", form.Title)
    fmt.Println("Content:", form.Content)

    return httpx.Response[string]{Body: "OK"}
}
```

#### リクエストの例 (curl)


```bash
curl -X POST http://localhost:8080/posts \
  -F "title=hello" \
  -F "content=spine"
```

### 2. Multipart ファイルのアップロード例

ファイルのアップロードは**DTOではなく意味タイプ**で処理します。

#### Multipart の意味タイプ

`github.com/NARUBROWN/spine/pkg/multipart` パッケージのタイプを使用します。


```go
import "github.com/NARUBROWN/spine/pkg/multipart"
```

#### Controller


```go
func (c *FileController) Upload(
    files multipart.UploadedFiles, // マルチパートファイル
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

#### リクエストの例 (curl)


```bash
curl -X POST http://localhost:8080/upload \
  -F "file=@test1.png" \
  -F "file=@test2.jpg"
```

### 3. Form DTO + Multipart + Query の併用

#### Controller


```go
func (c *PostController) Upload(
    ctx context.Context,
    form  *CreatePostForm,           // フォームフィールド
    files multipart.UploadedFiles,   // マルチパートファイル
    page  query.Pagination,          // クエリパラメータ
) httpx.Response[string] {
    fmt.Println("[FORM] Title  :", form.Title)
    fmt.Println("[FORM] Content:", form.Content)

    fmt.Println("[QUERY] Page:", page.Page)
    fmt.Println("[QUERY] Size:", page.Size)

    fmt.Println("[FILES] Count:", len(files.Files))

    return httpx.Response[string]{Body: "OK"}
}
```

### 4. Spine DTO ルールのまとめ

```
*Struct  → DTO (JSON / Form)
 Struct  → 意味タイプ (Query / Path / Multipart)
```

このルールに従うことで、実行フローがシグネチャにそのまま表れます。


## 自動登録と手動での拡張

CLI は `src/user/user_route.go` を生成し、`BuildApplication()` にエラーを確認する `user.Register(app)` 呼び出しを追加します。以下は生成結果の説明です。同じ登録を追加しないでください。

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

新しいハンドラーを実装したら、`user_route.go` の `Register` にルートを追加します。他のパッケージのコントローラーは、それぞれの登録関数で組み立てます。`main.go` は生成された `BuildApplication → Validate → Run` の流れを保ちます。

## 検証と実行

```bash
spine doctor
spine contract check
spine verify
spine dev
```

```bash
curl http://localhost:8080/user/1
```

契約・ローカル検証と、実際の HTTP 応答をそれぞれ確認します。生成された `GET /user/1` の応答は `{"id":1}` です。実際のユーザー照会や永続化は行いません。

## 要点のまとめ

| 概念 | 説明 |
|------|------|
| **アノテーションなし** | 純粋なGo構造体とメソッド |
| **コンストラクタ = 依存関係** | パラメータがそのまま依存関係の宣言 |
| **シグネチャ = APIスペック** | 入力/出力のタイプが明示的 |
| **自動バインディング** | query、JSON本文、ヘッダーを自動解析 |
| **httpx.Response[T]** | ステータスコード、ヘッダー、Cookieの制御 |
| **httpx.Redirect** | リダイレクト応答 |


## 次のステップ

- [チュートリアル: 依存関係の注入](/ja/learn/tutorial/3-dependency-injection) — DIの動作原理
- [チュートリアル: インターセプター](/ja/learn/tutorial/4-interceptor) — リクエストの前/後処理
