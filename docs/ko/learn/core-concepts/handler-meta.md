# 핸들러 메타 (HandlerMeta)

라우트 핸들러에 대한 메타데이터.

## 개요

`HandlerMeta`는 실행할 Controller 메서드에 대한 메타데이터를 담는 구조체입니다. Router가 요청 경로를 매칭하면 `HandlerMeta`를 반환하고, Pipeline은 이 정보를 사용해 실제 메서드를 호출합니다.

```mermaid
graph TD
    subgraph Bootstrap [Route 등록 (부트스트랩)]
        MethodExpr["(*UserController).GetUser<br>(메서드 표현식)"]
        NewMeta["NewHandlerMeta()"]
        MetaStruct["HandlerMeta<br>ControllerType: *UserController<br>Method: GetUser<br>Interceptors: []Interceptor"]
    end

    subgraph Runtime [런타임]
        Pipeline["Pipeline"]
        Resolve["1. Container.Resolve(Type)"]
        Call["2. Method.Func.Call(args)"]
    end

    MethodExpr --> NewMeta
    NewMeta --> MetaStruct
    MetaStruct -.-> Pipeline
    Pipeline --> Resolve
    Resolve --> Call
```


## HandlerMeta 구조체

```go
// core/handler_meta.go
type HandlerMeta struct {
    // 컨트롤러 타입 (Container Resolve 대상)
    ControllerType reflect.Type
    
    // 호출할 메서드
    Method reflect.Method
    
    // 핸들러에 적용된 인터셉터
    Interceptors []Interceptor
}
```

### 필드 설명

#### ControllerType

Controller의 포인터 타입입니다. IoC Container에서 인스턴스를 Resolve할 때 사용됩니다.

```go
meta.ControllerType  // reflect.Type of *UserController
```

#### Method

호출할 메서드의 리플렉션 정보입니다. 메서드 이름, 시그니처, 함수 포인터를 포함합니다.

```go
meta.Method.Name           // "GetUser"
meta.Method.Type           // func(*UserController, path.Int) (User, error)
meta.Method.Func           // 호출 가능한 reflect.Value
```

#### Interceptors

해당 라우트에만 적용되는 인터셉터 목록입니다. 글로벌 인터셉터와 별도로, 라우트 단위로 횡단 관심사를 적용할 수 있습니다.

```go
meta.Interceptors  // []core.Interceptor (라우트 레벨)
```


## HandlerMeta 생성

### 메서드 표현식

Spine은 **메서드 표현식**(Method Expression)을 사용해 핸들러를 등록합니다.

```go
// cmd/demo/main.go
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,  // 메서드 표현식
)
```

메서드 표현식 `(*UserController).GetUser`는 일반 함수로 취급됩니다:

```go
// 메서드 표현식의 실제 타입
func(*UserController, path.Int) (User, error)
//   ↑ receiver가 첫 번째 인자로 변환됨
```

### RouteOption으로 라우트 인터셉터 적용

`route.WithInterceptors`를 사용해 라우트 단위 인터셉터를 지정할 수 있습니다.

```go
app.Route(
    "GET",
    "/users/:id",
    (*UserController).GetUser,
    route.WithInterceptors(&AuthInterceptor{}),
)
```

```go
// pkg/route/route_options.go
func WithInterceptors(interceptors ...core.Interceptor) router.RouteOption {
    return func(rs *router.RouteSpec) {
        rs.Interceptors = append(rs.Interceptors, interceptors...)
    }
}
```

### NewHandlerMeta 함수

메서드 표현식을 분석하여 `HandlerMeta`를 생성합니다.

