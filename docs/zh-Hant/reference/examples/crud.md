# CRUD 範例

此範例使用 Controller、Service、Repository 與 Bun ORM 建立使用者 CRUD API。

```go
app.Constructor(NewDB, NewUserRepository, NewUserService, NewUserController)
app.Route("POST", "/users", (*UserController).Create)
app.Route("GET", "/users", (*UserController).List)
app.Route("GET", "/users/:id", (*UserController).Get)
app.Route("PUT", "/users/:id", (*UserController).Update)
app.Route("DELETE", "/users/:id", (*UserController).Delete)
```

控制器宣告處理器，Service 承載用例，Repository 負責資料存取。找不到使用者時回傳 `httperr.NotFound`；電子郵件重複時回傳 `httperr.BadRequest`。依賴關係透過建構函式表達，層級邊界保持清楚。
