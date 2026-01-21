# 설치

Spine을 설치하는 방법.

## 요구사항

- **Go 1.21 이상**

```bash
# Go 버전 확인
go version
```

## 설치

### 새 프로젝트 시작

```bash
# 1. 프로젝트 폴더 생성
mkdir my-app && cd my-app

# 2. Go 모듈 초기화
go mod init my-app

# 3. Spine 설치
go get github.com/NARUBROWN/spine
```

### 기존 프로젝트에 추가

```bash
go get github.com/NARUBROWN/spine
```

## 설치 확인

`main.go` 파일을 생성하고 다음 코드를 작성하세요.

```go
package main

import (
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
	})
}
```

서버를 실행합니다.

```bash
go run main.go
```

터미널에 다음과 같이 출력되면 성공입니다.

```
________       _____             
__  ___/__________(_)___________ 
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/ 
       /_/        
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## 다음 단계

설치가 완료되었습니다!

[5분 퀵스타트 →](/ko/learn/getting-started/first-app)에서 첫 번째 API를 만들어보세요.