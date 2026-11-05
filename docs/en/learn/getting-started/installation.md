# Installation

From Spine `v0.6.0`, the official starting point is CLI `new`. Install the latest released CLI, create a project, and check the development server response.

See [Release channels and installation](/en/community/release-channels) to choose Preview, RC, or stable and understand the publication process.

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
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

To update the CLI itself, rerun the `go install` command above. `spine update` updates project dependencies for the selected recipe; it does not update the CLI executable or rewrite application source.

Use `spine version` to check the installed CLI version. Update to CLI 0.4.2 or later for the 0.6.5 recipe.

If the `spine` command cannot be found and you have not set `GOBIN` separately, run the following commands in Bash or Zsh to add the directory to the current session's path. To keep using it in future sessions, save the same setting in your shell startup file. If you have set `GOBIN`, add that directory instead.

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
spine version
```

## Install the Preview CLI {#preview-cli}

For the v0.7.0 Preview, use `@preview` to install the latest commit on the CLI’s Preview branch. This can include changes between published tags. General stable installation uses `@latest`.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

Run `spine version` to check the installed tag or pseudo-version. The `platform-contracts-preview` recipe resolves `@preview` for core and each selected platform or playground, then records the resolved versions in `go.mod`. The `spine.toml` example below shows the stable recipe. Preview’s `--skip-install` still requires Go and network access or module proxy cache for version resolution; it skips installation and build verification.

Installing the CLI does not change an existing app’s recipe. Follow the [Preview migration guide](/en/learn/migration/v0.7.0-preview) to migrate an existing app and enable Swagger UI or ReDoc.

## Create a New Project

Run these commands in the parent directory where you want to place the project. If a `my-app` directory already exists, use a different name.

```bash
spine new my-app --module example.com/my-app
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
recipe = "platform-contracts-v0.6.5"
websocket_platform = "none"
validator = "none"
```

`BuildApplication()` in `internal/application/application.go` registers the components and `GET /health`. The generated `main.go` calls this function, validates the configuration with `app.Validate(options)`, and starts the server with `app.Run(options)`.

## Validate and Run

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

Check that each command completes without errors.

| Command | What it checks |
| --- | --- |
| `spine doctor` | Go tools and project settings |
| `spine inspect` | App configuration registered in code, including routes and dependencies |
| `spine contract check` | Validity of the execution contract extracted from the registration code |
| `spine verify` | The execution contract and the results of `gofmt`, `go vet`, and Go tests |

The generated `application_test.go` checks `BuildApplication()` and `app.Validate(options)` without starting the server. This step validates the code and app configuration. You will check the actual HTTP response in the next step.

Once the checks pass, run `spine dev` and check the actual HTTP response from another terminal.

```bash
spine dev
```

```bash
curl http://localhost:8080/health
```

If the server returns `{"status":"ok"}`, it has handled the request. Press `Ctrl+C` in the terminal running the server to stop it. After connecting an external database or message broker, or deploying the app, you must also check its behavior in that environment.

## Recover from Module Cache Errors

Static contract inspection reads the module graph offline. If inspection reports `MODULE_GRAPH_UNAVAILABLE` after generating files with `--skip-install` or changing dependencies manually, prepare the full module metadata and check again.

```bash
go mod tidy
go mod download all
spine contract check
spine verify
```

[Select platforms and DTO validation](/en/learn/getting-started/platforms)

## Next Steps

Follow [Your First App](/en/learn/getting-started/first-app) to learn what the generated files do, or [Project Structure](/en/learn/tutorial/1-project-structure) to add a feature.
