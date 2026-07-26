# 트랜잭션 관리

Spine에서 트랜잭션 처리하기.

## 개요

Spine은 **인터셉터 기반**으로 트랜잭션을 관리합니다.

```
Request
   │
   ├─→ TxInterceptor.PreHandle      // 트랜잭션 시작
   │
   ├─→ Controller → Service → Repository
   │
   └─→ TxInterceptor.AfterCompletion // 커밋 또는 롤백
   
Response
```

- 성공 시 → 자동 커밋
- 에러 시 → 자동 롤백

## TxInterceptor 구현

```go
// interceptor/tx_interceptor.go
package interceptor

import (
    "errors"

    "github.com/NARUBROWN/spine/core"
    "github.com/uptrace/bun"
)

type TxInterceptor struct {
    db *bun.DB
}

// 생성자 — DB 의존성 주입
func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

// PreHandle — 트랜잭션 시작
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    if reqCtx == nil {
        return errors.New("execution context has no request context")
    }

    // 트랜잭션 시작
    tx, err := i.db.BeginTx(reqCtx, nil)
    if err != nil {
        return err
    }

    // ExecutionContext에 저장
    ctx.Set("tx", tx)
    return nil
}

// PostHandle — 아무것도 안 함
func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

// AfterCompletion — 커밋 또는 롤백
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }

    // 에러 여부에 따라 롤백/커밋
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

## 등록

```go
// main.go
func main() {
    app := spine.New()

    // 1. 생성자 등록
    app.Constructor(
        NewDB,
        interceptor.NewTxInterceptor,
        repository.NewUserRepository,
        service.NewUserService,
        controller.NewUserController,
    )

    // 2. 인터셉터 등록 (타입 참조)
    app.Interceptor(
        (*interceptor.TxInterceptor)(nil),
    )

    routes.RegisterUserRoutes(app)
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

## bun.IDB 인터페이스

트랜잭션을 Repository에서 사용하려면 `bun.IDB` 인터페이스가 핵심입니다.

### 문제

```go
// ❌ *bun.DB만 받으면 트랜잭션 사용 불가
type UserRepository struct {
    db *bun.DB
}
```

### 해결

```go
// ✅ *bun.DB와 bun.Tx는 모두 bun.IDB를 구현
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}
```

### bun.IDB란?

| 타입 | bun.IDB 구현 |
|------|-------------|
| `*bun.DB` | ✅ |
| `bun.Tx` | ✅ |

동일한 메서드(`NewSelect`, `NewInsert` 등)를 사용할 수 있습니다.


## 트랜잭션 흐름

### 성공 시

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ spineCtx.Get("tx") → bun.IDB
   └─→ Service.Create(ctx, tx, ...)
       └─→ Repository.Save(ctx, tx, ...)  // tx 사용
   └─→ return user, nil  ✓

3. TxInterceptor.AfterCompletion
   └─→ err == nil
   └─→ tx.Commit()  ✓
```

### 실패 시

```
1. TxInterceptor.PreHandle
   └─→ tx := db.BeginTx()
   └─→ ctx.Set("tx", tx)

2. Controller.CreateUser
   └─→ spineCtx.Get("tx") → bun.IDB
   └─→ Service.Create(ctx, tx, ...)
       └─→ Repository.Save(ctx, tx, ...)  // tx 사용
   └─→ return error  ✗

3. TxInterceptor.AfterCompletion
   └─→ err != nil
   └─→ tx.Rollback()  ✓
```

## 핸들러로 트랜잭션 전달

`ExecutionContext`와 핸들러의 표준 `context.Context`는 역할이 다릅니다. 인터셉터는 요청 범위 실행 컨텍스트에 트랜잭션을 저장합니다. 쓰기 핸들러는 `spine.Ctx`를 주입받아 트랜잭션을 꺼내고 서비스에 명시적으로 전달합니다.

```go
// controller/user_controller.go
import (
    "context"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/spine"
    "github.com/uptrace/bun"
)

func (c *UserController) CreateUser(
    ctx context.Context,
    req *dto.CreateUserRequest,
    spineCtx spine.Ctx,
) (httpx.Response[dto.CreateUserResponse], error) {
    v, exists := spineCtx.Get("tx")
    if !exists {
        return httpx.Response[dto.CreateUserResponse]{},
            httperr.InternalServerError("트랜잭션이 존재하지 않습니다.")
    }

    tx, ok := v.(bun.IDB)
    if !ok {
        return httpx.Response[dto.CreateUserResponse]{},
            httperr.InternalServerError("트랜잭션 타입이 올바르지 않습니다.")
    }

    user, err := c.userService.Create(ctx, tx, req.Name, req.Email)
    if err != nil {
        return httpx.Response[dto.CreateUserResponse]{}, err
    }
    return httpx.Response[dto.CreateUserResponse]{Body: user}, nil
}
```

트랜잭션을 별도의 `context.WithValue`에 다시 넣지 않습니다. `spine.Ctx`는 인터셉터가 `ExecutionContext.Set`으로 기록한 동일한 요청 범위 값을 제공합니다.

## Service와 Repository에서 트랜잭션 사용

두 값을 명시적으로 전달합니다. `context.Context`는 취소와 기한을 전달하고, `bun.IDB`는 쿼리가 사용할 트랜잭션을 결정합니다.

```go
// service/user_service.go
func (s *UserService) Create(
    ctx context.Context,
    tx bun.IDB,
    name string,
    email string,
) (dto.CreateUserResponse, error) {
    user := &entity.User{Name: name, Email: email}
    if err := s.repo.Save(ctx, tx, user); err != nil {
        return dto.CreateUserResponse{}, err
    }
    return dto.CreateUserResponse{
        ID: int(user.ID), Name: user.Name, Email: user.Email,
    }, nil
}
```

```go
// repository/user_repository.go
type UserRepository struct {
    db bun.IDB
}

func NewUserRepository(db bun.IDB) *UserRepository {
    return &UserRepository{db: db}
}

func (r *UserRepository) Save(
    ctx context.Context,
    tx bun.IDB,
    user *entity.User,
) error {
    _, err := tx.NewInsert().Model(user).Exec(ctx)
    return err
}
```

주입된 `r.db`는 트랜잭션이 필요 없는 조회에 계속 사용할 수 있습니다. 요청 트랜잭션에 참여해야 하는 쓰기 메서드는 명시적으로 전달받은 `tx`를 사용합니다.

## 여러 Repository 사용

하나의 트랜잭션에서 여러 Repository를 사용하는 경우입니다.

### Service 예시

```go
// service/order_service.go
type OrderService struct {
    orderRepo *repository.OrderRepository
    userRepo  *repository.UserRepository
}

func NewOrderService(
    orderRepo *repository.OrderRepository,
    userRepo *repository.UserRepository,
) *OrderService {
    return &OrderService{
        orderRepo: orderRepo,
        userRepo:  userRepo,
    }
}

func (s *OrderService) CreateOrder(ctx context.Context, tx bun.IDB, userID int, items []Item) error {
    // 1. 사용자 조회
    user, err := s.userRepo.FindByID(ctx, userID)
    if err != nil {
        return err  // 롤백됨
    }

    // 2. 주문 생성
    order := &entity.Order{UserID: user.ID, Items: items}
    if err := s.orderRepo.Save(ctx, tx, order); err != nil {
        return err  // 롤백됨
    }

    // 3. 사용자 포인트 차감
    user.Points -= calculateTotal(items)
    if err := s.userRepo.Update(ctx, tx, user); err != nil {
        return err  // 롤백됨
    }

    return nil  // 모두 성공 → 커밋
}
```

이 `tx`를 전달받아 실행한 모든 작업은 같은 트랜잭션에 참여합니다. Repository가 기본 `db`를 사용한 호출은 해당 트랜잭션 밖에서 실행됩니다.

## 트랜잭션 옵션

### 읽기 전용 트랜잭션

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    reqCtx := ctx.Context()
    
    // 읽기 전용 트랜잭션
    tx, err := i.db.BeginTx(reqCtx, &sql.TxOptions{
        ReadOnly: true,
    })
    if err != nil {
        return err
    }
    
    ctx.Set("tx", tx)
    return nil
}
```

### 격리 수준 설정

```go
import "database/sql"

tx, err := i.db.BeginTx(reqCtx, &sql.TxOptions{
    Isolation: sql.LevelSerializable,  // 직렬화 가능
})
```

| 격리 수준 | 상수 |
|----------|------|
| Read Uncommitted | `sql.LevelReadUncommitted` |
| Read Committed | `sql.LevelReadCommitted` |
| Repeatable Read | `sql.LevelRepeatableRead` |
| Serializable | `sql.LevelSerializable` |


## 선택적 트랜잭션

모든 요청에 트랜잭션이 필요하지 않을 수 있습니다.

### 방법 1: 메서드 이름으로 구분

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    methodName := meta.Method.Name
    
    // Get으로 시작하는 메서드는 트랜잭션 스킵
    if strings.HasPrefix(methodName, "Get") || strings.HasPrefix(methodName, "List") {
        return nil
    }
    
    // 트랜잭션 시작
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return  // 트랜잭션 없으면 스킵
    }
    
    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