```go
// internal/router/handler_meta.go
func NewHandlerMeta(handler any) (core.HandlerMeta, error) {
    t := reflect.TypeOf(handler)
    v := reflect.ValueOf(handler)
    
    // 1. 함수인지 검증
    if t.Kind() != reflect.Func {
        return core.HandlerMeta{}, fmt.Errorf("handler는 함수여야 합니다")
    }
    
    // 2. 메서드 표현식인지 검증 (첫 번째 인자가 receiver)
    if t.NumIn() < 1 {
        return core.HandlerMeta{}, fmt.Errorf("handler는 메서드 표현식이어야 합니다")
    }
    
    // 3. receiver가 포인터 타입인지 검증
    receiverType := t.In(0)
    if receiverType.Kind() != reflect.Ptr {
        return core.HandlerMeta{}, fmt.Errorf("handler의 리시버는 포인터 타입이어야 합니다")
    }
    
    // 4. 메서드 이름 추출
    fn := runtime.FuncForPC(v.Pointer())
    if fn == nil {
        return core.HandlerMeta{}, fmt.Errorf("메서드 정보를 추출할 수 없습니다")
    }
    
    fullName := fn.Name()
    // 예: github.com/NARUBROWN/spine-demo.(*UserController).GetUser
    lastDot := strings.LastIndex(fullName, ".")
    if lastDot == -1 {
        return core.HandlerMeta{}, fmt.Errorf("메서드 이름 파싱 실패: %s", fullName)
    }
    
    methodName := fullName[lastDot+1:]
    
    // 5. 리플렉션으로 메서드 정보 획득
    method, ok := receiverType.MethodByName(methodName)
    if !ok {
        return core.HandlerMeta{}, fmt.Errorf("메서드를 찾을 수 없습니다: %s", methodName)
    }
    
    return core.HandlerMeta{
        ControllerType: receiverType,
        Method:         method,
    }, nil
}
```

### 생성 과정 상세

#### Step 1: 함수 검증

```go
t := reflect.TypeOf((*UserController).GetUser)
t.Kind()  // reflect.Func ✓
```

#### Step 2: 메서드 표현식 검증

```go
t.NumIn()  // 2 (receiver + path.Int)
t.In(0)    // *UserController (receiver)
t.In(1)    // path.Int
```

#### Step 3: 메서드 이름 추출

`runtime.FuncForPC`로 함수의 전체 경로를 얻고, 마지막 `.` 이후의 문자열이 메서드 이름입니다. `lastDot == -1`인 경우 파싱 실패 에러를 반환합니다.

```go
fn.Name()  // "github.com/NARUBROWN/spine-demo.(*UserController).GetUser"
           //                                                    ↑ methodName
```

#### Step 4: Method 획득

```go
method, _ := reflect.TypeOf(&UserController{}).MethodByName("GetUser")
// method.Name: "GetUser"
// method.Type: func(*UserController, path.Int) (User, error)
// method.Func: 호출 가능한 reflect.Value
```


## Router에서의 사용

### Route 등록

```go
// internal/router/router.go
type Route struct {
    Method string           // HTTP 메서드
    Path   string           // URL 패턴
    Meta   core.HandlerMeta // 핸들러 메타데이터 (Interceptors 포함)
}

func (r *DefaultRouter) Register(method string, path string, meta core.HandlerMeta) {
    r.routes = append(r.routes, Route{
        Method: method,
        Path:   path,
        Meta:   meta,
    })
}
```

### Route 매칭

```go
func (r *DefaultRouter) Route(ctx core.ExecutionContext) (core.HandlerMeta, error) {
    for _, route := range r.routes {
        if route.Method != ctx.Method() {
            continue
        }
        
        ok, params, keys := matchPath(route.Path, ctx.Path())
        if !ok {
            continue
        }
        
        ctx.Set("spine.params", params)
        ctx.Set("spine.pathKeys", keys)
        
        return route.Meta, nil  // HandlerMeta 반환 (Interceptors 포함)
    }
    return core.HandlerMeta{}, httperr.NotFound("핸들러가 없습니다.")
}
```


## Pipeline에서의 사용

### 글로벌 + 라우트 인터셉터 실행 흐름

Pipeline은 글로벌 인터셉터와 라우트 인터셉터를 분리하여 실행합니다.

