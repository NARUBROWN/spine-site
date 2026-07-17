＃ 安裝

如何安裝脊柱。

＃＃ 要求

- **前往 1.21 或更高版本**

```bash
# 檢查你的 Go 版本
go version
```

＃＃ 安裝

### 開始一個新項目

```bash
# 1.建立專案資料夾
mkdir my-app && cd my-app

# 2. 初始化Go模組
go mod init my-app

# 3.安裝脊柱
go get github.com/NARUBROWN/spine
```

### 新增到現有項目

```bash
go get github.com/NARUBROWN/spine
```

## 驗證安裝

建立一個 `main.go` 檔案並寫入以下程式碼：

```go
package main

import (
    "log"
    "time"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/pkg/boot"
)

func main() {
    app := spine.New()
    if err := app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	}); err != nil {
		log.Fatal(err)
	}
}
```

運行伺服器。

```bash
go run main.go
```

如果終端輸出如下，則表示成功。

```
________       _____             
__  ___/__________(_)___________ 
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/ 
       /_/        
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## 後續步驟

安裝完成！

在 [5 分鐘快速入門 →](/zh-Hant/learn/getting-started/first-app) 中建立您的第一個 API。