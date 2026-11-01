---
layout: home
description: "Spine은 생성자 주입과 요청 실행 파이프라인을 제공하는 Go 백엔드 프레임워크입니다. 사용 예시와 내부 랩 성능 비교를 확인하고 첫 앱을 만들어보세요."

hero:
  name: "Spine"
  text: "익숙한 서버 구조를 Go로 만드세요"
  tagline: "생성자 주입으로 컨트롤러와 서비스를 연결하세요. 라우트와 인터셉터를 등록하면 Spine이 요청의 해석부터 응답 완료까지 실행 흐름을 관리합니다."
  actions:
    - theme: brand
      text: "첫 앱 만들기"
      link: /ko/learn/getting-started/first-app
    - theme: alt
      text: "성능 비교 보기"
      link: "#benchmarks"

features:
  - title: "의존성은 생성자로 연결하세요"
    details: "필요한 객체를 생성자 파라미터로 선언합니다. Spine이 등록한 생성자로 객체를 만들고 의존성을 연결합니다."
    link: /ko/learn/tutorial/3-dependency-injection
    linkText: "의존성 주입 보기"
  - title: "입출력은 타입으로 표현하세요"
    details: "메서드 파라미터로 요청 값을 받고 반환 타입으로 응답을 표현합니다. 컨트롤러에는 처리할 작업을 작성합니다."
    link: /ko/learn/tutorial/2-controller
    linkText: "컨트롤러 작성법 보기"
  - title: "공통 처리는 인터셉터에 모으세요"
    details: "인증, 트랜잭션, 로깅처럼 여러 요청에서 반복되는 처리를 분리하고 실행할 시점에 배치합니다."
    link: /ko/learn/tutorial/4-interceptor
    linkText: "인터셉터 사용법 보기"
---

## 생성자를 등록하고 요청을 연결하세요

다음은 사용자 조회 앱에서 생성자와 라우트를 등록하는 부분입니다. 생성자 함수와 컨트롤러 메서드는 앱 코드에 미리 정의합니다.

```go
app := spine.New()

app.Constructor(NewUserService, NewUserController)
app.Route("GET", "/users", (*UserController).GetUser)
```

Spine은 `NewUserController`의 파라미터 타입을 보고 `UserService`를 전달합니다. `GET /users` 요청은 `UserController.GetUser` 메서드로 연결됩니다.

[서버 시작 코드와 전체 프로젝트는 첫 번째 앱 문서에서 확인하세요.](/ko/learn/getting-started/first-app)

<BenchmarkSection />

## 앱을 만들며 익히세요

<div class="home-next-steps">

<a href="/ko/learn/getting-started/first-app">
<strong>사용자 조회 API 만들기 <span aria-hidden="true">→</span></strong>
<span>프로젝트 생성부터 요청을 보내고 응답을 확인하는 과정까지 따라갑니다.</span>
</a>

<a href="/ko/reference/examples/login">
<strong>JWT 로그인 예제 보기 <span aria-hidden="true">→</span></strong>
<span>토큰을 발급하고 인증이 필요한 요청을 처리하는 구조를 살펴봅니다.</span>
</a>

<a href="/ko/reference/api/spine-app">
<strong>API 동작 확인하기 <span aria-hidden="true">→</span></strong>
<span>생성자, 라우트, 인터셉터 등록 방법과 반환값을 확인합니다.</span>
</a>

</div>
