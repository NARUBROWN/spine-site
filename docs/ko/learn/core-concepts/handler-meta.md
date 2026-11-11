# 핸들러 메타데이터

::: info 0.7.5
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

`core.HandlerMeta`는 핸들러 정보의 사본입니다. 실행 등록이나 writer를 바꾸는 객체가 아닙니다.

## 필드 {#fields}

```go
type HandlerMeta struct {
	ControllerType   reflect.Type
	MethodName       string
	Signature        reflect.Type
	PathKeys         []string
	InterceptorTypes []reflect.Type
	CallbackRoute    bool
}
```

## 조회 {#methods}

`FunctionType()`은 함수 타입, `ArgumentOffset()`은 콜백이면 0이고 기존 메서드 표현식이면 1입니다. `HandlerName()`은 콜백에서 컨트롤러의 RegisterRoutes 이름을 반환하며 개별 콜백의 고유 식별자가 아닙니다. PathKeys는 값이 아닌 경로 키 이름입니다. 기존 Method, Callback, Interceptors 필드 대신 공개 조회와 InterceptorTypes를 사용합니다.

## 시점과 수명 {#lifetime}

전역 PreHandle은 라우팅 전에 빈 메타데이터를 받습니다. 라우트 PreHandle은 선택된 메타데이터를 받고 입력 바인딩보다 먼저 실행합니다. 필드나 슬라이스를 수정해도 등록을 바꾸지 않습니다. 요청 정보는 Ctx의 공개 뷰에서 조회하세요.

[공개 컨텍스트](/ko/reference/api/execution-context) | [인터셉터](/ko/learn/tutorial/4-interceptor)
