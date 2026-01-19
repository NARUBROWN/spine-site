---
layout: home

hero:
  name: "Spine"
  text: "A framework that doesn't hide the request process"
  tagline: Spine reveals how a request is interpreted, in what order it executes, when business logic is invoked, and how the response is finalized through an explicit execution pipeline. Controllers express only use-cases, and the runtime is responsible for all execution decisions.
  actions:
    - theme: brand
      text: Get Started
      link: /en/learn/getting-started/intro
    - theme: alt
      text: GitHub
      link: https://github.com/NARUBROWN/spine
---

<div style="text-align: center; margin-top: 2rem; margin-bottom: 4rem; color: var(--vp-c-text-2);">
  <p>IoC Container · Execution Pipeline · Interceptor Chain<br><b>Execution Structure without Magic</b></p>
</div>

## Key Features

<div class="features-grid">

### 1. Familiar Structure
If you are a Spring or NestJS developer, start right away. Controller → Service → Repository layered architecture with constructor injection and interceptor chains. Borrowing the familiar enterprise structure, but execution is handled by Spine's explicit pipeline.

```go
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 2. Fast Start
No JVM warmup required. No Node.js runtime initialization. The compiled Go binary receives requests immediately.

### 3. Less Code
Express dependencies with only the type system, without `@Injectable`, `@Controller`, or `@Autowired`.

Instead of annotations or conventions,
the signature itself reveals the structure and contract.

### 4. Interceptor Pipeline
You can inject logic at pre-request / post-request / completion points.
Place cross-cutting concerns like authentication, transactions, and logging
separated from business code into the execution flow.

It provides a user experience **similar to Spring's HandlerInterceptor**,
but the execution order is explicitly controlled by Spine's pipeline.

```go
goapp.Interceptor(
    &TxInterceptor{},
    &AuthInterceptor{},
    &LoggingInterceptor{},
)
```

</div>

## Execution flows through a single pipeline

In Spine, requests pass through a single execution pipeline without exception.

The Router only selects the target for execution,
and only the Pipeline knows the execution order and flow.


## What you see is what you get

<p style="text-align: center; color: var(--vp-c-text-2);">No annotations, no module definitions</p>

<FrameworkTabs>
  <template #spine>

### main.go
```go
// main.go
func main() {
    app := spine.New()
    
    // ✅ Dependencies automatically resolved just by registering constructors
    // ✅ Can be registered in any order
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    
    routes.RegisterUserRoutes(app)
    app.Run(":8080")
}
```

### routes.go
```go
// routes.go
func RegisterUserRoutes(app spine.App) {
    // ✅ Explicit connection between route and handler
    // ✅ Identify which method is for which path at a glance
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
}
```

### controller.go
```go
// controller.go
// ✅ No annotations — Pure Go struct
// ✅ Easy to mock during testing
type UserController struct {
    svc *UserService
}

// ✅ Constructor parameter = Dependency declaration
// ✅ No hidden magic
func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}

// ✅ Function signature is the API spec
// ✅ Clear input (query.Values) and output (UserResponse, error)
func (c *UserController) GetUser(ctx context.Context, q query.Values) (UserResponse, error) {
    return c.svc.Get(ctx, q.Int("id", 0))
}
```

### service.go
```go
// service.go
// ✅ No annotations
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
// ✅ No annotations
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
// main.ts
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
}
```

### app.module.ts
```typescript
// app.module.ts
// ⚠️ Module definition required — Increases boilerplate
// ⚠️ Dependency management between modules becomes complex as app grows
@Module({
    imports: [UserModule],
})
export class AppModule {}
```

### user.module.ts
```typescript
// user.module.ts
// ⚠️ Must be registered in module for every controller and service
// ⚠️ Runtime error if missed
@Module({
    controllers: [UserController],
    providers: [UserService, UserRepository],
})
export class UserModule {}
```

### controller.ts
```typescript
// controller.ts
// ⚠️ Doesn't work without decorators
// ⚠️ Route info distributed across class/methods
@Controller('users')
export class UserController {
    constructor(private readonly svc: UserService) {}

    // ⚠️ Decorators needed for each parameter like @Query, @Body
    @Get()
    getUser(@Query('id') id: string) {
        return this.svc.get(+id);
    }
}
```

### service.ts
```typescript
// service.ts
// ⚠️ Injection doesn't work without @Injectable
@Injectable()
export class UserService {
    constructor(private readonly repo: UserRepository) {}
}
```

### repository.ts
```typescript
// repository.ts
// ⚠️ Both @Injectable + @InjectRepository needed
@Injectable()
export class UserRepository {
    constructor(@InjectRepository(User) private repo: Repository<User>) {}
}
```
  </template>

  <template #spring>

### Application.java
```java
// Application.java
@SpringBootApplication  // ⚠️ Hard to know what happens inside
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### Controller.java
```java
// Controller.java
@RestController  // ⚠️ Doesn't work without annotation
@RequestMapping("/users")  // ⚠️ Route info is scattered
public class UserController {
    
    @Autowired  // ⚠️ Field injection — Hard to mock for testing
    private UserService svc;

    @GetMapping  // ⚠️ Annotation needed for each method
    public UserResponse getUser(@RequestParam Long id) {  // ⚠️ Annotation for each parameter
        return svc.get(id);
    }
}
```

### Service.java
```java
// Service.java
@Service  // ⚠️ Bean registration doesn't work without annotation
public class UserService {
    
    @Autowired  // ⚠️ Circular reference issues possible
    private UserRepository repo;
}
```

### Repository.java
```java
// Repository.java
@Repository  // ⚠️ Annotation required
public interface UserRepository extends JpaRepository<User, Long> {
    // ⚠️ JpaRepository inheritance required — Strong coupling
}
```
  </template>
</FrameworkTabs>

<div style="text-align: center; margin-top: 2rem;">
  <a href="/en/learn/getting-started/intro" style="display: inline-block; padding: 0.8rem 1.6rem; background-color: var(--vp-c-brand-1); color: white; border-radius: 2rem; font-weight: bold; text-decoration: none;">Start 5-Minute Tutorial →</a>
</div>

<div style="text-align: center; margin-top: 6rem; padding-top: 4rem; border-top: 1px solid var(--vp-c-divider);">
  <h2 style="border: none; margin-bottom: 2rem;">"A framework that doesn't hide the request process"</h2>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="/en/learn/getting-started/intro" class="VPButton medium brand">Get Started</a>
    <a href="https://github.com/NARUBROWN/spine" class="VPButton medium alt">GitHub</a>
    <a href="/en/reference/examples/crud" class="VPButton medium alt">Example Project</a>
  </div>
</div>