```go
// internal/pipeline/pipeline.go
func (p *Pipeline) Execute(ctx core.ExecutionContext) (finalErr error) {
    globalMeta := core.HandlerMeta{}
    
    // AfterCompletion은 성공/실패와 관계없이 보장
    defer func() {
        for i := len(p.interceptors) - 1; i >= 0; i-- {
            p.interceptors[i].AfterCompletion(ctx, globalMeta, finalErr)
        }
    }()

    // 1. 글로벌 Interceptor PreHandle (라우팅 전)
    for _, it := range p.interceptors {
        if err := it.PreHandle(ctx, globalMeta); err != nil {
            if errors.Is(err, core.ErrAbortPipeline) {
                return nil
            }
            return err
        }
    }

    // 2. Router가 실행 대상을 결정
    meta, err := p.router.Route(ctx)
    if err != nil {
        return err
    }

    routeInterceptors := meta.Interceptors

    // 라우트 Interceptor AfterCompletion은 무조건 보장
    defer func() {
        for i := len(routeInterceptors) - 1; i >= 0; i-- {
            routeInterceptors[i].AfterCompletion(ctx, meta, finalErr)
        }
    }()

    // 3. ArgumentResolver 체인 실행
    paramMetas := buildParameterMeta(meta.Method, ctx)
    args, err := p.resolveArguments(ctx, paramMetas)
    if err != nil {
        return err
    }

    // 4. 라우트 Interceptor PreHandle
    for _, it := range routeInterceptors {
        if err := it.PreHandle(ctx, meta); err != nil {
            if errors.Is(err, core.ErrAbortPipeline) {
                return nil
            }
            return err
        }
    }

    // 5. Controller Method 호출
    results, err := p.invoker.Invoke(meta.ControllerType, meta.Method, args)
    if err != nil {
        return err
    }

    // 6. ReturnValueHandler 처리
    returnError := p.handleReturn(ctx, results)

    // 7. PostExecutionHook (이벤트 발행 등)
    for _, hook := range p.postHooks {
        hook.AfterExecution(ctx, results, returnError)
    }

    if returnError != nil {
        return returnError
    }

    // 8. 라우트 Interceptor PostHandle (역순)
    for i := len(routeInterceptors) - 1; i >= 0; i-- {
        routeInterceptors[i].PostHandle(ctx, meta)
    }

    // 9. 글로벌 Interceptor PostHandle (역순)
    for i := len(p.interceptors) - 1; i >= 0; i-- {
        p.interceptors[i].PostHandle(ctx, meta)
    }

    return nil
}
```

### ParameterMeta 생성

`HandlerMeta.Method`를 분석하여 각 파라미터의 메타정보를 생성합니다.

```go
// internal/pipeline/pipeline.go
func buildParameterMeta(method reflect.Method, ctx core.ExecutionContext) []resolver.ParameterMeta {
    pathKeys := ctx.PathKeys()
    pathIdx := 0
    var metas []resolver.ParameterMeta
    
    // method.Type.NumIn()은 receiver 포함
    // i=0은 receiver이므로 i=1부터 시작
    for i := 1; i < method.Type.NumIn(); i++ {
        pt := method.Type.In(i)
        
        pm := resolver.ParameterMeta{
            Index: i - 1,
            Type:  pt,
        }
        
        if isPathType(pt) {
            if pathIdx >= len(pathKeys) {
                pm.PathKey = ""
            } else {
                pm.PathKey = pathKeys[pathIdx]
            }
            pathIdx++
        }
        
        metas = append(metas, pm)
    }
    
    return metas
}

func isPathType(pt reflect.Type) bool {
    pathPkg := reflect.TypeFor[path.Int]().PkgPath()
    return pt.PkgPath() == pathPkg
}
```

### Controller 호출

```go
// internal/invoker/invoker.go
func (i *Invoker) Invoke(controllerType reflect.Type, method reflect.Method, args []any) ([]any, error) {
    // 1. Container에서 Controller 인스턴스 Resolve
    controller, err := i.container.Resolve(controllerType)
    if err != nil {
        return nil, err
    }
    
    // 2. 호출 인자 구성 (receiver + args)
    values := make([]reflect.Value, len(args)+1)
    values[0] = reflect.ValueOf(controller)  // receiver
    for idx, arg := range args {
        values[idx+1] = reflect.ValueOf(arg)
    }
    
    // 3. 리플렉션으로 메서드 호출
    results := method.Func.Call(values)
    
    // 4. 결과 변환
    out := make([]any, len(results))
    for i, result := range results {
        out[i] = result.Interface()
    }
    
    return out, nil
}
```

### Interceptor 전달

