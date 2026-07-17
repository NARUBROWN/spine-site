---
layout: home

hero:
  name: "Spine"
  text: "不隱藏請求流程的框架"
  tagline: Spine 透過明確執行管道公開如何解釋請求、執行順序、何時調用業務邏輯以及如何在回應中完成請求。控制器僅表達用例，運行時負責所有有關執行的決策。
  actions:
    - theme: brand
      text: 入門
      link: /zh-Hant/learn/getting-started/intro
    - theme: alt
      text: GitHub
      link: https://github.com/NARUBROWN/spine
    - theme: alt
      text: 加入社區
      link: https://discord.gg/8C7tAVzRKe
---

<div style="text-align: center; margin-top: 2rem; margin-bottom: 4rem; color: var(--vp-c-text-2);">
  <p>IoC容器·執行管道·攔截器鏈<br><b>沒有魔法的執行結構</b></p>
</div>

## 主要特點

<div class="features-grid">

### 1.熟悉的結構
如果您是 Spring、NestJS 開發人員，請立即開始。控制器→服務→儲存庫層次結構、建構函式註入和攔截器鏈。它藉用了熟悉的企業架構，但使用 Spine 的明確管道來執行。

```go
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 2. 快速啟動
無需 JVM 預熱。也沒有 Node.js 運行時初始化。立即請求已編譯的 Go 二進位。

<TerminalBoot />

### 3. 更少的程式碼
只使用類型系統來表達依賴關係，而不需要 `@Injectable`、`@Controller` 和 `@Autowired`。

代替註釋或約定，
簽名本身揭示了結構和合約。

### 4.攔截器管道
可以在請求之前/之後/完成時插入邏輯。
橫切關注點，例如身分驗證、交易和日誌記錄
將其與業務程式碼分離，放入執行流程中。

執行順序由 Sp​​ine 的管道明確控制。

```go
goapp.Interceptor(
    &TxInterceptor{},
    &AuthInterceptor{},
    &LoggingInterceptor{},
)
```

</div>

## 執行僅透過一個管道

在Spine中，請求無一例外地透過一個執行管道。

Router 只負責選擇執行目標；
只有 Pipeline 知道執行順序與流程。

## 你所看到的就是一切

<p style="text-align: center; color: var(--vp-c-text-2);">無註釋，無模組定義</p>

<FrameworkTabs>
  <template #spine>

### main.go
```go
// 主機程式
func main() {
    app := spine.New()

    // ✅ 只需註冊建構函數即可自動解決依賴關係
    // ✅ 可以任意順序註冊
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

### 路線.go
```go
// 路線.go
func RegisterUserRoutes(app spine.App) {
    // ✅ 路由和處理程序的連接是明確的
    // ✅ 一目了然知道哪個方法是哪個路徑
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
}
```

### 控制器.go
```go
// 控制器.go
// ✅ 無註解——純 Go 結構
// ✅ 測試時易於模擬
type UserController struct {
    svc *UserService
}

// ✅ 建構子參數 = 依賴聲明
// ✅ 沒有隱藏的魔法
func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}

// ✅ 函數簽章是 API 規範
// ✅ 輸入（query.Values）和輸出（UserResponse、error）清晰
func (c *UserController) GetUser(ctx context.Context, q query.Values) (UserResponse, error) {
    return c.svc.Get(ctx, q.Int("id", 0))
}
```

### service.go
```go
// 服務.go
// ✅ 無註釋
type UserService struct {
    repo *UserRepository
}

func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}
```

### 儲存庫.go
```go
// 儲存庫.go
// ✅ 無註釋
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
```typescript
// 主要.ts
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
}
```

### 應用程式.module.ts
```typescript
// 應用程式模組.ts
// ⚠️ 需要模組定義－增加樣板文件
// ⚠️ 隨著應用程式的成長，管理模組之間的依賴關係變得複雜。
@Module({
    imports: [UserModule],
})
export class AppModule {}
```

### 用戶.module.ts
```typescript
// 使用者模組.ts
// ⚠️每個控制器和服務必須註冊在模組中
// ⚠️ 如果省略，會發生執行階段錯誤
@Module({
    controllers: [UserController],
    providers: [UserService, UserRepository],
})
export class UserModule {}
```

### 控制器.ts
```typescript
// 控制器.ts
// ⚠️沒有裝飾器就無法運作
// ⚠️ 跨類別/方法分佈的路由訊息
@Controller('users')
export class UserController {
    constructor(private readonly svc: UserService) {}

    // ⚠️ 每個參數都需要一個裝飾器，例如@Query、@Body等。
    @Get()
    getUser(@Query('id') id: string) {
        return this.svc.get(+id);
    }
}
```

### service.ts
```typescript
// 服務.ts
// ⚠️沒有@Injectable就沒有註射
@Injectable()
export class UserService {
    constructor(private readonly repo: UserRepository) {}
}
```

### 儲存庫.ts
```typescript
// 儲存庫.ts
// ⚠️ @Injectable + @InjectRepository 兩者都需要
@Injectable()
export class UserRepository {
    constructor(@InjectRepository(User) private repo: Repository<User>) {}
}
```
</template>

<template #spring>

### Application.java
```java
// 應用程式.java
@SpringBootApplication  // ⚠️ 很难看出内部发生了什么
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 控制器.java
```java
// 控制器.java
@RestController  // ⚠️ 沒有註解就無法運作
@RequestMapping("/users")  // ⚠️ 路由資訊分散
public class UserController {

    @Autowired
    private UserService svc;

    @GetMapping  // ⚠️ 每個方法都需要註解
    public UserResponse getUser(@RequestParam Long id) {  // ⚠️ 每個參數都需要註解
        return svc.get(id);
    }
}
```

### Service.java
```java
// 服務。爪哇
@Service  // ⚠️ 沒有註解就不會註冊 Bean
public class UserService {

    @Autowired
    private UserRepository repo;
}
```

### 儲存庫.java
```java
// 儲存庫.java
@Repository  // ⚠️ 必須使用註解
public interface UserRepository extends JpaRepository<User, Long> {
    // ⚠️需要JpaRepository繼承－強耦合
}
```
</template>
</FrameworkTabs>

<div style="text-align: center; margin-top: 2rem;">
  <a href="/zh-Hant/learn/tutorial/2-controller" style="display: inline-block; padding: 0.8rem 1.6rem; background-color: var(--vp-c-brand-1); color: white; border-radius: 2rem; font-weight: bold; text-decoration: none;">開始 5 分鐘教學 →</a>
</div>

<div style="text-align: center; margin-top: 6rem; padding-top: 4rem; border-top: 1px solid var(--vp-c-divider);">
  <h2 style="border: none; margin-bottom: 2rem;">「不隱藏請求程序的框架」</h2>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="/zh-Hant/learn/tutorial/2-controller" class="VPButton medium brand">開始</a>
    <a href="https://github.com/NARUBROWN/spine" class="VPButton medium alt">GitHub</a>
    <a href="/zh-Hant/learn/tutorial/4-interceptor" class="VPButton medium alt">攔截器範例</a>
    <a href="/llms.txt" class="VPButton medium alt">llms.txt</a>
  </div>
</div>
