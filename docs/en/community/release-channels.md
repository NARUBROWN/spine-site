# Release channels and installation

Spine and its CLI progress through Preview, RC, and stable (Production) releases. Choose a CLI channel according to whether you want to try new work, validate a release candidate, or use a stable version.

This page explains how Spine and the CLI are published. Configure your application’s development, staging, and production environments separately.

## Choose a channel {#choose}

| Channel | Use it to | CLI installation target |
| --- | --- | --- |
| Preview | Try ongoing changes and new APIs | `@preview` branch |
| RC | Validate a candidate promoted from Preview | `@rc` branch or a published RC tag |
| Stable (Production) | Use the baseline for general development and production | `@latest` or a published stable tag |

`@preview` and `@rc` select the latest commit on the corresponding branch. Go may resolve it to a version tag on that commit or to a pseudo-version identifying the commit. `@latest` prefers stable releases. [Go version queries](https://go.dev/ref/mod#version-queries)

## Install a CLI channel {#install}

Choose one channel below. Reinstalling into the same location replaces the existing `spine` executable. Set different `GOBIN` directories to keep multiple channels side by side. See [Installation](/en/learn/getting-started/installation) for Go and PATH setup.

### Stable {#stable}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

This is the general starting point. Check the installed version with `spine version`. `@main` selects code from the main branch and is distinct from installing a stable release with `@latest`.

### Preview {#preview}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

Use this to try changes merged into Preview. It can include changes between published Preview tags. Pin the relevant tag when reproducing a specific verified candidate.

### RC {#rc}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@rc
spine version
```

This installs the current RC branch. Preview changes appear after promotion; earlier features and recipes may remain before that. An existing branch alone does not mean an official RC has been published. To reproduce a verified candidate, check an actually published `vX.Y.Z-rc.N` tag and its validation record.

## CLI channels and application dependencies {#dependencies}

The installed CLI and application dependency channel are independent. Select `--channel main` with `spine new` for stable tags. `rc` selects RC or higher stable tags, and `preview` queries Preview branches. Interactive creation defaults to Preview, so select Main explicitly for a stable application.

```bash
spine new channel-check --module example.com/channel-check --channel main
cd channel-check
go list -m github.com/NARUBROWN/spine
```

The selected channel is recorded as `dependency_channel` in `spine.toml` and retained by `spine update`. Updating the CLI does not change existing projects. Check and version `go.mod` and `go.sum` after creation.

## How releases are published {#process}

Verified candidates progress through **Preview → RC → Production**. Merging a branch and publishing a tag are separate steps.

1. Merge changes into Preview and pass source CI.
2. Select the source and dependency combination, then run tests and public consumer checks for that source. The CLI also checks public installation on Linux, macOS, and Windows.
3. A maintainer reviews the plan and results and approves publication of a new tag.
4. Install and test the published tag again, then record successful results in a release manifest.
5. Promote the candidate to RC and then main after observation and promotion checks. Required channel version pin changes are checked by policy; other code or dependency changes require validation from a new Preview.
6. Publish the GitHub Release after public validation of the stable tag succeeds. Core must also complete validation of the full combination with all six platforms.

Spine core and platforms follow **core candidate publication → publication of six platforms → completion of validation for the full combination**. A published core tag alone is distinct from a complete platform combination ready for promotion.

The CLI has its own version and release schedule. A core version change does not require matching CLI version numbers. Check the selected combination when generating or updating an app.

## Observation periods {#observation}

| Gate | Current policy | Starting point or scope |
| --- | --- | --- |
| Preview to RC | At least 72 hours | After creation of the manifest completing Preview public validation |
| RC to stable | At least 24 hours | After creation of the manifest completing RC public validation |
| Additional stable release interval | Core: 168 hours; CLI: 0 hours | Relative to the previous stable release of each repository |

These are not automatic release schedules. Validation and approval must also pass. An urgent reduction requires a recorded reason and does not remove tests, public validation, or approval.

## Check tags and validation records {#evidence}

- Preview tags use `vX.Y.Z-preview.N`, RC tags use `vX.Y.Z-rc.N`, and stable tags use `vX.Y.Z`.
- Preview and RC record validation through tags and GitHub Actions artifacts named `release-manifest-<tag>`. A candidate tag can exist without an entry in GitHub Releases.
- Stable releases attach the validation manifest to the GitHub Release. For core, check completion of the full platform combination.
- Check a successful publication run, matching tag source and dependencies, and public installation results together when choosing a candidate.

See [Current Release](/en/community/changelog) for tags and published versions. Installing from a branch does not prove publication of a verified candidate tag.

## Pin or restore a version {#pin}

For CI and production, pin an actually published CLI tag and version application source, `go.mod`, and `go.sum` together. A CLI tag pins the tool’s code only. The dynamic Preview recipe still resolves `@preview` when the same CLI runs `new` or `update`, so reproduce an app from its saved source and dependencies. This example pins the published compatible CLI RC `v0.4.3-rc.1`; it does not select the latest version.

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.3-rc.1
spine version
```

Restoring an older CLI does not restore application source, `go.mod`, or `go.sum`. Restore the app separately from its Git history. Published tags are not moved or reused; corrected candidates receive a new number.

## Related documentation {#related}

- [First App](/en/learn/getting-started/first-app)
- [Spine release operations](https://github.com/NARUBROWN/spine/blob/preview/RELEASING.md)
- [CLI release operations](https://github.com/NARUBROWN/spine-cli/blob/preview/release/README.md)
