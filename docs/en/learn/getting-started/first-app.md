# Installation and first app

::: info 0.7.5 API
This documentation targets the 0.7.5 API. Check [available versions](/en/community/versions) for published tags and compatible platforms.
:::

Choose the CLI installation channel separately from the app dependency channel. This guide uses a Preview app with the 0.7.5 API. See [release channels](/en/community/release-channels) for stable releases.

## Requirements

Use Go 1.26 or later and check the chosen modules’ go directives. Include GOBIN or the default GOPATH/bin in PATH.

```sh
go version
```

## Install Preview CLI {#preview-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

preview is a moving branch. Record its version and commit and use a fixed tag for reproducibility. Install the stable CLI with @latest. spine update changes app dependencies, not the CLI or app source.

## Create a project

```sh
spine new my-app --module example.com/my-app --channel preview --validator playground --no-interactive
cd my-app
go list -m all
spine doctor
spine inspect
```

The CLI recipe selects compatible versions. Verify the core 0.7.5 API and platform cohort in go.mod. The default layout is layered-v1. --validator playground assembles validation in BuildApplication; the default validator none does not enable tag validation. Generation does not start app resources or listeners.

```text
my-app/
├── main.go
├── go.mod
├── spine.toml
├── internal/application/
│   ├── application.go
│   └── application_test.go
└── src/controller/health_controller.go
```

## Verify and run

```sh
spine contract check
spine verify
spine dev
# In another terminal
curl http://localhost:8080/health
```

Expect {"status":"ok"} and stop with Ctrl+C. Generated main calls BuildApplication, app.Validate, then app.Run. Validate does not run constructors or connect to a DB, so test actual requests too.

## Recover dependency metadata

After --skip-install or manual changes, download module metadata if MODULE_GRAPH_UNAVAILABLE occurs.

```sh
go mod tidy
go mod download all
spine contract check
```

## Next steps

[Project structure](/en/learn/tutorial/1-project-structure) / [Controllers](/en/learn/tutorial/2-controller) / [Platforms](/en/learn/getting-started/platforms)
