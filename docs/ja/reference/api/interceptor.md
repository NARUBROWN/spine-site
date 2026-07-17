# core.Interceptor

Interceptor インターフェースの API 参照。

## 概要

`Interceptor`は、Controller呼び出しの前後に横断的な関心事を処理するインターフェースです。ロギング、認証、CORS、トランザクション管理などに活用されます。

Spineは、**グローバルインターセプタ**と**ルートインターセプタ**の2つのレベルをサポートしています。
```go
import "github.com/NARUBROWN/spine/core"
```
## インタフェース定義
```go
type Interceptor interface {
    PreHandle(ctx ExecutionContext, meta HandlerMeta) error
    PostHandle(ctx ExecutionContext, meta HandlerMeta)
    AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
}
```
## メソッド

### PreHandle
```go
PreHandle(ctx ExecutionContext, meta HandlerMeta) error
```
Controller呼び出し**前**に実行されます。

**パラメータ**
- `ctx` - 要求コンテキスト
– `meta` – 実行する Controller メソッド情報。グローバルインターセプタはルーティング前に実行されるため、空の`HandlerMeta{}`が渡されます。

**戻り値**
- `nil` - 次のステップに進む
- `error` - エラーが返されたときのパイプラインの中断
- `core.ErrAbortPipeline` - パイプラインの中断（エラーではない、応答完了状態）

**例**
```go
func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("認証が必要です")
    }
    
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("無効な 토큰입니다")
    }
    
    ctx.Set("auth.user", user)
    return nil
}
```

### PostHandle


```go
PostHandle(ctx ExecutionContext, meta HandlerMeta)
```
Controller呼び出しとReturnValueHandler処理**の後**で実行されます。逆順で呼び出されます。失敗しても、完全なパイプライン障害にはなりません。

**パラメータ**
- `ctx` - 要求コンテキスト
- `meta` - 実行されたControllerメソッドについて

**例**
```go
func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}
```

### AfterCompletion


```go
AfterCompletion(ctx ExecutionContext, meta HandlerMeta, err error)
```
成功/失敗に関係なく、**常に**の最後に実行されます。 `defer`で保証されています。逆順で呼び出されます。リソースの整理、メトリックの収集などに活用します。

**パラメータ**
- `ctx` - 要求コンテキスト
- `meta` - 実行された Controller メソッドについて
- `err` - パイプライン実行中に発生した最終エラー（存在しない場合は`nil`）

**例**
```go
func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```
## Global vs Route Interceptor

### グローバルインターセプタ

すべてのリクエストに適用されます。 **ルーティング前**に`PreHandle`が実行されます。
```go
app := spine.New()

app.Interceptor(
    cors.New(cors.Config{
        AllowOrigins: []string{"*"},
    }),
    &LoggingInterceptor{},
)
```
グローバルインターセプタの`PreHandle`にはまだルーティングが完了していないため、空の`HandlerMeta{}`が配信されます。

### ルートインターセプタ

特定のルートにのみ適用されます。 **ルーティング後、Controller呼び出し前**に`PreHandle`が実行されます。実際の`HandlerMeta`が渡されます。
```go
import "github.com/NARUBROWN/spine/pkg/route"

app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors(&AuthInterceptor{}),
)
```
### nil ポインタによる Container Resolve

ルートインターセプタをnilポインタとして登録すると、ブートストラップ時にIoC Containerで自動的にResolveされます。これにより、依存性のあるインターセプタを簡単に使用できます。
```go
// nilポインタ→ContainerからResolveapp.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)

// インスタンスを直接渡すapp.Route("GET", "/public/users/:id", (*UserController).GetUser,
    route.WithInterceptors(&RateLimitInterceptor{Limit: 100}),
)
```
|登録方法アクション
|----------|------|
| `(*AuthInterceptor)(nil)` | ContainerからResolve（依存性注入可能）
| `&RateLimitInterceptor{Limit: 100}` |インスタンスを直接使用する


## 実行順序

テストコードで検証された実際の実行順序。

### 通常フロー
```
Global.PreHandle()
    ↓
  [Router]
    ↓
  [ArgumentResolver]
    ↓
Route.PreHandle()
    ↓
  [Controller 呼び出し]
    ↓
  [ReturnValueHandler]
    ↓
  [PostExecutionHook]
    ↓
Route.PostHandle()        ← 역순
    ↓
Global.PostHandle()       ← 역순
    ↓
Route.AfterCompletion()   ← 역순, 항상 実行
    ↓
Global.AfterCompletion()  ← 역순, 항상 実行
```
### ルートインターセプタで中断
```
Global.PreHandle()
    ↓
  [Router]
    ↓
  [ArgumentResolver]
    ↓
Route.PreHandle() → ErrAbortPipeline
    ↓
Route.AfterCompletion() ← 常に実行    ↓
Global.AfterCompletion() ← 常に実行
```
Controller、PostHandleは呼び出されませんが、`AfterCompletion`は常に保証されています。

