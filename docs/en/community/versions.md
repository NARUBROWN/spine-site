---
pageClass: release-versions
---

# Version catalog

Find published tags, next target versions, and changes across the Spine ecosystem repositories. Each repository has its own version.

<ReleaseCatalog />

## Reading the catalog {#reading}

- Select **Stable, Preview, or RC** to see the latest tag and history for that channel. Channels without a tag show No published tag.
- **Next target** is the base version recorded in the publication policy on the Preview branch. A target version does not mean a tag has been published.
- **GitHub Release published** means a release page exists. For candidates marked only **Tag created**, check the publication run and validation manifest together. Creating a core tag and completing the full platform cohort validation are separate stages.
- Dates are GitHub Release publication dates. Candidates with only a tag have no publication date displayed.

The catalog collects public GitHub tags and policies daily and reflects the check time above. Follow the repository links for changes since that check. See [Release channels and installation](/en/community/release-channels) to choose and install a channel.

## Where to record versions {#records}

| Record | Location |
| --- | --- |
| Next base version and channel dependency combinations | Each repository's `.github/release-policy.json` |
| Features and fixes planned for a version | Issues and PRs linked to a GitHub milestone |
| Changes, compatibility, and upgrade steps | [Release notes](/en/community/changelog) and version-specific migration guides |
| Published source and validation results | Tags, publication runs, and release manifests |

Preview and RC validation records are Actions artifacts with a retention period. For stable versions, check the manifest attached to the GitHub Release. This page lists versions; a tag alone does not establish that the full cohort passed validation.
