---
layout: home

hero:
  name: "Spine"
  text: "リクエストの処理過程を隠さないフレームワーク"
  tagline: Spineは、リクエストがどのように解決され、どのような順序で実行され、いつビジネスロジックが呼び出され、どのようにレスポンスとして完成するかを、明示的な実行パイプラインとして明らかにします。コントローラーはユースケースのみを表現し、実行に関するすべての判断はランタイムが責任を持ちます。
  actions:
    - theme: brand
      text: はじめる
      link: /ja/learn/getting-started/intro
    - theme: alt
      text: GitHub
      link: https://github.com/NARUBROWN/spine
    - theme: alt
      text: コミュニティに参加する
      link: https://discord.gg/8C7tAVzRKe
---

<div style="text-align: center; margin-top: 2rem; margin-bottom: 4rem; color: var(--vp-c-text-2);">
  <p>IoCコンテナ · 実行パイプライン · インターセプターチェーン<br><b>魔法のない実行構造</b></p>
</div>

## 主な特徴

<div class="features-grid">

### 1. 慣れ親しんだ構造
Spring、NestJSの開発者ならすぐに始められます。Controller → Service → Repository のレイヤー構造とコンストラクタ注入、インターセプターチェーンまで。使い慣れたエンタープライズアーキテクチャを採用しつつ、実行はSpineの明示的なパイプラインが担当します。


```go
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 2. 高速な起動
JVMウォームアップは必要ありません。 Node.js ランタイム初期化もありません。コンパイルされたGoバイナリはすぐに要求を受け取ります。
<TerminalBoot />

### 3. 少ないコード
`@Injectable`、`@Controller`、`@Autowired`などのアノテーションを使わず、型システムのみで依存関係を表現します。

アノテーションや慣例に頼らず、
シグネチャそのものが構造とコントラクトを明らかにします。

### 4. インターセプターパイプライン
リクエストの前/後/完了時にロジックを割り込ませることができます。  
認証、トランザクション、ロギングなどの横断的関心事を  
ビジネスコードから分離して実行フローに配置します。

実行順序はSpineのパイプラインが明示的に制御します。


```go
goapp.Interceptor(
    &TxInterceptor{},
    &AuthInterceptor{},
    &LoggingInterceptor{},
)
```

</div>

## 実行は単一のパイプラインのみを経由します

Spineでは、リクエストは例外なく単一実行パイプラインを通過します。

Routerは実行対象を選択するだけであり、  
実行順序とフローを認識しているのはPipelineただ一つだけです。


## 見えるものがすべてです

<p style="text-align: center; color: var(--vp-c-text-2);">アノテーションなし、モジュール定義なし</p>

<FrameworkTabs>
  <template #spine>

### main.go

```go
// main.go
func main() {
    app := spine.New()
    
    // ✅ コンストラクタを登録するだけで依存関係を自動解決
    // ✅ 登録順序は不問
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    
    routes.RegisterUserRoutes(app)
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	})
}
```

### routes.go

```go
// routes.go
func RegisterUserRoutes(app spine.App) {
    // ✅ ルートとハンドラーの接続が明示的
    // ✅ どのメソッドがどのパスであるか一目で把握
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
}
```

### controller.go

```go
// controller.go
// ✅ アノテーションなし — 純粋なGo構造体
// ✅ テスト時のモック化が容易
type UserController struct {
    svc *UserService
}

// ✅ コンストラクタパラメータ = 依存関係の宣言
// ✅ 隠された魔法はなし
func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}

// ✅ 関数シグネチャがそのままAPIスペック
// ✅ 入力(query.Values)、出力(UserResponse, error)が明確
func (c *UserController) GetUser(ctx context.Context, q query.Values) (UserResponse, error) {
    return c.svc.Get(ctx, q.Int("id", 0))
}
```

### service.go

```go
// service.go
// ✅ アノテーションなし
type UserService struct {
    repo *UserRepository
}

