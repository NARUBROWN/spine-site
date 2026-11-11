# query.Values 호환 API

::: info 0.7.5
0.7.5 API 기준의 문서입니다. 설치 가능한 태그와 호환 플랫폼은 [버전 현황](/ko/community/versions)에서 확인하세요.
:::

기존 앱 유지용 Deprecated 참조입니다. 새 코드는 input.Query[T]를 사용합니다.

## 호환 동작 {#compatibility}

| 메서드 | 동작 |
| --- | --- |
| Get / String | 첫 값, 없으면 빈 문자열 |
| Int(key, def) | 누락과 변환 실패 모두 def |
| GetBoolByKey(key, def) | 기존 true/false, yes/no, on/off 표기, 실패하면 def |
| Has | 빈 값이어도 키가 있으면 true |

Values와 Pagination은 값 인자로만 호환 지원합니다. 같은 핸들러에서 새 Path/Query/Header와 혼용하지 않습니다. 새 DTO는 잘못된 숫자를 기본값으로 바꾸지 않고 400으로 거부합니다. 누락 구분에는 포인터 필드를 사용합니다.

[현재 쿼리 입력](/ko/learn/core-concepts/query-values) | [DTO 정의](/ko/learn/tutorial/2-controller#dto-validation)
