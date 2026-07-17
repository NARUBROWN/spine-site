# 安装

如何安装脊柱。

## 要求

- **转到 1.21 或更高版本**

```bash
# 检查你的 Go 版本
go version
```

## 安装

### 开始一个新项目

```bash
# 1.创建项目文件夹
mkdir my-app && cd my-app

# 2. 初始化Go模块
go mod init my-app

# 3.安装脊柱
go get github.com/NARUBROWN/spine
```

### 添加到现有项目

```bash
go get github.com/NARUBROWN/spine
```

## 验证安装

创建一个 `main.go` 文件并写入以下代码：

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

运行服务器。

```bash
go run main.go
```

如果终端输出如下，则说明成功。

```
________       _____
__  ___/__________(_)___________
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/
       /_/
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## 后续步骤

安装完成！

在 [5 分钟快速入门 →](/zh-Hans/learn/getting-started/first-app) 中创建您的第一个 API。