Interceptor의 모든 메서드는 `HandlerMeta`를 받아 실행 대상 정보에 접근할 수 있습니다.

```go
// cmd/demo/logging_interceptor.go
func (i *LoggingInterceptor) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
    log.Printf(
        "[REQ] %s %s -> %s.%s",
        ctx.Method(),
        ctx.Path(),
        meta.ControllerType.Name(),  // "UserController"
        meta.Method.Name,            // "GetUser"
    )
    return nil
}
```


## 부트스트랩 과정

### 1. Route 선언

```go
// cmd/demo/main.go
app.Route("GET", "/users/:id", (*UserController).GetUser)

// 라우트 인터셉터와 함께
app.Route("GET", "/admin/users/:id", (*AdminController).GetUser,
    route.WithInterceptors((*AuthInterceptor)(nil)),  // nil 포인터 → Container에서 Resolve
)
```

### 2. RouteSpec 수집

```go
// app.go
func (a *app) Route(method string, path string, handler any, opts ...router.RouteOption) {
    // HTTP 메서드를 대문자로 변환해 대소문자 불일치 방지
    method = strings.ToUpper(strings.TrimSpace(method))

    spec := router.RouteSpec{
        Method:  method,
        Path:    path,
        Handler: handler,
    }

    for _, opt := range opts {
        opt(&spec)
    }

    a.routes = append(a.routes, spec)
}
```

### 3. HandlerMeta 생성 및 라우트 인터셉터 Resolve

부트스트랩 시점에 `NewHandlerMeta`로 메타데이터를 생성하고, 라우트 인터셉터를 처리합니다. nil 포인터로 전달된 인터셉터는 IoC Container에서 Resolve됩니다.

```go
// internal/bootstrap/bootstrap.go
router := spineRouter.NewRouter()

for _, route := range config.Routes {
    // 메서드 표현식 → HandlerMeta 변환
    meta, err := spineRouter.NewHandlerMeta(route.Handler)
    if err != nil {
        return err
    }

    // 라우트 인터셉터 Resolve
    resolved := make([]core.Interceptor, len(route.Interceptors))
    for i, interceptor := range route.Interceptors {
        interceptorType := reflect.TypeOf(interceptor)
        value := reflect.ValueOf(interceptor)

        if interceptorType.Kind() == reflect.Pointer && value.IsNil() {
            // nil 포인터 → Container에서 Resolve
            inst, err := container.Resolve(interceptorType)
            if err != nil {
                panic(err)
            }
            resolved[i] = inst.(core.Interceptor)
        } else {
            // 인스턴스 직접 사용
            resolved[i] = interceptor
        }
    }

    meta.Interceptors = resolved

    fullPath := joinPath(prefix, route.Path)
    router.Register(route.Method, fullPath, meta)
}
```

### 4. Controller 타입 수집

Router에 등록된 모든 Controller 타입을 수집합니다.

```go
// internal/router/router.go
func (r *DefaultRouter) ControllerTypes() []reflect.Type {
    seen := map[reflect.Type]struct{}{}
    var result []reflect.Type
    
    for _, route := range r.routes {
        t := route.Meta.ControllerType
        if _, ok := seen[t]; ok {
            continue
        }
        seen[t] = struct{}{}
        result = append(result, t)
    }
    
    return result
}
```

### 5. Warm-Up

부트스트랩 시점에 모든 Controller를 미리 인스턴스화합니다.

```go
// internal/bootstrap/bootstrap.go
if err := container.WarmUp(router.ControllerTypes()); err != nil {
    panic(err)
}
```

## 전체 흐름 요약