### 방법 2: HTTP 메서드로 구분

```go
func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    // GET 요청은 트랜잭션 스킵
    if ctx.Method() == "GET" {
        return nil
    }
    
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    
    ctx.Set("tx", tx)
    return nil
}
```

## 에러 로깅

트랜잭션 롤백 시 로깅을 추가할 수 있습니다.

```go
func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }

    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }
    
    if err != nil {
        log.Printf("[TX] Rollback: %s %s - %v", ctx.Method(), ctx.Path(), err)
        _ = tx.Rollback()
    } else {
        log.Printf("[TX] Commit: %s %s", ctx.Method(), ctx.Path())
        _ = tx.Commit()
    }
}
```

## 전체 예제

```go
// main.go
func main() {
    app := spine.New()

    app.Constructor(
        NewDB,
        interceptor.NewTxInterceptor,
        repository.NewUserRepository,
        repository.NewOrderRepository,
        service.NewUserService,
        service.NewOrderService,
        controller.NewUserController,
        controller.NewOrderController,
    )

    app.Interceptor(
        (*interceptor.TxInterceptor)(nil),
        &interceptor.LoggingInterceptor{},
    )

    routes.RegisterUserRoutes(app)
    routes.RegisterOrderRoutes(app)
    
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

```go
// interceptor/tx_interceptor.go
type TxInterceptor struct {
    db *bun.DB
}

