# First App

Install Spine CLI, generate a project, and serve `GET /health` in about five minutes. Go 1.25.5 or later is required; the CLI recommends Go 1.27.3. Initial dependency downloads may take longer depending on your environment.

## 1. Install and inspect the CLI

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4
spine version
```

`spine version` prints `spine-cli 0.1.4`. If the command is unavailable, follow the Go executable path instructions in [Installation](/en/learn/getting-started/installation).

## 2. Create a project

Run this from the parent directory where you want to create the project.

```bash
spine new hello-spine --module example.com/hello-spine
cd hello-spine
go mod tidy
```

The CLI pins Spine `v0.5.1` in `go.mod`. Prepare dependencies with `go mod tidy`.

## 3. Inspect the generated structure

```text
hello-spine/
├── .gitignore
├── README.md
├── go.mod
├── main.go
├── spine.toml
└── internal/application/
    ├── application.go
    └── application_test.go
```

`spine.toml` tells the CLI the module, entrypoint, and location of application registration code.

```toml
module = "example.com/hello-spine"
entrypoint = "."
composition = "./internal/application"
port = 8080
```

`BuildApplication()` in `internal/application/application.go` assembles the app and boot options. The generated code registers the `HealthController` constructor and `GET /health`, with explicit `boot.HTTPOptions`. Keep route, constructor, and interceptor registrations in this function or in `Register(app) error` functions called from it.

`main.go` is already generated. You can inspect its execution flow without replacing it:

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

## 4. Verify the contract and local code

```bash
spine doctor
spine inspect
spine contract check
spine verify
```

`doctor` diagnoses tools and project configuration; `inspect` shows the registered execution contract. `contract check` validates the static contract, and `verify` runs contract, gofmt, vet, and test checks. The generated `application_test.go` also checks `BuildApplication()` and `app.Validate(options)` without starting a server.

## 5. Run and check the response

```bash
spine dev
```

Send a request from another terminal:

```bash
curl http://localhost:8080/health
```

```json
{"status":"ok"}
```

Stop the development server with `Ctrl+C`. You now have a CLI-generated project, reusable application assembly, static contract checks, and an observed HTTP response.

## Next steps

- [Project Structure](/en/learn/tutorial/1-project-structure) — Add a feature to the generated project
- [Controllers](/en/learn/tutorial/2-controller) — Inspect CLI-generated routes and handlers
- [Database](/en/learn/tutorial/5-database) — Connect a repository to Bun ORM
