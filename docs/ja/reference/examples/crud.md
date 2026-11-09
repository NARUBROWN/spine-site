# ユーザー CRUD API を作る

::: info
この例では `v0.7.1` のコントローラーコールバックとパス入力を使います。互換性は[ルートの移行](/ja/learn/migration/preview-controller-routes)と[入力の移行](/ja/learn/migration/v0.7.1-preview)、文書設定は [OpenAPI](/ja/reference/api/openapi)を参照してください。
:::

ユーザーの作成、一覧取得、個別取得、更新、削除を行う HTTP API を作ります。ORM を使わずメモリ上のストアを使用するため、データベースを用意せずに実行できます。

## 事前準備

先に [CLI のインストール](/ja/learn/getting-started/installation)を完了してください。CLI `v0.4.3-rc.1` 以降でアプリを作成し、CRUD コードを手動で追加します。`resource` は GET のひな形、`slice --storage memory` は作成と取得のひな形を生成します。

保存したユーザーは、サーバープロセスを終了すると失われます。

リクエストはコントローラー、サービス、リポジトリの順に渡されます。各コンポーネントの役割は次のとおりです。

```mermaid
graph TD
    Controller["コントローラー<br/>意味型で入力を受け取る<br/>入力検証とエラー変換<br/>サービスの呼び出し"]

    Service["サービス<br/>業務ルールの適用<br/>リポジトリの呼び出し"]

    Repository["リポジトリ<br/>メモリ上のデータの取得と変更"]

    Controller --> Service
    Service --> Repository
```

## 1. プロジェクトを作成する

基本アプリを作成し、依存関係とプロジェクト設定を確認します。以降のコマンドは `crud-example/` で実行します。

以下のコマンドは正式依存関係チャンネルを選びます。互換性のある正式プラットフォームタグがない場合は検証に `--channel rc` を使い、選択されたバージョンを `go.mod` で確認してください。

```sh
spine new crud-example --layout legacy --module example.com/crud-example --channel main --no-interactive
cd crud-example
spine doctor
```

### ファイル構成

以降の手順で `src/` 以下に 5 つのファイルを追加し、生成された `internal/application/application.go` を置き換えます。ルートの `main.go` と `spine.toml` はそのまま使用します。

```text
crud-example/
├── go.mod
├── go.sum
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    ├── model/user.go
    ├── repository/user_repository.go
    ├── dto/user_dto.go
    ├── service/user_service.go
    └── controller/user_controller.go
```

## 2. ユーザーモデルを追加する

`src/model/user.go` を新規作成します。ユーザー情報と作成日時、更新日時を保存する構造体です。

```go
// src/model/user.go
package model

import "time"

type User struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

## 3. メモリ上のリポジトリを追加する

`src/repository/user_repository.go` を新規作成します。ユーザーの取得、保存、削除を担当し、メールアドレスの重複を確認する関数を提供します。

```go
// src/repository/user_repository.go
package repository

import (
    "errors"
    "sync"
    "time"

    "example.com/crud-example/src/model"
)

var (
    ErrUserNotFound      = errors.New("user not found")
    ErrEmailAlreadyExists = errors.New("email already exists")
)

type UserRepository struct {
    mu      sync.RWMutex
    users   map[int64]*model.User
    counter int64
}

func NewUserRepository() *UserRepository {
    return &UserRepository{
        users:   make(map[int64]*model.User),
        counter: 0,
    }
}

func (r *UserRepository) FindAll() []*model.User {
    r.mu.RLock()
    defer r.mu.RUnlock()

    result := make([]*model.User, 0, len(r.users))
    for _, user := range r.users {
        result = append(result, user)
    }
    return result
}

func (r *UserRepository) FindByID(id int64) (*model.User, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()

    user, ok := r.users[id]
    if !ok {
        return nil, ErrUserNotFound
    }
    return user, nil
}

func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()

    for _, user := range r.users {
        if user.Email == email {
            return user, nil
        }
    }
    return nil, ErrUserNotFound
}

func (r *UserRepository) ExistsByEmail(email string) bool {
    _, err := r.FindByEmail(email)
    return err == nil
}

func (r *UserRepository) Save(user *model.User) *model.User {
    r.mu.Lock()
    defer r.mu.Unlock()

    now := time.Now()

    if user.ID == 0 {
        r.counter++
        user.ID = r.counter
        user.CreatedAt = now
    }
    user.UpdatedAt = now

    r.users[user.ID] = user
    return user
}

