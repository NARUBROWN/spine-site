---
pageClass: release-versions
---

# 版本概覽

查看 Spine 生態中各儲存庫的已發佈標籤、下一目標版本和變更。各儲存庫使用獨立版本發佈。

<ReleaseCatalog />

## 如何閱讀列表 {#reading}

- 選擇**正式、Preview 或 RC**，查看該通道的最新標籤和版本歷史。沒有標籤的通道顯示尚無已發佈標籤。
- **下一目標**是 Preview 分支發佈政策中記錄的基礎版本。記錄目標版本不代表標籤已經發佈。
- **GitHub Release 已發佈**表示存在發行頁面。僅顯示**標籤已建立**的候選版本，需要同時檢查發佈工作流程和驗證 manifest。建立核心標籤與完成整個平台組合的驗證是不同階段。
- 日期為 GitHub Release 的發佈日期。只有標籤的候選版本不顯示發佈日期。

列表每天收集 GitHub 公開標籤和政策，以上方檢查時間為準。此後的變更請透過儲存庫連結查看。通道選擇和安裝方式請參閱[發佈通道與安裝](/zh-Hant/community/release-channels)。

## 版本記錄的位置 {#records}

| 記錄 | 管理位置 |
| --- | --- |
| 下一基礎版本及各通道的依賴組合 | 各儲存庫的 `.github/release-policy.json` |
| 計畫包含的功能與修正 | 連結到 GitHub 里程碑的 issue 和 PR |
| 變更、相容性與遷移方法 | [發行說明](/zh-Hant/community/changelog)和版本遷移指南 |
| 已發佈原始碼與驗證結果 | 標籤、發佈工作流程和 release manifest |

Preview 和 RC 的驗證記錄保存在有保留期限的 Actions artifact 中。正式版本請檢查 GitHub Release 附帶的 manifest。本頁提供版本列表，不會僅憑標籤判定整個組合已通過驗證。
