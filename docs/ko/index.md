---
layout: home
description: "Spine은 HTTP, WebSocket, 이벤트와 DTO 검증의 공개 계약을 제공하는 Go 백엔드 프레임워크입니다. CLI로 독립 구현을 선택해 프로젝트를 만들고 앱의 실행 계약을 검사합니다."

hero:
  name: "Spine"
  text: "익숙한 개발 방식으로,<br>더 빠른 서버를."
  tagline: "NestJS와 Spring에서 사용하던 컨트롤러와 서비스 구조로 Go 앱을 구성하세요. 생성자 주입과 인터셉터를 사용하고, 같은 자원에서 측정한 처리량과 메모리 사용량을 확인할 수 있습니다."
  actions:
    - theme: brand
      text: "첫 앱 만들기"
      link: /ko/learn/getting-started/first-app
    - theme: alt
      text: "성능 비교 보기"
      link: "#benchmarks"

features:
  - title: "익숙한 컨트롤러와 서비스"
    details: "컨트롤러는 요청을 받고 서비스는 업무를 처리합니다. Go의 구조체와 메서드로 각 역할을 나눕니다."
    link: /ko/learn/tutorial/2-controller
    linkText: "컨트롤러 작성법 보기"
  - title: "생성자로 연결하는 의존성"
    details: "필요한 서비스를 생성자 매개변수로 선언합니다. Spine이 등록된 생성자를 호출해 객체를 만들고 의존성을 연결합니다."
    link: /ko/learn/tutorial/3-dependency-injection
    linkText: "의존성 주입 보기"
  - title: "인터셉터에 모으는 공통 처리"
    details: "인증, 트랜잭션, 로깅을 업무 코드에서 분리합니다. 인터셉터를 등록하고 요청 흐름에서 실행할 시점을 정합니다."
    link: /ko/learn/tutorial/4-interceptor
    linkText: "인터셉터 사용법 보기"
---

<BenchmarkSection />

<SpineCloudSection />

<AgentStart />

<section class="home-start">

## 첫 앱 만들기

<div class="home-next-steps">

<a href="/ko/learn/getting-started/first-app">
<strong>CLI로 첫 앱 만들기</strong>
<span>CLI 설치와 프로젝트 생성부터 /health 응답 확인까지 따라갑니다.</span>
</a>

<a href="/ko/reference/examples/login">
<strong>JWT 로그인 예제 보기</strong>
<span>토큰을 발급하고 인증이 필요한 요청을 처리하는 구조를 살펴봅니다.</span>
</a>

<a href="/ko/reference/api/spine-app">
<strong>API 동작 확인하기</strong>
<span>생성자, 라우트, 인터셉터 등록 방법과 반환값을 확인합니다.</span>
</a>

</div>

</section>

<div class="home-support">

<EnterpriseSupportBanner />

</div>
