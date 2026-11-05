# 發佈通道與安裝

Spine 與 CLI 依 Preview、RC、穩定版 (Production) 的順序發佈。依需求選擇 CLI 通道：提前體驗新功能、驗證候選版本，或使用穩定版本。

本頁介紹 Spine 與 CLI 的發佈流程。應用程式的開發、預備和正式環境設定由應用程式另外管理。

## 選擇通道 {#choose}

| 通道 | 用途 | CLI 安裝目標 |
| --- | --- | --- |
| Preview | 體驗開發中的變更與新 API | `@preview` 分支 |
| RC | 驗證從 Preview 晉級的候選版本 | `@rc` 分支或已發佈的 RC 標籤 |
| 穩定版 (Production) | 作為一般開發與正式環境的基準 | `@latest` 或已發佈的穩定版標籤 |

`@preview` 與 `@rc` 分別選擇同名分支的最新提交。如果提交具有版本標籤，Go 可解析為該版本；否則可解析為識別提交的虛擬版本。`@latest` 優先選擇穩定版本。[Go 版本查詢規則](https://go.dev/ref/mod#version-queries)

## 安裝各通道 CLI {#install}

從下方選擇需要的一個通道。在相同目錄重新安裝會取代現有 `spine` 執行檔。需要同時使用多個通道時，請指定不同的 `GOBIN` 目錄。Go 與 PATH 設定請見[安裝說明](/zh-Hant/learn/getting-started/installation)。

### 穩定版 {#stable}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@latest
spine version
```

這是一般的起點。使用 `spine version` 查看實際安裝版本。`@main` 選擇 main 分支程式碼，與安裝穩定發行版的 `@latest` 不同。

### Preview {#preview}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@preview
spine version
```

用於查看已合併至 Preview 的變更，也可能包含已發佈 Preview 標籤之間的提交。重現某個經過驗證的候選版本時，請固定對應標籤。

### RC {#rc}

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@rc
spine version
```

安裝 RC 分支目前的程式碼。Preview 變更在晉級後才會包含其中；晉級前可能仍保留舊功能與配方。分支存在不代表官方 RC 已發佈。重現經過驗證的候選版本時，請檢查實際已發佈的 `vX.Y.Z-rc.N` 標籤及其驗證紀錄。

## CLI 通道與應用程式相依套件 {#dependencies}

CLI 版本獨立於 Spine 核心和平台版本。重新安裝 CLI 不會自動更改既有應用程式原始碼或相依套件。新應用程式使用已安裝 CLI 原始碼中的產生配方。

| 安裝的 CLI | 新應用程式的相依套件選擇 | 既有應用程式 |
| --- | --- | --- |
| Preview | `platform-contracts-preview` 解析核心及所選平台的 `@preview`，將實際版本記錄於 `go.mod` | 同一配方的 `spine update` 會重新解析 |
| RC | 使用該 RC 原始碼中的配方，不會自動將全部相依套件切換至 `@rc` | 保留既有配方 |
| 穩定版 | 使用該穩定版 CLI 提供的版本組合 | 保留既有配方 |

產生後，請查看 `spine.toml` 中的 `recipe` 與 `go.mod`。以下可檢查目前 CLI 的 `new` 所選核心版本。

```bash
spine new channel-check --module example.com/channel-check
cd channel-check
go list -m github.com/NARUBROWN/spine
```

Preview 的 `--skip-install` 仍需 Go 和網路存取或模組代理快取來解析分支版本，僅略過相依套件安裝與建置檢查。既有依版本命名的 Preview 配方與穩定版配方在明確修改前維持固定版本。請參閱[既有應用程式的 Preview 移轉](/zh-Hant/learn/migration/v0.7.0-preview)。

## 發佈流程 {#process}

經過驗證的候選版本依 **Preview → RC → Production** 晉級。合併分支與發佈標籤是兩個不同的步驟。

1. 將變更合併至 Preview，並通過原始碼 CI。
2. 決定發佈的原始碼和相依套件組合，執行該原始碼的測試與公開模組使用端檢查。CLI 也驗證 Linux、macOS、Windows 上的公開安裝。
3. 維護者審閱計畫與結果並批准後，發佈新標籤。
4. 使用已發佈標籤重新安裝和檢查，將成功結果記錄於 release manifest。
5. 通過觀察期與晉級檢查後，先晉級至 RC，再晉級至 main。晉級所需的通道版本固定變更依政策檢查，其他程式碼或相依套件組合變更需要從新 Preview 重新驗證。
6. 穩定版標籤的公開驗證也成功後，發佈 GitHub Release。

Spine 核心與平台依 **發佈核心候選版本 → 發佈五個平台 → 完成整個組合的驗證** 執行。核心標籤已發佈，與整個平台組合已準備好晉級，是不同的狀態。

CLI 使用獨立的版本和發佈時程。核心版本變更時，不要求 CLI 使用相同版本號。建立或更新應用程式時，請檢查實際選擇的組合。

## 觀察期 {#observation}

| 條件 | 目前政策 | 起點或範圍 |
| --- | --- | --- |
| Preview 至 RC | 至少 72 小時 | Preview 公開驗證完成 manifest 產生後 |
| RC 至穩定版 | 至少 24 小時 | RC 公開驗證完成 manifest 產生後 |
| 穩定版發佈的額外間隔 | 核心 168 小時，CLI 0 小時 | 相對於各儲存庫上次穩定版發佈 |

這些時長不代表到時會自動發佈下一版本，仍須滿足驗證和批准條件。緊急縮短觀察期時需要記錄原因，不會省略測試、公開驗證或批准。

## 檢查標籤與驗證紀錄 {#evidence}

- Preview 標籤使用 `vX.Y.Z-preview.N`，RC 標籤使用 `vX.Y.Z-rc.N`，穩定版標籤使用 `vX.Y.Z`。
- Preview 與 RC 透過標籤和 GitHub Actions 的 `release-manifest-<tag>` artifact 保存驗證結果。GitHub Releases 清單沒有紀錄時，候選標籤仍可能存在。
- 穩定版在 GitHub Release 中附加驗證 manifest。核心需要確認整個平台組合已完成驗證。
- 選擇候選版本時，同時檢查成功的發佈執行、與標籤相符的原始碼及相依套件，以及公開安裝驗證結果。

標籤與公開版本請見[目前版本](/zh-Hant/community/changelog)。從分支安裝成功，不等於經過驗證的候選標籤已完成發佈。

## 固定與復原版本 {#pin}

需要在 CI 與正式環境重現相同結果時，請固定實際已發佈的標籤。以下範例固定至已發佈的 CLI `v0.4.2`，並不代表最新版本。

```bash
go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.4.2
spine version
```

復原舊 CLI 不會復原應用程式原始碼、`go.mod` 或 `go.sum`，請從專案 Git 歷史另外復原應用程式。已發佈標籤不會移動或重用，修正後的候選版本使用新編號發佈。

## 相關文件 {#related}

- [第一個應用程式](/zh-Hant/learn/getting-started/first-app)
- [Spine 發佈操作流程](https://github.com/NARUBROWN/spine/blob/preview/RELEASING.md)
- [CLI 發佈操作流程](https://github.com/NARUBROWN/spine-cli/blob/preview/release/README.md)