### グローバルインターセプタで中断
```
Global.PreHandle() → ErrAbortPipeline
    ↓
Global.AfterCompletion() ← 常に実行
```
Routerも呼び出されないため、ルートインターセプタも実行されません。


## パイプラインの中断

`PreHandle`から`core.ErrAbortPipeline`を返すと、Controller呼び出しなしでパイプラインが終了します。これはエラーではなく正常終了として扱われます。
```go
import "github.com/NARUBROWN/spine/core"

func (i *CORSInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    rwAny, ok := ctx.Get("spine.response_writer")
    if !ok {
        return nil
    }
    rw := rwAny.(core.ResponseWriter)
    
    origin := ctx.Header("Origin")
    if origin != "" && i.isAllowedOrigin(origin) {
        rw.SetHeader("Access-Control-Allow-Origin", origin)
        rw.SetHeader("Vary", "Origin")
    }
    
// PreflightリクエストはController呼び出しなしで応答します    if ctx.Method() == "OPTIONS" {
        rw.WriteStatus(204)
return core.ErrAbortPipeline // 正常終了    }
    return nil
}
```
## ブートストラップでのインターセプタ処理

### グローバルインターセプタ重複排除

同じタイプのグローバルインターセプタが複数回登録されると、最初の登録のみが維持されます。
```go
// internal/bootstrap/bootstrap.go
seen := make(map[reflect.Type]struct{})
ordered := make([]core.Interceptor, 0, len(config.Interceptors))
for _, interceptor := range config.Interceptors {
    t := reflect.TypeOf(interceptor)
    if _, ok := seen[t]; ok {
continue // 重複タイプを無視
    }
    seen[t] = struct{}{}
    ordered = append(ordered, interceptor)
}
```
### グローバルインターセプタ nil ポインタ Resolve

グローバルインターセプタもnilポインタとして登録すると、ContainerでResolveされます。
```go
app.Interceptor((*LoggingInterceptor)(nil)) // Container から Resolve
```
## 実装例

### ロギング Interceptor
```go
type LoggingInterceptor struct{}

func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf("[REQ] %s %s -> %s.%s",
        ctx.Method(),
        ctx.Path(),
        meta.ControllerType.Name(),
        meta.Method.Name,
    )
    return nil
}

func (i *LoggingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {
    log.Printf("[RES] %s %s OK", ctx.Method(), ctx.Path())
}

func (i *LoggingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if err != nil {
        log.Printf("[ERR] %s %s : %v", ctx.Method(), ctx.Path(), err)
    }
}
```
### リクエスト時間の測定
```go
type TimingInterceptor struct{}

func (i *TimingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    ctx.Set("timing.start", time.Now())
    return nil
}

func (i *TimingInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *TimingInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {
    if start, ok := ctx.Get("timing.start"); ok {
        elapsed := time.Since(start.(time.Time))
        log.Printf("[TIMING] %s %s took %v", ctx.Method(), ctx.Path(), elapsed)
    }
}
```
### 認証インターセプタ(ルートレベル)
```go
type AuthInterceptor struct {
    auth *AuthService  // Container에서 주입
}

func (i *AuthInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    token := ctx.Header("Authorization")
    if token == "" {
        return httperr.Unauthorized("認証が必要です")
    }
    
    user, err := i.auth.Validate(token)
    if err != nil {
        return httperr.Unauthorized("無効な 토큰입니다")
    }
    
    ctx.Set("auth.user", user)
    return nil
}

func (i *AuthInterceptor) PostHandle(ctx core.ExecutionContext, meta core.HandlerMeta) {}

func (i *AuthInterceptor) AfterCompletion(ctx core.ExecutionContext, meta core.HandlerMeta, err error) {}
```
ルートに適用：
```go
// nil ポインタとして登録 → Container で AuthService 依存関係とともに Resolveapp.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),
)
```
## まとめ

|区分グローバルインターセプター|ルートインターセプター|
|------|---------------|---------------|
|登録| `app.Interceptor()` | `route.WithInterceptors()` |
|適用範囲すべてのリクエスト|特定のルートのみ
| PreHandle視点|ルーティング**前** |ルーティング**後** |
| metaコンテンツ|空`HandlerMeta{}` |本物の`HandlerMeta` |
| nilポインタ| Container Resolveサポート| Container Resolveサポート|
|重複排除同じタイプの最初の登録のみを維持|該当なし|


## 注

- [ExecutionContext](/ja/reference/api/execution-context) - リクエストコンテキストインタフェース
- [HandlerMeta](/ja/learn/core-concepts/handler-meta) - ハンドラメタデータ
- ResponseWriter - 応答出力インターフェース