# 发布渠道与安装

当前 API 用法参见 [0.7.5 迁移指南](/zh-Hans/learn/migration/v0.7.5)。下方发布信息与历史记录以各自标签为准。

Spine 与 CLI 按 Preview、RC、稳定版 (Production) 的顺序发布。根据需要选择 CLI 渠道：提前体验新功能、验证候选版本，或使用稳定版本。

本页介绍 Spine 与 CLI 的发布流程。应用的开发、预发布和生产环境配置由应用单独管理。

## 选择渠道 {#choose}

| 渠道 | 用途 | CLI 安装目标 |
| --- | --- | --- |
| Preview | 体验开发中的变更与新 API | `@preview` 分支 |
| RC | 验证从 Preview 晋级的候选版本 | `@rc` 分支或已发布的 RC 标签 |
| 稳定版 (Production) | 作为常规开发与生产环境的基准 | `@latest` 或已发布的稳定版标签 |

`@preview` 与 `@rc` 分别选择同名分支的最新提交。如果提交带有版本标签，Go 可解析为该版本；否则可解析为标识提交的伪版本。`@latest` 优先选择稳定版本。[Go 版本查询规则](https://go.dev/ref/mod#version-queries)

## 安装各渠道 CLI {#install}

从下方选择需要的一个渠道。在相同目录重新安装会替换现有 `spine` 可执行文件。需要同时使用多个渠道时，请为其指定不同的 `GOBIN` 目录。Go 与 PATH 配置见[安装说明](/zh-Hans/learn/getting-started/installation)。

### 稳定版 {#stable}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

这是常规起点。使用 `spine version` 查看实际安装版本。`@main` 选择 main 分支代码，与安装稳定发行版的 `@latest` 不同。

### Preview {#preview}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

用于查看已合并到 Preview 的变更，也可能包含已发布 Preview 标签之间的提交。复现某个经过验证的候选版本时，请固定对应标签。

### RC {#rc}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@rc
spine version
```

安装 RC 分支当前代码。Preview 变更在晋级后才会包含其中；晋级前可能仍保留旧功能与配方。分支存在不代表官方 RC 已发布。复现经过验证的候选版本时，请检查实际已发布的 `vX.Y.Z-rc.N` 标签及其验证记录。

## CLI 渠道与应用依赖 {#dependencies}

安装的 CLI 与应用依赖渠道相互独立。从 CLI `v0.4.3` 起，新项目包括交互式创建均默认使用 `main`。`rc` 选择 RC 或更高的正式标签，`preview` 查询 Preview 分支。现有项目的渠道不会自动更改。

```bash
spine new channel-check --module example.com/channel-check --channel main
cd channel-check
go list -m github.com/NARUBROWN/spine
```

所选渠道记录在 `spine.toml` 的 `dependency_channel` 中，`spine update` 会保留它。更新 CLI 不会更改现有项目。创建后请检查并版本管理 `go.mod` 和 `go.sum`。

## 发布流程 {#process}

经过验证的候选版本按 **Preview → RC → Production** 晋级。合并分支与发布标签是两个独立步骤。

1. 将变更合并到 Preview，并通过源码 CI。
2. 确定发布源码和依赖组合，运行该源码的测试及公开模块消费者检查。CLI 还验证 Linux、macOS、Windows 上的公开安装。
3. 维护者审阅计划与结果并批准后，发布新标签。
4. 使用已发布标签重新安装和检查，将成功结果记录在 release manifest 中。
5. 通过观察期与晋级检查后，先晋级到 RC，再晋级到 main。晋级所需的渠道版本固定变更按策略检查，其他代码或依赖组合变更需要从新 Preview 重新验证。
6. 稳定版标签的公开验证也成功后，发布 GitHub Release。核心还需完成包含六个平台的整个组合验证。

Spine 核心与平台按 **发布核心候选版本 → 发布六个平台 → 完成整个组合的验证** 执行。核心标签已经发布，与整个平台组合已准备好晋级，是不同的状态。

CLI 使用独立的版本与发布时间表。核心版本变化时，不要求 CLI 使用相同版本号。创建或更新应用时，请检查实际选择的组合。

## 观察期 {#observation}

| 条件 | 当前策略 | 起点或范围 |
| --- | --- | --- |
| Preview 到 RC | 至少 72 小时 | Preview 公开验证完成 manifest 生成后 |
| RC 到稳定版 | 至少 24 小时 | RC 公开验证完成 manifest 生成后 |
| 稳定版发布的额外间隔 | 核心 168 小时，CLI 0 小时 | 相对于各仓库上次稳定版发布 |

这些时长不代表到时自动发布下一版本，还必须满足验证与批准条件。紧急缩短观察期时需要记录原因，不会省略测试、公开验证或批准。

## 检查标签与验证记录 {#evidence}

- Preview 标签使用 `vX.Y.Z-preview.N`，RC 标签使用 `vX.Y.Z-rc.N`，稳定版标签使用 `vX.Y.Z`。
- Preview 与 RC 通过标签和 GitHub Actions 的 `release-manifest-<tag>` artifact 留存验证结果。GitHub Releases 列表中没有记录时，候选标签仍可能存在。
- 稳定版在 GitHub Release 中附加验证 manifest。核心需要确认整个平台组合已经完成验证。
- 选择候选版本时，同时检查成功的发布运行、与标签匹配的源码及依赖，以及公开安装验证结果。

标签与公开版本见[当前版本](/zh-Hans/community/changelog)。从分支安装成功，不等于经过验证的候选标签已完成发布。

## 固定与恢复版本 {#pin}

在 CI 和生产环境中，请固定实际已发布的 CLI 标签，并对应用源码、`go.mod` 和 `go.sum` 一同进行版本管理。CLI 标签仅固定工具代码。动态 Preview 配方即使由同一 CLI 执行 `new` 或 `update`，仍会重新解析 `@preview`；复现应用时请使用保存的源码和依赖。以下示例固定到已发布的正式 CLI `v0.4.3`，并不代表最新版本。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.3
spine version
```

恢复旧 CLI 不会恢复应用源码、`go.mod` 或 `go.sum`，请从项目 Git 历史单独恢复应用。已发布标签不会移动或复用，修正后的候选版本使用新编号发布。

## 相关文档 {#related}

- [第一个应用](/zh-Hans/learn/getting-started/first-app)
- [Spine 发布操作流程](https://github.com/NARUBROWN/spine/blob/preview/RELEASING.md)
- [CLI 发布操作流程](https://github.com/NARUBROWN/spine-cli/blob/preview/release/README.md)