func (r *UserRepository) Delete(id int64) error {
    r.mu.Lock()
    defer r.mu.Unlock()

    if _, ok := r.users[id]; !ok {
        return ErrUserNotFound
    }

    delete(r.users, id)
    return nil
}

func (r *UserRepository) Count() int {
    r.mu.RLock()
    defer r.mu.RUnlock()
    return len(r.users)
}
```

## 4. リクエストとレスポンスの DTO を追加する

`src/dto/user_dto.go` を新規作成します。リクエストで受け取るフィールドとレスポンスで返すフィールドを定義し、リポジトリのユーザーモデルをレスポンス DTO に変換します。

```go
// src/dto/user_dto.go
package dto

import (
    "time"

    "example.com/crud-example/src/model"
)

// リクエスト DTO

type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

type UpdateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

// レスポンス DTO

type UserResponse struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type UserListResponse struct {
    Users []UserResponse `json:"users"`
    Total int            `json:"total"`
}

// 変換関数

func ToUserResponse(user *model.User) UserResponse {
    return UserResponse{
        ID:        user.ID,
        Name:      user.Name,
        Email:     user.Email,
        CreatedAt: user.CreatedAt,
        UpdatedAt: user.UpdatedAt,
    }
}

func ToUserListResponse(users []*model.User) UserListResponse {
    responses := make([]UserResponse, len(users))
    for i, user := range users {
        responses[i] = ToUserResponse(user)
    }
    return UserListResponse{
        Users: responses,
        Total: len(responses),
    }
}
```

## 5. ユーザーサービスを追加する

`src/service/user_service.go` を新規作成します。作成と更新の前にメールアドレスの重複を確認し、リポジトリの戻り値をレスポンス DTO に変換します。

```go
// src/service/user_service.go
package service

import (
    "example.com/crud-example/src/dto"
    "example.com/crud-example/src/model"
    "example.com/crud-example/src/repository"
)

type UserService struct {
    repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
    return &UserService{repo: repo}
}

func (s *UserService) GetAllUsers() dto.UserListResponse {
    users := s.repo.FindAll()
    return dto.ToUserListResponse(users)
}

func (s *UserService) GetUserByID(id int64) (*dto.UserResponse, error) {
    user, err := s.repo.FindByID(id)
    if err != nil {
        return nil, err
    }

    response := dto.ToUserResponse(user)
    return &response, nil
}

func (s *UserService) CreateUser(req *dto.CreateUserRequest) (*dto.UserResponse, error) {
    // メールアドレスの重複をチェック
    if s.repo.ExistsByEmail(req.Email) {
        return nil, repository.ErrEmailAlreadyExists
    }

    user := &model.User{
        Name:  req.Name,
        Email: req.Email,
    }

    saved := s.repo.Save(user)
    response := dto.ToUserResponse(saved)
    return &response, nil
}

func (s *UserService) UpdateUser(id int64, req *dto.UpdateUserRequest) (*dto.UserResponse, error) {
    user, err := s.repo.FindByID(id)
    if err != nil {
        return nil, err
    }

    // メールアドレス変更時の重複をチェック
    if req.Email != user.Email && s.repo.ExistsByEmail(req.Email) {
        return nil, repository.ErrEmailAlreadyExists
    }

    user.Name = req.Name
    user.Email = req.Email

    saved := s.repo.Save(user)
    response := dto.ToUserResponse(saved)
    return &response, nil
}

func (s *UserService) DeleteUser(id int64) error {
    return s.repo.Delete(id)
}
```

## 6. ユーザーコントローラーを追加する

`src/controller/user_controller.go` を新規作成します。入力値を検証してからサービスを呼び出し、ユーザーが見つからない場合とメールアドレスが重複する場合を HTTP エラーに変換します。

```go
// src/controller/user_controller.go
package controller

import (
    "errors"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/input"

    "example.com/crud-example/src/dto"
    "example.com/crud-example/src/repository"
    "example.com/crud-example/src/service"
)

type UserController struct {
    service *service.UserService
}

func (*UserController) Constructor(service *service.UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) RegisterRoutes(r *api.Registry) {
    r.GET("/users", c.List)
    r.GET("/users/:id", c.GetByID)
    r.POST("/users", c.Create)
    r.PUT("/users/:id", c.Update)
    r.DELETE("/users/:id", c.Delete)
}

// GET /users
func (c *UserController) List() httpx.Response[dto.UserListResponse] {
    return httpx.Response[dto.UserListResponse]{Body: c.service.GetAllUsers()}
}

