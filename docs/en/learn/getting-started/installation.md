# Installation

How to install Spine.

## Requirements

- **Go 1.21 or higher**

```bash
# Check Go version
go version
```

## Installation

### Start a New Project

```bash
# 1. Create project folder
mkdir my-app && cd my-app

# 2. Initialize Go module
go mod init my-app

# 3. Install Spine
go get github.com/NARUBROWN/spine
```

### Add to Existing Project

```bash
go get github.com/NARUBROWN/spine
```

## Verify Installation

Create a `main.go` file and write the following code.

```go
package main

import "github.com/NARUBROWN/spine"

func main() {
    app := spine.New()
    app.Run(":8080")
}
```

Run the server.

```bash
go run main.go
```

Success if you see the following output in the terminal.

```
________       _____             
__  ___/__________(_)___________ 
_____ \___  __ \_  /__  __ \  _ \
____/ /__  /_/ /  / _  / / /  __/
/____/ _  .___//_/  /_/ /_/\___/ 
       /_/        
2026/01/19 14:37:59 [Bootstrap] Spine version: v0.2.1
```

## Next Steps

Installation is complete!

Create your first API at [5-Minute Quickstart →](/en/learn/getting-started/first-app).