func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}
```

### repository.go

```go
// repository.go
// ✅ アノテーションなし
type UserRepository struct {
    db *bun.DB
}

func NewUserRepository(db *bun.DB) *UserRepository {
    return &UserRepository{db: db}
}
```
  </template>

  <template #nestjs>

### main.ts

```
typescript
// main.ts
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
}
```

### app.module.ts

```
typescript
// app.module.ts
// ⚠️ モジュール定義が必須 — ボイラープレートの増加
// ⚠️ アプリが大きくなるとモジュール間の依存関係管理が複雑化
@Module({
    imports: [UserModule],
})
export class AppModule {}
```

### user.module.ts

```
typescript
// user.module.ts
// ⚠️ コントローラーやサービスごとにモジュールへの登録が必要
// ⚠️ 登録し忘れるとランタイムエラー
@Module({
    controllers: [UserController],
    providers: [UserService, UserRepository],
})
export class UserModule {}
```

### controller.ts

```
typescript
// controller.ts
// ⚠️ デコレータがないと動作しない
// ⚠️ ルート情報がクラスやメソッドに分散
@Controller('users')
export class UserController {
    constructor(private readonly svc: UserService) {}

    // ⚠️ @Query、@Bodyなどパラメータごとにデコレータが必要
    @Get()
    getUser(@Query('id') id: string) {
        return this.svc.get(+id);
    }
}
```

### service.ts

```
typescript
// service.ts
// ⚠️ @Injectableがないと注入されない
@Injectable()
export class UserService {
    constructor(private readonly repo: UserRepository) {}
}
```

### repository.ts

```
typescript
// repository.ts
// ⚠️ @Injectable + @InjectRepositoryの両方が必要
@Injectable()
export class UserRepository {
    constructor(@InjectRepository(User) private repo: Repository<User>) {}
}
```
  </template>

  <template #spring>

### Application.java

```
java
// Application.java
@SpringBootApplication  // ⚠️ この中で何が起きているか把握しづらい
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### Controller.java

```
java
// Controller.java
@RestController  // ⚠️ アノテーションがないと動作しない
@RequestMapping("/users")  // ⚠️ ルート情報が分散する
public class UserController {
    
    @Autowired 
    private UserService svc;

    @GetMapping  // ⚠️ メソッドごとにアノテーションが必要
    public UserResponse getUser(@RequestParam Long id) {  // ⚠️ パラメータごとにアノテーションが必要
        return svc.get(id);
    }
}
```

### Service.java

```
java
// Service.java
@Service  // ⚠️ アノテーションがないとBean登録されない
public class UserService {
    
    @Autowired 
    private UserRepository repo;
}
```

### Repository.java

```
java
// Repository.java
@Repository  // ⚠️ アノテーションが必須
public interface UserRepository extends JpaRepository<User, Long> {
    // ⚠️ JpaRepositoryの継承が必須 — 強い結合
}
```
  </template>
</FrameworkTabs>

<div style="text-align: center; margin-top: 2rem;">
  <a href="/ja/learn/getting-started/intro" style="display: inline-block; padding: 0.8rem 1.6rem; background-color: var(--vp-c-brand-1); color: white; border-radius: 2rem; font-weight: bold; text-decoration: none;">5分チュートリアルを始める →</a>
</div>

<div style="text-align: center; margin-top: 6rem; padding-top: 4rem; border-top: 1px solid var(--vp-c-divider);">
  <h2 style="border: none; margin-bottom: 2rem;">"リクエストの処理過程を隠さないフレームワーク"</h2>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="/ja/learn/getting-started/intro" class="VPButton medium brand">はじめる</a>
    <a href="https://github.com/NARUBROWN/spine" class="VPButton medium alt">GitHub</a>
    <a href="/ja/reference/examples/crud" class="VPButton medium alt">サンプルプロジェクト</a>
    <a href="/llms.txt" class="VPButton medium alt">llms.txt</a>
  </div>
</div>