// GET /users/:id
func (c *UserController) GetByID(id input.Path[int64]) (httpx.Response[dto.UserResponse], error) {
    if *id <= 0 {
        return httpx.Response[dto.UserResponse]{}, httperr.BadRequest("유효하지 않은 사용자 ID입니다")
    }

    user, err := c.service.GetUserByID(*id)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, toHTTPError(err)
    }

    return httpx.Response[dto.UserResponse]{Body: *user}, nil
}

// POST /users
func (c *UserController) Create(req *dto.CreateUserRequest) (httpx.Response[dto.UserResponse], error) {
    if req.Name == "" {
        return httpx.Response[dto.UserResponse]{}, httperr.BadRequest("이름은 필수입니다")
    }
    if req.Email == "" {
        return httpx.Response[dto.UserResponse]{}, httperr.BadRequest("이메일은 필수입니다")
    }

    user, err := c.service.CreateUser(req)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, toHTTPError(err)
    }

    return httpx.Response[dto.UserResponse]{Body: *user}, nil
}

// PUT /users/:id
func (c *UserController) Update(id input.Path[int64], req *dto.UpdateUserRequest) (httpx.Response[dto.UserResponse], error) {
    if *id <= 0 {
        return httpx.Response[dto.UserResponse]{}, httperr.BadRequest("유효하지 않은 사용자 ID입니다")
    }
    if req.Name == "" {
        return httpx.Response[dto.UserResponse]{}, httperr.BadRequest("이름은 필수입니다")
    }
    if req.Email == "" {
        return httpx.Response[dto.UserResponse]{}, httperr.BadRequest("이메일은 필수입니다")
    }

    user, err := c.service.UpdateUser(*id, req)
    if err != nil {
        return httpx.Response[dto.UserResponse]{}, toHTTPError(err)
    }

    return httpx.Response[dto.UserResponse]{Body: *user}, nil
}

// DELETE /users/:id
func (c *UserController) Delete(id input.Path[int64]) error {
    if *id <= 0 {
        return httperr.BadRequest("유효하지 않은 사용자 ID입니다")
    }

    err := c.service.DeleteUser(*id)
    if err != nil {
        return toHTTPError(err)
    }

    return nil
}

// Repository のエラーを HTTP エラーに変換
func toHTTPError(err error) error {
    switch {
    case errors.Is(err, repository.ErrUserNotFound):
        return httperr.NotFound("사용자를 찾을 수 없습니다")
    case errors.Is(err, repository.ErrEmailAlreadyExists):
        return httperr.BadRequest("이미 사용 중인 이메일입니다")
    default:
        return err
    }
}
```

## 7. コンストラクタとルートを登録する

`internal/application/application.go` 全体を次のコードに置き換えます。リポジトリ、サービス、コントローラーのコンストラクタを登録し、5 つのルートを接続します。生成されたルートの `main.go` は、`BuildApplication`、`Validate`、`Run` を順に実行します。

```go
// internal/application/application.go
package application

import (
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "time"

    "example.com/crud-example/src/controller"
    "example.com/crud-example/src/repository"
    "example.com/crud-example/src/service"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
)

