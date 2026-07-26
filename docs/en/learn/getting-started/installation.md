# Installation

How to install Spine.

## Requirements

- **Go 1.25.5 or higher** (the version declared by Spine's current `go.mod`)

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
go get github.com/NARUBROWN/spine@v0.5.1
```

### Add to Existing Project

```bash
go get github.com/NARUBROWN/spine@v0.5.1
```

## Verify Installation

Create a `main.go` file and write the following code.

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

Run the server.

```bash
go run main.go
```

The process should stay running and listen on `:8080`. Stop it with `Ctrl+C`; graceful shutdown waits up to 10 seconds.

For deployment checks, call `app.Validate(opts)` before `Run`. Validation is network-free and reports all configuration issues in one `*boot.ConfigError`; `Run` performs the same preflight automatically.

::: tip Current version
This site and its examples target Spine v0.5.1.
:::

## Next Steps

Installation is complete!

Create your first API at [5-Minute Quickstart →](/en/learn/getting-started/first-app).
