---
layout: home
description: "익숙한 개발 방식으로, 더 빠른 서버를. 익숙한 컨트롤러와 서비스 구조, 생성자 주입과 인터셉터를 Go로 이어가세요. 내부 랩에서 확인한 처리량과 메모리 결과를 공개합니다."

hero:
  name: "Spine"
  text: "익숙한 개발 방식으로,<br>더 빠른 서버를."
  tagline: "NestJS와 Spring에서 익숙했던 컨트롤러와 서비스 구조를 Go에서도 이어가세요. 생성자 주입과 인터셉터로 앱을 구성하고, 같은 자원에서 확인한 처리량과 메모리 차이를 살펴보세요."
  actions:
    - theme: brand
      text: "첫 앱 만들기"
      link: /ko/learn/getting-started/first-app
    - theme: alt
      text: "성능 비교 보기"
      link: "#benchmarks"

features:
  - title: "익숙한 컨트롤러와 서비스"
    details: "컨트롤러는 요청을 받고 서비스는 업무를 처리합니다. Go의 구조체와 메서드로 익숙한 책임 분리를 이어갑니다."
    link: /ko/learn/tutorial/2-controller
    linkText: "컨트롤러 작성법 보기"
  - title: "생성자로 연결하는 의존성"
    details: "필요한 서비스를 생성자 파라미터로 선언합니다. Spine이 등록한 생성자로 객체를 만들고 의존성을 연결합니다."
    link: /ko/learn/tutorial/3-dependency-injection
    linkText: "의존성 주입 보기"
  - title: "인터셉터에 모으는 공통 처리"
    details: "인증, 트랜잭션, 로깅을 업무 코드에서 분리합니다. 인터셉터를 등록하고 요청 흐름에서 실행할 시점을 정합니다."
    link: /ko/learn/tutorial/4-interceptor
    linkText: "인터셉터 사용법 보기"
---

## 익숙한 구조를 Go 코드로 이어가세요

사용자 조회 앱에서도 컨트롤러와 서비스를 나누고 생성자로 연결합니다. 다음은 생성자와 라우트를 등록하는 부분입니다. 생성자 함수와 컨트롤러 메서드는 앱 코드에 미리 정의합니다.

```go
app := spine.New()

app.Constructor(NewUserService, NewUserController)
app.Route("GET", "/users", (*UserController).GetUser)
```

Spine은 `NewUserController`의 파라미터 타입을 보고 `UserService`를 전달합니다. `GET /users` 요청은 `UserController.GetUser` 메서드로 연결됩니다.

[서버 시작 코드와 전체 프로젝트는 첫 번째 앱 문서에서 확인하세요.](/ko/learn/getting-started/first-app)

<BenchmarkSection />

## 익숙한 방식으로 첫 앱을 만드세요

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