func BuildApplication() (spine.App, boot.Options, error) {
    app := spine.New(echoplatform.Option())
    app.Constructor(
        repository.NewUserRepository,
        service.NewUserService,
        constructor.Controller(&controller.UserController{}),
    )

    corsInterceptor, err := cors.NewValidated(cors.Config{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowHeaders: []string{"Content-Type"},
    })
    if err != nil {
        return nil, boot.Options{}, err
    }
    app.InterceptorFor(boot.InterceptorHTTP, corsInterceptor)

    return app, boot.Options{
        Address: ":8080",
        EnableGracefulShutdown: true,
        ShutdownTimeout: 10 * time.Second,
        HTTP: &boot.HTTPOptions{},
    }, nil
}
```

## 8. 検証してサーバーを起動する

プロジェクトルートでコードの書式を整え、依存関係とコードを検査してからサーバーを起動します。

```sh
gofmt -w src internal/application
go mod tidy
go mod download all
spine contract check
spine verify
spine dev
```

`contract check` は静的な契約を検査します。`verify` は静的な契約に加え、gofmt、go vet、Go テストを検査します。サーバーが実際にリクエストを処理するかは、次の HTTP リクエストで確認します。

## 9. HTTP リクエストで CRUD を確認する

サーバーを起動した状態で別のターミナルを開き、以下のリクエストを順に送信します。新しく起動したサーバーで最初のユーザーの ID は `1` です。レスポンスの日付は例であり、実際の作成日時と更新日時によって異なります。

### ユーザーの作成

名前とメールアドレスを送信すると、HTTP 200 と作成したユーザー情報が返されます。

```bash
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "홍길동", "email": "hong@example.com"}'
```

```json
{
  "id": 1,
  "name": "홍길동",
  "email": "hong@example.com",
  "created_at": "2025-01-19T10:00:00Z",
  "updated_at": "2025-01-19T10:00:00Z"
}
```

### ユーザー一覧の取得

先ほど作成したユーザーが `users` に含まれ、`total` が `1` であることを確認します。

```bash
curl http://localhost:8080/users
```

```json
{
  "users": [
    {
      "id": 1,
      "name": "홍길동",
      "email": "hong@example.com",
      "created_at": "2025-01-19T10:00:00Z",
      "updated_at": "2025-01-19T10:00:00Z"
    }
  ],
  "total": 1
}
```

### ユーザーの取得

ID が `1` のユーザー情報を取得します。

```bash
curl http://localhost:8080/users/1
```

```json
{
  "id": 1,
  "name": "홍길동",
  "email": "hong@example.com",
  "created_at": "2025-01-19T10:00:00Z",
  "updated_at": "2025-01-19T10:00:00Z"
}
```

### ユーザーの更新

名前とメールアドレスを一緒に送信します。レスポンスで 2 つのフィールドと `updated_at` が変更されたことを確認します。

```bash
curl -X PUT http://localhost:8080/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "홍길동(수정)", "email": "hong2@example.com"}'
```

```json
{
  "id": 1,
  "name": "홍길동(수정)",
  "email": "hong2@example.com",
  "created_at": "2025-01-19T10:00:00Z",
  "updated_at": "2025-01-19T10:05:00Z"
}
```

### ユーザーの削除

ID が `1` のユーザーを削除します。削除した ID で再度取得すると、HTTP 404 が返されます。

```bash
curl -X DELETE http://localhost:8080/users/1
```

### 存在しないユーザーと重複するメールアドレス

リポジトリに存在しない ID を取得すると、HTTP 404 と次のエラーメッセージが返されます。

```bash
# 存在しないユーザー
curl http://localhost:8080/users/999
```

```json
{
  "message": "사용자를 찾을 수 없습니다"
}
```

前の手順でユーザーを削除したため、まず同じメールアドレスのユーザーを再作成します。最初のリクエストは HTTP 200 で成功し、続けて同じメールアドレスで作成する 2 回目のリクエストは、HTTP 400 と重複エラーを返します。

```bash
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "홍길동", "email": "hong@example.com"}'
# メールアドレスの重複
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "김철수", "email": "hong@example.com"}'
```

```json
{
  "message": "이미 사용 중인 이메일입니다"
}
```

## 実装で確認する点

### 意味型でリクエストの値を受け取る

コントローラーは HTTP リクエストオブジェクトの代わりに、`input.Path[int64]` などの意味型を引数として受け取ります。エラーは `httperr` で表現します。

```go
// 意味を持つ型で入力を受け取る
func (c *UserController) GetByID(id input.Path[int64]) (httpx.Response[dto.UserResponse], error)

// httperr でエラーの意味だけを表現
return httpx.Response[dto.UserResponse]{}, httperr.NotFound("사용자를 찾을 수 없습니다")
```

### 依存性注入

登録したコンストラクタの引数の型をもとに、リポジトリ、サービス、コントローラーの依存関係を接続します。

```go
// コンストラクターを登録するだけで依存関係を自動解決
app.Constructor(
    repository.NewUserRepository,  // 依存関係なし
    service.NewUserService,        // Repository に依存
    constructor.Controller(&controller.UserController{}),  // Service に依存
)
```

### コンポーネントごとの責務

| コンポーネント | 責務 | 使用するコンポーネント |
|-------|------|------|
| コントローラー | 入力検証、HTTP エラーへの変換 | サービス |
| サービス | メールアドレスの重複確認、レスポンス DTO への変換 | リポジトリ |
| リポジトリ | メモリ上のデータの取得と変更 | なし |

## 次のステップ

データを永続的に保存するには、[データベース接続](/ja/learn/tutorial/5-database)に従ってリポジトリを変更してください。エラー処理を詳しく確認するには、[エラー処理のチュートリアル](/ja/learn/tutorial/7-error-handling)を参照してください。
