# Installation

From Spine `v0.6.0`, the official starting point is CLI `new`. Install the latest released CLI, create a project, and check the development server response.

## Requirements

- Go 1.25.5 or later is required. The CLI recommends Go 1.27.3.
- The directory where Go installs executables must be in `PATH`. If you have not set `GOBIN`, the default directory is `$(go env GOPATH)/bin`.

```bash
go version
```

Check that the reported Go version is 1.25.5 or later.

## Install the CLI

Run the following commands to install the CLI and check its version.

```bash
go install github.com/NARUBROWN/spine-cli@latest
spine-cli version
```

Use `spine-cli version` to check the installed CLI version.

If the `spine-cli` command cannot be found and you have not set `GOBIN` separately, run the following commands in Bash or Zsh to add the directory to the current session's path. To keep using it in future sessions, save the same setting in your shell startup file. If you have set `GOBIN`, add that directory instead.

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine-cli version
```

## Create a New Project

Run these commands in the parent directory where you want to place the project. If a `my-app` directory already exists, use a different name.

```bash
spine-cli new my-app --module example.com/my-app
cd my-app
```

`new` uses the installed CLI’s verified recipe to select compatible Spine, Echo platform, and Echo versions, installs dependencies, checks the static contract, and builds the app. Check the generated `go.mod` for selected versions. If you use `--skip-install`, run `go mod tidy` and `go mod download all` separately. Installation does not initialize the app, run tests, or open a listener.

The generated `spine.toml` contains the following:

```toml
module = "example.com/my-app"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
```

`BuildApplication()` in `internal/application/application.go` registers the components and `GET /health`. The generated `main.go` calls this function, validates the configuration with `app.Validate(options)`, and starts the server with `app.Run(options)`.

## Validate and Run

```bash
spine-cli doctor
spine-cli inspect
spine-cli contract check
spine-cli verify
```

Check that each command completes without errors.

| Command | What it checks |
| --- | --- |
| `spine-cli doctor` | Go tools and project settings |
| `spine-cli inspect` | App configuration registered in code, including routes and dependencies |
| `spine-cli contract check` | Validity of the execution contract extracted from the registration code |
| `spine-cli verify` | The execution contract and the results of `gofmt`, `go vet`, and Go tests |

The generated `application_test.go` checks `BuildApplication()` and `app.Validate(options)` without starting the server. This step validates the code and app configuration. You will check the actual HTTP response in the next step.

Once the checks pass, run `spine-cli dev` and check the actual HTTP response from another terminal.

```bash
spine-cli dev
```

```bash
curl http://localhost:8080/health
```

If the server returns `{"status":"ok"}`, it has handled the request. Press `Ctrl+C` in the terminal running the server to stop it. After connecting an external database or message broker, or deploying the app, you must also check its behavior in that environment.

## Next Steps

Follow [Your First App](/en/learn/getting-started/first-app) to learn what the generated files do, or [Project Structure](/en/learn/tutorial/1-project-structure) to add a feature.