```mermaid
graph TD
    subgraph Bootstrap [부트스트랩 시점]
        RouteDef["app.Route('GET', '/users/:id',<br>(*UserController).GetUser,<br>route.WithInterceptors(...))"]
        NewHandlerMeta["NewHandlerMeta()"]
        ResolveInterceptors["라우트 Interceptor Resolve"]
        HandlerMeta["HandlerMeta<br>Type: *UserCtrl<br>Method: GetUser<br>Interceptors: [...]"]
        Register["Router.Register()"]

        RouteDef --> NewHandlerMeta
        NewHandlerMeta --> ResolveInterceptors
        ResolveInterceptors --> HandlerMeta
        HandlerMeta --> Register
    end

    subgraph Runtime [런타임 시점]
        Request["GET /users/123"]
        
        GlobalPre["글로벌 Interceptor PreHandle"]
        RouteCall["Router.Route(ctx)"]
        MetaReturn["HandlerMeta 반환"]
        
        BuildMeta["buildParameterMeta(meta.Method)"]
        ResolveArgs["ArgumentResolver 체인"]
        RoutePre["라우트 Interceptor PreHandle"]
        Invoke["Invoker.Invoke(meta.ControllerType, meta.Method)"]
        ReturnHandle["ReturnValueHandler"]
        PostHook["PostExecutionHook"]
        RoutePost["라우트 Interceptor PostHandle ↩"]
        GlobalPost["글로벌 Interceptor PostHandle ↩"]

        Request --> GlobalPre
        GlobalPre --> RouteCall
        RouteCall --> MetaReturn
        MetaReturn --> BuildMeta
        BuildMeta --> ResolveArgs
        ResolveArgs --> RoutePre
        RoutePre --> Invoke
        Invoke --> ReturnHandle
        ReturnHandle --> PostHook
        PostHook --> RoutePost
        RoutePost --> GlobalPost
    end
```


## 설계 원칙

### 1. 메서드 표현식 강제

일반 함수나 클로저가 아닌 메서드 표현식만 허용합니다.

```go
// ✓ 메서드 표현식
app.Route("GET", "/users/:id", (*UserController).GetUser)

// ❌ 일반 함수 (지원 안 함)
app.Route("GET", "/users/:id", func(id path.Int) User { ... })

// ❌ 인스턴스 메서드 (지원 안 함)
ctrl := &UserController{}
app.Route("GET", "/users/:id", ctrl.GetUser)
```

### 2. 포인터 리시버 강제

값 리시버는 지원하지 않습니다.

```go
// ✓ 포인터 리시버
func (c *UserController) GetUser(id path.Int) User

// ❌ 값 리시버 (지원 안 함)
func (c UserController) GetUser(id path.Int) User
```

### 3. 부트스트랩 검증

`NewHandlerMeta`는 부트스트랩 시점에 호출되므로, 잘못된 핸들러 등록은 서버 시작 전에 실패합니다.

```go
// 잘못된 핸들러 등록 시 부트스트랩 실패
meta, err := spineRouter.NewHandlerMeta(invalidHandler)
if err != nil {
    return err  // 서버 시작 전 에러
}
```

### 4. 글로벌 vs 라우트 인터셉터 분리

글로벌 인터셉터는 `app.Interceptor()`로 등록하고, 라우트 인터셉터는 `route.WithInterceptors()`로 등록합니다. Pipeline에서 실행 순서가 다릅니다.

```go
// 글로벌: 모든 요청에 적용 (라우팅 전 실행)
app.Interceptor(&CORSInterceptor{})

// 라우트: 특정 핸들러에만 적용 (라우팅 후, Controller 호출 전 실행)
app.Route("GET", "/admin/:id", (*AdminController).Get,
    route.WithInterceptors(&AuthInterceptor{}),
)
```


## 요약

| 구성 요소 | 역할 |
|----------|------|
| `HandlerMeta` | Controller 타입, 메서드 정보, 라우트 인터셉터를 담는 메타데이터 |
| `NewHandlerMeta()` | 메서드 표현식 → HandlerMeta 변환 |
| `RouteOption` / `WithInterceptors()` | 라우트 단위 인터셉터 지정 |
| `Router` | 요청 매칭 시 HandlerMeta 반환 (Interceptors 포함) |
| `Invoker` | HandlerMeta로 Controller 인스턴스 resolve 및 메서드 호출 |
| `Interceptor` | HandlerMeta로 실행 대상 정보 접근 |

**핵심**: HandlerMeta는 "무엇을 실행할 것인가"에 대한 메타데이터입니다. 부트스트랩 시점에 생성되어 런타임에 사용되며, 실행 모델과 비즈니스 로직을 연결하는 핵심 고리 역할을 합니다. 라우트 인터셉터를 포함함으로써 핸들러 단위의 횡단 관심사 적용도 지원합니다.