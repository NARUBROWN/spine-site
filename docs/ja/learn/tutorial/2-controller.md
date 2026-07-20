# コントローラー

Spineでのコントローラーの作成方法。


## コントローラーとは？

コントローラーはHTTPリクエストを受け取り、サービスに委譲するレイヤーです。

Spineのコントローラーは**純粋なGo構造体**です。アノテーションも、デコレーターも、特別なインターフェースの実装も必要ありません。


```go
// これがすべてです
type UserController struct {
    svc *service.UserService
}
```

## 基本構造

### 1. 構造体の定義


```go
package controller

type UserController struct {
    svc *service.UserService  // 依存関係
}
```

### 2. コンストラクタの作成


```go
// コンストラクタのパラメータ = 依存関係の宣言
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 3. ハンドラーメソッドの作成


```go
// 関数シグネチャがそのままAPIスペックになります
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    return httpx.Response[dto.UserResponse]{Body: user}
}
```

### 4. ルートの登録


```go
app.Route("GET", "/users/:id", (*UserController).GetUser)
```


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


## 入力の受け取り

### クエリパラメータ

`query.Values` を使用してクエリストリングを解析します。


```go
// GET /users?id=1&name=alice&active=true

func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) httpx.Response[dto.UserResponse] {
    id := q.Int("id", 0)                      // int64, デフォルト値 0
    name := q.String("name")                  // string
    active := q.GetBoolByKey("active", false) // bool, デフォルト値 false
    
    user, _ := c.svc.Get(ctx, int(id))
    return httpx.Response[dto.UserResponse]{Body: user}
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
// GET /users?page=2&size=10

func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]dto.UserResponse] {
    // page.Page = 2 (デフォルト: 1)
    // page.Size = 10 (デフォルト: 20)
    users, _ := c.svc.List(ctx, page.Page, page.Size)
    return httpx.Response[[]dto.UserResponse]{Body: users}
}
```


### HTTPヘッダー

`header.Values` を使用してHTTPヘッダーにアクセスします。


```go
import "github.com/NARUBROWN/spine/pkg/header"

func (c *CommonController) CheckHeader(
    headers header.Values,
) httpx.Response[dto.HeaderInfo] {
    return httpx.Response[dto.HeaderInfo]{
        Body: dto.HeaderInfo{
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

`path` パッケージのタイプを使用して、ルートパスのパラメータをバインドします。


```go
// GET /users/:id

func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
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

DTO構造体をポインターとして宣言すると、自動的にJSONがバインドされます。


```go
// POST /users
// リクエスト本文: {"name": "Alice", "email": "alice@example.com"}

func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,  // ← ポインターとして宣言
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: 201,
        },
    }
}
```


```go
// dto/user_request.go
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
) httpx.Response[dto.UserResponse] {
    // インターセプターで設定した値を取得
    if v, ok := spineCtx.Get("userRole"); ok {
        role := v.(string)
        // ...
    }
    
    user, _ := c.svc.Get(ctx, int(userId.Value))
    return httpx.Response[dto.UserResponse]{Body: user}
}
```


## 応答の返却

Spineは `httpx.Response[T]`、 `httpx.Redirect`、 `error` の3つの戻り値のタイプをサポートしています。

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
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    
    return httpx.Response[dto.UserResponse]{
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
    req *dto.CreateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    
    return httpx.Response[dto.UserResponse]{
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
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Get(ctx, int(userId.Value))
    
    return httpx.Response[dto.UserResponse]{
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
    req *dto.LoginRequest,
) httpx.Response[dto.LoginResponse] {
    token, refreshToken, _ := c.svc.Login(ctx, req.Email, req.Password)
    
    return httpx.Response[dto.LoginResponse]{
        Body: dto.LoginResponse{Success: true},
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
    c.svc.ProcessOAuthCode(ctx, code)
    
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
    req *dto.LoginRequest,
) httpx.Redirect {
    token, _ := c.svc.Login(ctx, req.Email, req.Password)
    
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
    _, err := c.svc.Get(ctx, int(userId.Value))
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

エラー処理が必要な場合、`httpx.Response[T]` の中でステータスコードとして処理するか、別のエラーハンドラーメソッドを作成できます。


```go
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{
                Status: 404,
            },
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
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


## ルートの登録

コントローラーのメソッドをルートに接続します。


```go
// routes/user_routes.go
package routes

import (
    "my-app/controller"
    "github.com/NARUBROWN/spine"
)

func RegisterUserRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).ListUsers)
    app.Route("GET", "/users/:id", (*controller.UserController).GetUser)
    app.Route("POST", "/users", (*controller.UserController).CreateUser)
    app.Route("PUT", "/users/:id", (*controller.UserController).UpdateUser)
    app.Route("DELETE", "/users/:id", (*controller.UserController).DeleteUser)
}
```


```go
// main.go
func main() {
    app := spine.New()
    app.Constructor(/* ... */)
    routes.RegisterUserRoutes(app)
    app.Run(boot.Options{
        Address:                ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout:        10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    })
}
```


## 全体例


```go
// controller/user_controller.go
package controller

import (
    "context"
    "net/http"
    "time"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/path"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GET /users?page=1&size=20
func (c *UserController) ListUsers(
    ctx context.Context,
    page query.Pagination,
) httpx.Response[[]dto.UserResponse] {
    users, _ := c.svc.List(ctx, page.Page, page.Size)
    
    return httpx.Response[[]dto.UserResponse]{
        Body: users,
        Options: httpx.ResponseOptions{
            Headers: map[string]string{
                "X-Total-Count": "100",
            },
        },
    }
}

// GET /users/:id
func (c *UserController) GetUser(
    ctx context.Context,
    userId path.Int,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Get(ctx, int(userId.Value))
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
}

// POST /users
func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, _ := c.svc.Create(ctx, req.Name, req.Email)
    
    return httpx.Response[dto.UserResponse]{
        Body: user,
        Options: httpx.ResponseOptions{
            Status: http.StatusCreated, // 201
        },
    }
}

// PUT /users/:id
func (c *UserController) UpdateUser(
    ctx context.Context,
    userId path.Int,
    req *dto.UpdateUserRequest,
) httpx.Response[dto.UserResponse] {
    user, err := c.svc.Update(ctx, int(userId.Value), req.Name)
    if err != nil {
        return httpx.Response[dto.UserResponse]{
            Options: httpx.ResponseOptions{Status: 404},
        }
    }
    
    return httpx.Response[dto.UserResponse]{Body: user}
}

// DELETE /users/:id
func (c *UserController) DeleteUser(
    ctx context.Context,
    userId path.Int,
) error {
    return c.svc.Delete(ctx, int(userId.Value))
}
```


```go
// controller/auth_controller.go
package controller

import (
    "context"
    "time"
    
    "my-app/dto"
    "my-app/service"
    
    "github.com/NARUBROWN/spine/pkg/httpx"
)

type AuthController struct {
    svc *service.AuthService
}

func NewAuthController(svc *service.AuthService) *AuthController {
    return &AuthController{svc: svc}
}

// POST /auth/login
func (c *AuthController) Login(
    ctx context.Context,
    req *dto.LoginRequest,
) httpx.Redirect {
    token, _ := c.svc.Login(ctx, req.Email, req.Password)
    
    return httpx.Redirect{
        Location: "/dashboard",
        Options: httpx.ResponseOptions{
            Cookies: []httpx.Cookie{
                httpx.AccessTokenCookie(token, 15*time.Minute),
            },
        },
    }
}

// POST /auth/logout
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
