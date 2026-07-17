# 第一個應用程式

5 分鐘內建立使用者查詢 API。

## 完成的外觀

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

## 1.建立項目

```bash
mkdir hello-spine && cd hello-spine
go mod init hello-spine
go get github.com/NARUBROWN/spine
```

## 2. 專案結構

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

## 3.寫程式碼

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

    // 註冊建構函數－以任何順序
    app.Constructor(
        service.NewUserService,
        controller.NewUserController,
    )

    // 路線登記
    routes.RegisterRoutes(app)

    // 啟動伺服器
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

### 服務/user_service.go

```go
package service

// UserResponse 響應結構
type UserResponse struct {
    ID    int    `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

// 用戶服務 用戶服務
type UserService struct {
    // 實際上，Repository是被注入的，但這裡只是簡單地實現了。
}

func NewUserService() *UserService {
    return &UserService{}
}

// 取得用戶查找（硬編碼資料）
func (s *UserService) Get(id int) (UserResponse, error) {
    // 其實去DB查一下
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

### 控制器/user_controller.go

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

// NewUserController 建構函數 — 參數是依賴項
func NewUserController(svc *service.UserService) *UserController {
    return &UserController{svc: svc}
}

// GetUser 使用者尋找處理程序
// 函數簽名是API規範
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

### 路線/routes.go

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

## 4. 運行

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

## 5. 測試

```bash
# 愛麗絲查找
curl "http://localhost:8080/users?id=1"
```

```json
{"id":1,"name":"Alice","email":"alice@example.com"}
```

```bash
# 鮑伯·查找
curl "http://localhost:8080/users?id=2"
```

```json
{"id":2,"name":"Bob","email":"bob@example.com"}
```

## 🎉 完成！

我在 5 分鐘內創建了我的第一個 Spine 應用程式。

### 到目前為止我學到了什麼

|概念|代碼|
|------|------|
|建立應用程式 | `spine.New()` | `spine.New()`
|註冊依賴項 | `app.Constructor(...)` | `app.Constructor(...)`
|路線登記| `app.Route("GET", "/users", ...)` | `app.Route("GET", "/users", ...)`
|啟動伺服器 | `app.Run(boot.Options{...})` | `app.Run(boot.Options{...})`

### 要點

- **建構子參數 = 依賴宣告** — 無需註釋
- **函數簽章=API規格** — 輸入輸出清晰
- **在一處進行路線管理** — 查看流程

## 後續步驟

- [教學：專案結構](/zh-Hant/learn/tutorial/1-project-structure) — 取得實際的專案結構
- [教學：攔截器](/zh-Hant/learn/tutorial/4-interceptor) — 新增交易和日誌記錄
- [教學：資料庫](/zh-Hant/learn/tutorial/5-database) — 連接 Bun ORM