---
layout: home

hero:
  name: "Spine"
  text: "不隐藏请求流程的框架"
  tagline: Spine 通过显式执行管道公开如何解释请求、执行顺序、何时调用业务逻辑以及如何在响应中完成请求。控制器仅表达用例，运行时负责所有有关执行的决策。
  actions:
    - theme: brand
      text: 入门
      link: /zh-Hans/learn/getting-started/intro
    - theme: alt
      text: GitHub
      link: https://github.com/NARUBROWN/spine
    - theme: alt
      text: 加入社区
      link: https://discord.gg/8C7tAVzRKe
---

<div style="text-align: center; margin-top: 2rem; margin-bottom: 4rem; color: var(--vp-c-text-2);">
  <p>IoC容器·执行管道·拦截器链<br><b>没有魔法的执行结构</b></p>
</div>

## 主要特点

<div class="features-grid">

### 1.熟悉的结构
如果您是 Spring、NestJS 开发人员，请立即开始。控制器→服务→存储库层次结构、构造函数注入和拦截器链。它借用了熟悉的企业架构，但使用 Spine 的显式管道来执行。

```go
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 2. 快速启动
无需 JVM 预热。也没有 Node.js 运行时初始化。立即请求已编译的 Go 二进制文件。

<TerminalBoot />

### 3. 更少的代码
仅使用类型系统表达依赖关系，而不需要 `@Injectable`、`@Controller` 和 `@Autowired`。

代替注释或约定，
签名本身揭示了结构和合同。

### 4.拦截器管道
可以在请求之前/之后/完成时插入逻辑。  
横切关注点，例如身份验证、事务和日志记录  
将其与业务代码分离，放入执行流程中。

执行顺序由 Sp​​ine 的管道显式控制。

```go
goapp.Interceptor(
    &TxInterceptor{},
    &AuthInterceptor{},
    &LoggingInterceptor{},
)
```

</div>

## 执行仅通过一个管道

在Spine中，请求无一例外地通过一个执行管道。

路由器只是选择运行什么，  
只有Pipeline知道执行顺序和流程。

## 你所看到的就是一切

<p style="text-align: center; color: var(--vp-c-text-2);">无注释，无模块定义</p>

<FrameworkTabs>
  <template #spine>

### main.go
```go
// main.go
func main() {
    app := spine.New()
    
    // ✅ 只需注册构造函数即可自动解决依赖关系
    // ✅ 可以任意顺序注册
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

### 路线.go
```go
// 路线.go
func RegisterUserRoutes(app spine.App) {
    // ✅ 路由和处理程序的连接是明确的
    // ✅ 一目了然知道哪个方法是哪个路径
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
}
```

### 控制器.go
```go
// 控制器.go
// ✅ 无注释——纯 Go 结构
// ✅ 测试时易于模拟
type UserController struct {
    svc *UserService
}

// ✅ 构造函数参数 = 依赖声明
// ✅ 没有隐藏的魔法
func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}

// ✅ 函数签名是 API 规范
// ✅ 输入（query.Values）和输出（UserResponse、error）清晰
func (c *UserController) GetUser(ctx context.Context, q query.Values) (UserResponse, error) {
    return c.svc.Get(ctx, q.Int("id", 0))
}
```

### service.go
```go
// 服务.go
// ✅ 无注释
type UserService struct {
    repo *UserRepository
}

func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}
```

### 存储库.go
```go
// 存储库.go
// ✅ 无注释
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

### 应用程序.module.ts
```typescript
// 应用程序模块.ts
// ⚠️ 需要模块定义——增加样板文件
// ⚠️ 随着应用程序的增长，管理模块之间的依赖关系变得复杂。
@Module({
    imports: [UserModule],
})
export class AppModule {}
```

### 用户.module.ts
```typescript
// 用户模块.ts
// ⚠️每个控制器和服务必须注册在模块中
// ⚠️ 如果省略，会发生运行时错误
@Module({
    controllers: [UserController],
    providers: [UserService, UserRepository],
})
export class UserModule {}
```

### 控制器.ts
```typescript
// 控制器.ts
// ⚠️没有装饰器就无法工作
// ⚠️ 跨类/方法分布的路由信息
@Controller('users')
export class UserController {
    constructor(private readonly svc: UserService) {}

    // ⚠️ 每个参数都需要一个装饰器，例如@Query、@Body等。
    @Get()
    getUser(@Query('id') id: string) {
        return this.svc.get(+id);
    }
}
```

### service.ts
```typescript
// 服务.ts
// ⚠️没有@Injectable就没有注射
@Injectable()
export class UserService {
    constructor(private readonly repo: UserRepository) {}
}
```

### 存储库.ts
```typescript
// 存储库.ts
// ⚠️ @Injectable + @InjectRepository 两者都需要
@Injectable()
export class UserRepository {
    constructor(@InjectRepository(User) private repo: Repository<User>) {}
}
```
</template>

<template #spring>

### Application.java
```java
// 应用程序.java
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
@RestController  // ⚠️ 没有注解就无法运行
@RequestMapping("/users")  // ⚠️ 路由信息分散
public class UserController {
    
    @Autowired 
    private UserService svc;

    @GetMapping  // ⚠️ 每个方法都需要注解
    public UserResponse getUser(@RequestParam Long id) {  // ⚠️ 每个参数都需要注解
        return svc.get(id);
    }
}
```

### Service.java
```java
// 服务。爪哇
@Service  // ⚠️ 没有注解就不会注册 Bean
public class UserService {
    
    @Autowired 
    private UserRepository repo;
}
```

### 存储库.java
```java
// 存储库.java
@Repository  // ⚠️ 必须使用注解
public interface UserRepository extends JpaRepository<User, Long> {
    // ⚠️需要JpaRepository继承——强耦合
}
```
</template>
</FrameworkTabs>

<div style="text-align: center; margin-top: 2rem;">
  <a href="/zh-Hans/learn/tutorial/2-controller" style="display: inline-block; padding: 0.8rem 1.6rem; background-color: var(--vp-c-brand-1); color: white; border-radius: 2rem; font-weight: bold; text-decoration: none;">开始 5 分钟教程 →</a>
</div>

<div style="text-align: center; margin-top: 6rem; padding-top: 4rem; border-top: 1px solid var(--vp-c-divider);">
  <h2 style="border: none; margin-bottom: 2rem;">“不隐藏请求过程的框架”</h2>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="/zh-Hans/learn/tutorial/2-controller" class="VPButton medium brand">开始</a>
    <a href="https://github.com/NARUBROWN/spine" class="VPButton medium alt">GitHub</a>
    <a href="/zh-Hans/learn/tutorial/4-interceptor" class="VPButton medium alt">拦截器示例</a>
    <a href="/llms.txt" class="VPButton medium alt">llms.txt</a>
  </div>
</div>