func NewTxInterceptor(db *bun.DB) *TxInterceptor {
    return &TxInterceptor{db: db}
}

func (i *TxInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    tx, err := i.db.BeginTx(ctx.Context(), nil)
    if err != nil {
        return err
    }
    ctx.Set("tx", tx)
    return nil
}

func (i *TxInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TxInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    v, ok := ctx.Get("tx")
    if !ok {
        return
    }
    
    tx, ok := v.(bun.Tx)
    if !ok {
        return
    }
    if err != nil {
        _ = tx.Rollback()
    } else {
        _ = tx.Commit()
    }
}
```

## 핵심 정리

| 개념 | 설명 |
|------|------|
| **인터셉터 기반** | PreHandle에서 시작, AfterCompletion에서 종료 |
| **자동 커밋/롤백** | 에러 여부에 따라 자동 처리 |
| **bun.IDB** | `*bun.DB`와 `bun.Tx`가 구현하는 공통 인터페이스 |
| **요청 범위 공유** | `ExecutionContext.Set`으로 저장하고 핸들러에 주입된 `spine.Ctx.Get`으로 조회 |
| **명시적 전달** | Service와 Repository 호출에 `context.Context`와 `bun.IDB`를 함께 전달 |


## 다음 단계

- [튜토리얼: 에러 처리](/ko/learn/tutorial/7-error-handling) — httperr 사용법
- [레퍼런스: API](/ko/reference/api/spine-app) — Spine API 문서
