---
layout: home

hero:
  name: "Spine"
  text: "요청 과정을 숨기지 않는 프레임워크"
  tagline: Spine은 요청이 어떻게 해석되고, 어떤 순서로 실행되며, 언제 비즈니스 로직이 호출되고, 어떻게 응답으로 완성되는지를 명시적인 실행 파이프라인으로 드러냅니다. 컨트롤러는 유즈케이스만 표현하고, 실행에 대한 모든 판단은 런타임이 책임집니다.
  actions:
    - theme: brand
      text: 시작하기
      link: /ko/learn/getting-started/intro
    - theme: alt
      text: GitHub
      link: https://github.com/NARUBROWN/spine
    - theme: alt
      text: 커뮤니티 참여하기
      link: https://discord.gg/8C7tAVzRKe
---

<div style="text-align: center; margin-top: 2rem; margin-bottom: 4rem; color: var(--vp-c-text-2);">
  <p>IoC 컨테이너 · 실행 파이프라인 · 인터셉터 체인<br><b>마법 없는 실행 구조</b></p>
</div>

## 핵심 특징

<div class="features-grid">

### 1. 익숙한 구조
Spring, NestJS, 개발자라면 바로 시작하세요. Controller → Service → Repository 계층 구조와 생성자 주입, 인터셉터 체인까지. 익숙한 엔터프라이즈 구조를 차용하되 실행은 Spine의 명시적인 파이프라인이 책임집니다.

```go
func NewUserService(repo *UserRepository) *UserService {
    return &UserService{repo: repo}
}

func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}
```

### 2. 빠른 시작
JVM 워밍업이 필요 없습니다. Node.js 런타임 초기화도 없습니다. 컴파일된 Go 바이너리가 즉시 요청을 받습니다.

<TerminalBoot />

### 3. 적은 코드
`@Injectable`, `@Controller`, `@Autowired` 없이도 타입 시스템만으로 의존성을 표현합니다.

어노테이션이나 관례 대신,
시그니처 자체가 구조와 계약을 드러냅니다.

### 4. 인터셉터 파이프라인
요청 전 / 후 / 완료 시점에 로직을 끼워 넣을 수 있습니다.  
인증, 트랜잭션, 로깅 같은 횡단 관심사를  
비즈니스 코드와 분리해 실행 흐름에 배치합니다.

실행 순서는 Spine의 파이프라인이 명시적으로 제어합니다.

```go
goapp.Interceptor(
    &TxInterceptor{},
    &AuthInterceptor{},
    &LoggingInterceptor{},
)
```

</div>

## 실행은 하나의 파이프라인으로만 흘러갑니다

Spine에서 요청은 예외 없이 하나의 실행 파이프라인을 통과합니다.

Router는 실행 대상을 선택할 뿐이며,  
실행 순서와 흐름을 아는 것은 오직 Pipeline 하나뿐입니다.


## 보이는 것이 전부입니다

<p style="text-align: center; color: var(--vp-c-text-2);">어노테이션 없이, 모듈 정의 없이</p>

<FrameworkTabs>
  <template #spine>

### main.go
```go
// main.go
func main() {
    app := spine.New()
    
    // ✅ 생성자만 등록하면 의존성 자동 해결
    // ✅ 순서 상관없이 등록 가능
    app.Constructor(NewUserRepository, NewUserService, NewUserController)
    
    routes.RegisterUserRoutes(app)
    app.Run(":8080")
}
```

### routes.go
```go
// routes.go
func RegisterUserRoutes(app spine.App) {
    // ✅ 라우트와 핸들러의 연결이 명시적
    // ✅ 어떤 메서드가 어떤 경로인지 한눈에 파악
    app.Route("GET", "/users", (*UserController).GetUser)
    app.Route("POST", "/users", (*UserController).CreateUser)
}
```

