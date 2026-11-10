# 핸들러 메타데이터 (HandlerMeta)

`core.HandlerMeta`는 선택된 핸들러와 라우트의 메타데이터를 인터셉터에 전달합니다. `v0.7.1`에서는 기존 메서드 표현식과 `RegisterRoutes` 안의 콜백을 모두 설명할 수 있습니다.

## 필드와 메서드

`ControllerType`은 컨트롤러 타입, `PathKeys`는 라우트의 경로 변수 이름 순서, `Interceptors`는 라우트 인터셉터 목록입니다. `Method`는 기존 메서드 표현식의 정보이며, `Callback`은 새 콜백을 담은 `reflect.Value`입니다. 특정 필드 하나만 모든 등록 방식에서 유효하다고 가정하지 마세요.

`FunctionType()`은 콜백 또는 메서드의 함수 타입을 반환합니다. `ArgumentOffset()`은 콜백이면 0, 기존 메서드이면 수신자에 해당하는 1입니다. `HandlerName()`은 콜백에서 컨트롤러 타입과 `RegisterRoutes`를, 기존 메서드에서 컨트롤러 타입과 메서드 이름을 반환합니다. 콜백 이름은 개별 함수의 고유 식별자가 아닙니다.

전역 `PreHandle`은 라우팅 전에 호출되므로 빈 메타데이터를 받습니다. 이때 `ControllerType`과 `FunctionType()`은 nil이고 `HandlerName()`은 빈 문자열입니다. 라우트 인터셉터는 라우팅과 입력 해석 후 선택된 메타데이터를 받습니다.

## 실행 예제

다음 독립 앱은 라우트 인터셉터에서 `HandlerName()`과 `ArgumentOffset()`을 읽어 요청 컨텍스트에 저장합니다. Spine `v0.7.1`과 호환 Echo 플랫폼을 설치한 별도 Go 모듈에 `main.go`로 저장하고 `go run .`으로 실행하세요.

```bash
go get github.com/NARUBROWN/spine@v0.7.1 github.com/NARUBROWN/spine-echo-platform@v0.2.0
```

```go
package main

import (
	"github.com/NARUBROWN/spine"
	echoplatform "github.com/NARUBROWN/spine-echo-platform"
	"github.com/NARUBROWN/spine/core"
	"github.com/NARUBROWN/spine/pkg/api"
	"github.com/NARUBROWN/spine/pkg/boot"
	"github.com/NARUBROWN/spine/pkg/constructor"
	"github.com/NARUBROWN/spine/pkg/httpx"
	spinectx "github.com/NARUBROWN/spine/pkg/spine"
	"log"
)

type Inspector struct{}

func (*Inspector) PreHandle(ctx core.ExecutionContext, meta core.HandlerMeta) error {
	ctx.Set("handler", meta.HandlerName())
	ctx.Set("argument_offset", meta.ArgumentOffset())
	return nil
}
func (*Inspector) PostHandle(core.ExecutionContext, core.HandlerMeta)                  {}
func (*Inspector) BeforeResponse(core.ExecutionContext, core.HandlerMeta, error) error { return nil }
func (*Inspector) AfterCompletion(core.ExecutionContext, core.HandlerMeta, error)      {}

type Controller struct{}

func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) {
	r.GET("/meta", func(ctx spinectx.Ctx) httpx.Response[map[string]any] {
		handler, _ := ctx.Get("handler")
		offset, _ := ctx.Get("argument_offset")
		return httpx.Response[map[string]any]{Body: map[string]any{"handler": handler, "argument_offset": offset}}
	}, api.Interceptors(&Inspector{}))
}
func main() {
	app := spine.New(echoplatform.Option())
	app.Constructor(constructor.Controller(&Controller{}))
	if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil {
		log.Fatal(err)
	}
}
```

다른 터미널에서 요청하면 `argument_offset`은 0이고 핸들러 이름은 `*main.Controller.RegisterRoutes`입니다. 이 이름은 Go 패키지와 타입에 따라 달라집니다.

```bash
curl http://localhost:8080/meta
```

## 등록과 실행

새 컨트롤러는 `RegisterRoutes(*api.Registry)`에서 콜백과 `api.Interceptors(...)` 옵션을 등록합니다. 기존 `app.Route`와 `route.WithInterceptors`도 호환을 위해 유지되지만 `app.Route`는 Deprecated입니다. 두 방식의 경로를 중복 등록하면 준비 단계에서 거부됩니다.

요청 시 전역 인터셉터, 라우팅과 인자 해석, 라우트 인터셉터, 핸들러 순서로 실행됩니다. `PathKeys`는 요청값이 아니라 경로 변수의 이름입니다. 이름 기반 DTO는 `path` 태그를 사용합니다. v0.7.1에서는 경로 변수가 여러 개일 때 스칼라 `input.Path[T]` 인자를 경로에 선언한 순서대로 하나씩 받습니다. 인자 수와 경로 변수 수는 같아야 하며, 스칼라와 경로 DTO 또는 기존 경로 래퍼는 같은 핸들러에서 혼용할 수 없습니다.

[인터셉터 튜토리얼](/ko/learn/tutorial/4-interceptor)에서 후처리와 오류 흐름을, [컨트롤러와 라우트 전환](/ko/learn/migration/preview-controller-routes)에서 등록 방법을 확인하세요.
