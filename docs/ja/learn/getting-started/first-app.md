# 最初のアプリ

5分でユーザー照会APIを作成してみます。

## 完成イメージ


```bash
curl "http://localhost:8080/users?id=1"
```


```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```


## 1. プロジェクトの作成


```bash
mkdir hello-spine && cd hello-spine
go mod init hello-spine
go get github.com/NARUBROWN/spine
```


## 2. プロジェクトの構造

```
hello-spine/
├── main.go
├── controller/
│   └── user_controller.go
├── service/
│   └── user_service.go
└── routes/
    └── routes.go
```

## 3. コードの実装

### main.go


```go
package main

import (
    "log"
    "time"

    "hello-spine/controller"
    "hello-spine/routes"
    "hello-spine/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()

    // コンストラクタの登録 — 順序は関係ありません
    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    // ルートの登録
    routes.RegisterRoutes(app)

    // サーバーの起動
    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```

### service/user_service.go


```go
package service

// UserResponse レスポンス構造体
type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

// UserService ユーザーサービス
type UserService struct {
    // 実際にはRepositoryを注入しますが、ここでは簡単に実装します
}

func NewUserService() *UserService {
    return &UserService{}
}

// Get ユーザー照会 (ハードコードされたデータ)
func (s *UserService) Get(id int) (UserResponse, error) {
    // 実際にはDBから取得します
    users := map[int]UserResponse{
        1: {ID: 1, Name: "Alice", Email: "alice@example.com"},
        2: {ID: 2, Name: "Bob", Email: "bob@example.com"},
    }

    if user, ok := users[id]; ok {
        return user, nil
    }

    return UserResponse{}, nil
}
```

### controller/user_controller.go


```go
package controller

import (
    "context"

    "hello-spine/service"

    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/query"
)

type UserController struct {
    svc *service.UserService
}

// NewUserController コンストラクタ — パラメータがそのまま依存関係になります
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser ユーザー照会ハンドラー
// 関数のシグネチャがそのままAPIスペックになります
func (c *UserController) GetUser(
    ctx context.Context,
    q query.Values,
) (httpx.Response[service.UserResponse], error) {
    id := int(q.Int("id", 0))
    user, err := c.svc.Get(id)
    if err != nil {
        return httpx.Response[service.UserResponse]{}, err
    }
    return httpx.Response[service.UserResponse]{Body: user}, nil
}
```

### routes/routes.go


```go
package routes

import (
    "hello-spine/controller"

    "github.com/NARUBROWN/spine"
)

func RegisterRoutes(app spine.App) {
    app.Route("GET", "/users", (*controller.UserController).GetUser)
}
```

## 4. 実行


```bash
go run main.go
```

```
________       _____             
__  ___/__________(_)___________ 
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/ 
       /_/        
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## 5. テスト


```bash
# Aliceを照会
curl "http://localhost:8080/users?id=1"
```


```json
{"id":1,"name":"Alice","email":"alice@example.com"}
```


```bash
# Bobを照会
curl "http://localhost:8080/users?id=2"
```


```json
{"id":2,"name":"Bob","email":"bob@example.com"}
```

## 🎉 完成！

5分で最初のSpineアプリを作成しました。

### ここまで学んだこと

| コンセプトコード| （日本語に変更：コード）|------|------|
| アプリ作成 | `spine.New()` |
| 依存関係の登録 | `app.Constructor(...)` |
| ルート登録 | `app.Route("GET", "/users", ...)` |
| サーバー起動 | `app.Run(boot.Options{...})` |

### キーポイント

- **コンストラクタパラメータ = 依存関係の宣言** — アノテーションは不要
- **関数シグネチャ = APIスペック** — 入出力が明確
- **ルートを1箇所で管理** — 流れが見える

## 次のステップ

- [チュートリアル: プロジェクトの構造](/ja/learn/tutorial/1-project-structure) — 実際のプロジェクト構造の作成
- [チュートリアル: インターセプター](/ja/learn/tutorial/4-interceptor) — トランザクション、ロギングの追加
- [チュートリアル: データベース](/ja/learn/tutorial/5-database) — Bun ORMの接続