### controller.go
```go
// controller.go
// ✅ 어노테이션 없음 — 순수한 Go 구조체
// ✅ 테스트 시 모킹이 쉬움
type UserController struct {
    svc *UserService
}

// ✅ 생성자 파라미터 = 의존성 선언
// ✅ 숨겨진 마법 없음
func NewUserController(svc *UserService) *UserController {
    return &UserController{svc: svc}
}

// ✅ 함수 시그니처가 곧 API 스펙
// ✅ 입력(query.Values), 출력(UserResponse, error)이 명확
func (c *UserController) GetUser(ctx context.Context, q query.Values) (UserResponse, error) {
    return c.svc.Get(ctx, q.Int("id", 0))
}
```

### service.go
```go
// service.go
// ✅ 어노테이션 없음
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
// ✅ 어노테이션 없음
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
// ⚠️ 모듈 정의 필수 — 보일러플레이트 증가
// ⚠️ 앱이 커지면 모듈 간 의존성 관리 복잡
@Module({
    imports: [UserModule],
})
export class AppModule {}
```

### user.module.ts
```typescript
// user.module.ts
// ⚠️ 컨트롤러, 서비스마다 모듈에 등록해야 함
// ⚠️ 빠뜨리면 런타임 에러
@Module({
    controllers: [UserController],
    providers: [UserService, UserRepository],
})
export class UserModule {}
```

### controller.ts
```typescript
// controller.ts
// ⚠️ 데코레이터 없으면 동작 안 함
// ⚠️ 라우트 정보가 클래스/메서드에 분산
@Controller('users')
export class UserController {
    constructor(private readonly svc: UserService) {}

    // ⚠️ @Query, @Body 등 파라미터마다 데코레이터 필요
    @Get()
    getUser(@Query('id') id: string) {
        return this.svc.get(+id);
    }
}
```

### service.ts
```typescript
// service.ts
// ⚠️ @Injectable 없으면 주입 안 됨
@Injectable()
export class UserService {
    constructor(private readonly repo: UserRepository) {}
}
```

### repository.ts
```typescript
// repository.ts
// ⚠️ @Injectable + @InjectRepository 둘 다 필요
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
@SpringBootApplication  // ⚠️ 이 안에서 무슨 일이 일어나는지 알기 어려움
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### Controller.java
```java
// Controller.java
@RestController  // ⚠️ 어노테이션 없으면 동작 안 함
@RequestMapping("/users")  // ⚠️ 라우트 정보가 분산됨
public class UserController {
    
    @Autowired 
    private UserService svc;

    @GetMapping  // ⚠️ 메서드마다 어노테이션 필요
    public UserResponse getUser(@RequestParam Long id) {  // ⚠️ 파라미터마다 어노테이션
        return svc.get(id);
    }
}
```

### Service.java
```java
// Service.java
@Service  // ⚠️ 어노테이션 없으면 빈 등록 안 됨
public class UserService {
    
    @Autowired 
    private UserRepository repo;
}
```

### Repository.java
```java
// Repository.java
@Repository  // ⚠️ 어노테이션 필수
public interface UserRepository extends JpaRepository<User, Long> {
    // ⚠️ JpaRepository 상속 필수 — 강한 결합
}
```
  </template>
</FrameworkTabs>

<div style="text-align: center; margin-top: 2rem;">
  <a href="/ko/learn/getting-started/intro" style="display: inline-block; padding: 0.8rem 1.6rem; background-color: var(--vp-c-brand-1); color: white; border-radius: 2rem; font-weight: bold; text-decoration: none;">5분 튜토리얼 시작 →</a>
</div>

<div style="text-align: center; margin-top: 6rem; padding-top: 4rem; border-top: 1px solid var(--vp-c-divider);">
  <h2 style="border: none; margin-bottom: 2rem;">"요청 과정을 숨기지 않는 프레임워크"</h2>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="/ko/learn/getting-started/intro" class="VPButton medium brand">시작하기</a>
    <a href="https://github.com/NARUBROWN/spine" class="VPButton medium alt">GitHub</a>
    <a href="/ko/reference/examples/crud" class="VPButton medium alt">예제 프로젝트</a>
  </div>
</div>
