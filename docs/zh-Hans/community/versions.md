---
pageClass: release-versions
---

# 版本概览

查看 Spine 生态中8个仓库的已发布标签、下一目标版本和变更。各仓库使用独立版本发布。

<ReleaseCatalog />

## 如何阅读列表 {#reading}

- 选择**正式、Preview 或 RC**，查看该渠道的最新标签和版本历史。没有标签的渠道显示暂无已发布标签。
- **下一目标**是 Preview 分支发布策略中记录的基础版本。记录目标版本不代表标签已经发布。
- **GitHub Release 已发布**表示存在发行页面。仅显示**标签已创建**的候选版本，需要同时检查发布工作流和验证 manifest。创建核心标签与完成整个平台组合的验证是不同阶段。
- 日期为 GitHub Release 的发布日期。只有标签的候选版本不显示发布日期。

列表每天收集 GitHub 公开标签和策略，以上方检查时间为准。此后的变更请通过仓库链接查看。渠道选择和安装方法请参阅[发布渠道与安装](/zh-Hans/community/release-channels)。

## 版本记录的位置 {#records}

| 记录 | 管理位置 |
| --- | --- |
| 下一基础版本及各渠道的依赖组合 | 各仓库的 `.github/release-policy.json` |
| 计划包含的功能与修复 | 关联到 GitHub 里程碑的 issue 和 PR |
| 变更、兼容性与迁移方法 | [发行说明](/zh-Hans/community/changelog)和版本迁移指南 |
| 已发布源码与验证结果 | 标签、发布工作流和 release manifest |

Preview 和 RC 的验证记录保存在有保留期限的 Actions artifact 中。正式版本请检查 GitHub Release 附带的 manifest。本页提供版本列表，不会仅凭标签判定整个组合已通过验证。
