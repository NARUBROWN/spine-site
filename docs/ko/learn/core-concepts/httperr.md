# HTTP 오류

핸들러와 인터셉터는 공개 httperr 계약으로 상태와 공개 메시지를 표현합니다. 내부 원문은 일반 오류로 반환합니다.

## 공개 헬퍼

```go
func BadRequest(msg string) error
func Unauthorized(msg string) error
func NotFound(msg string) error
func InternalServerError(msg string) error
```

각각 400, 401, 404, 500입니다. 직접 &httperr.HTTPError{Status: 409, Message: "conflict"}처럼 다른 오류 상태도 표현할 수 있습니다. Status는 400~599만 유효합니다. 200이나 302를 오류로 반환하면 원문을 숨긴 500입니다. 성공 상태는 httpx.Response.Options, 이동은 httpx.Redirect를 사용합니다.

## 일반 오류와 감싸기

일반 오류의 응답은 500이며 내부 err.Error()를 노출하지 않습니다. HTTPError는 errors.As로 찾으므로 fmt.Errorf의 %w로 감쌀 수 있습니다. 명시한 HTTPError 메시지는 공개되므로 DB 오류 원문을 그대로 넣지 않습니다. 입력 파싱과 등록 검증기 실패는 핸들러 전에 400입니다.

## 인터셉터 우선순위

PreHandle은 바인딩 전에 실행하므로 인증 실패 요청은 손상된 본문보다 401이 우선합니다. 핸들러 뒤 BeforeResponse가 오류를 반환하면 그 오류가 HTTP 응답에 우선합니다. 여러 BeforeResponse가 실패하면 실행상 마지막 오류를 사용합니다. 이전 오류도 AfterCompletion에 보존합니다. 완료 훅은 응답 전송 시도 뒤여서 상태를 바꾸거나 커밋하는 장소가 아닙니다.

## 예제

[Errors and validation](/ko/learn/tutorial/7-error-handling) / [인터셉터](/ko/learn/tutorial/4-interceptor) / [트랜잭션](/ko/learn/tutorial/6-transaction)
