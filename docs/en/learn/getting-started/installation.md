# Installation and first app

Create an HTTP app with Spine CLI `v0.4.4` and core `v0.7.5`. See [release channels](/en/community/release-channels) for CLI installation and app dependency channels.

## Requirements

The validator in this example requires Go 1.26 or later. Add `GOBIN` or the default `GOPATH/bin` to `PATH`.

```sh
go version
```

<span id="preview-cli"></span>

## Install the stable CLI {#install-cli}

```sh
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

Run `spine version` to check the installed version. To reproduce this CLI version, use `@v0.4.4` in the install command. `spine update` updates app dependencies.

## Create a project

```sh
spine new my-app --module example.com/my-app --channel main --validator playground --no-interactive
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
