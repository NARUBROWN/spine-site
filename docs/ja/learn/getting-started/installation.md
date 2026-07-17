# インストール

Spineをインストールする方法です。

## 前提条件

- **Go 1.21 以上**


```bash
# Goのバージョン確認
go version
```

## インストール

### 新規プロジェクトの開始


```bash
# 1. プロジェクトフォルダの作成
mkdir my-app && cd my-app

# 2. Goモジュールの初期化
go mod init my-app

# 3. Spineのインストール
go get github.com/NARUBROWN/spine
```

### 既存のプロジェクトへの追加


```bash
go get github.com/NARUBROWN/spine
```

## インストールの確認

`main.go` ファイルを作成し、以下のコードを記述します。


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

サーバーを起動します。


```bash
go run main.go
```

ターミナルに以下のように出力されれば成功です。

```
________       _____             
__  ___/__________(_)___________ 
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/ 
       /_/        
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## 次のステップ

インストールが完了しました！

[5分クイックスタート →](/ja/learn/getting-started/first-app)で最初のAPIを作成してみましょう。