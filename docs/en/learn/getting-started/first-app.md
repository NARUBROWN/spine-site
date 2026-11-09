# Your First App

Create a new project with the Spine CLI and check that `GET /health` returns `{"status":"ok"}`. Read the generated files to see how the app is configured, validated, and run.

Go 1.25.5 or later is required, and the CLI recommends Go 1.27.3. The time needed to download dependencies for the first time depends on your environment.

## 1. Install the CLI and Check the Command

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

The channel selection commands and generated output below require CLI `v0.4.3-rc.1` or later. If `@latest` installs an older version, install the compatible RC below. If compatible stable platform tags are not yet available, use `--channel rc` when creating the project and check its `go.mod`.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.3-rc.1
spine version
```

`--channel main` selects stable tags. You can also select Main during interactive creation.

Use `spine version` to check the installed CLI version. If the command is not found, check PATH setup in the [installation guide](/en/learn/getting-started/installation).

## 2. Create a Project

Run these commands in the parent directory where you want to place the project. If a `hello-spine` directory already exists, use a different name.

```bash
spine new hello-spine --module example.com/hello-spine --channel main --no-interactive
cd hello-spine
```

The RC channel may select a newer core RC when you run it. To reproduce core `v0.7.1`, run the following in the generated project and check the compatible platform version in `go.mod`. A later `spine update` can change the version according to the channel.

```bash
go get github.com/NARUBROWN/spine@v0.7.1
go mod tidy
```


`new` uses the installed CLI’s verified recipe to select compatible Spine, Echo platform, and Echo versions, installs dependencies, checks the static contract, and builds the app. Check the generated `go.mod` for selected versions. If you use `--skip-install`, run `go mod tidy` and `go mod download all` separately. Installation does not initialize the app, run tests, or open a listener.

## 3. Inspect the Generated Structure

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── go.sum
├── main.go
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/
    └── controller/health_controller.go
```

The project contains `main.go`, which starts execution, and the `internal/application` directory, which holds the app configuration code. `spine.toml` tells the CLI the module path, execution entry point, location of the app configuration code, and port.

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
layout = "layered-v1"
platform = "echo"
recipe = "platform-contracts-preview"
dependency_channel = "main"
websocket_platform = "none"
validator = "none"
frontend_enabled = false
```

`BuildApplication()` in `internal/application/application.go` returns the app and its runtime options. The generated code registers the `HealthController` constructor and `GET /health`, and explicitly sets the HTTP runtime options, `boot.HTTPOptions`.

When adding a feature, put route, constructor, and interceptor registrations in this function or in a `Register(app) error` function it calls. [Project Structure](/en/learn/tutorial/1-project-structure) covers this in detail.

`main.go` is already generated, so you do not need to modify it. The following code shows the order of app configuration, validation, and execution.

```go
func main() {
    app, options, err := application.BuildApplication()
    if err != nil {
        log.Fatal(err)
    }
    if err := app.Validate(options); err != nil {
        log.Fatal(err)
    }
    if err := app.Run(options); err != nil {
        log.Fatal(err)
    }
}
```

## 4. Validate the App Configuration and Code

Run these commands in the root directory of the generated project.

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` diagnoses tools and project settings. `inspect` shows the app configuration registered in code, including routes and dependencies. The CLI calls this information extracted from registration code the execution contract.

`contract check` checks the execution contract. `verify` also runs `gofmt`, `go vet`, and Go tests in addition to the contract check. The generated `application_test.go` also checks `BuildApplication()` and `app.Validate(options)` without starting the server. Once all commands complete without errors, you are ready to run the server.

## 5. Run the App and Check the Response

```bash
spine dev
```

With the server running, open another terminal and send a request.

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

If the server returns the JSON response above, `GET /health` is working. Press `Ctrl+C` in the terminal running the server to stop the development server.

## Next Steps

- Follow [Project Structure](/en/learn/tutorial/1-project-structure) to add a feature to the generated project.
- Read [Controllers](/en/learn/tutorial/2-controller) to learn about routes and handlers.
- Follow [Database](/en/learn/tutorial/5-database) to connect Bun ORM to a repository.
