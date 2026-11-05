const copies = {
  ko: { title: '저장소별 버전', checked: '확인 시각', channel: '릴리스 채널', stable: '정식', preview: 'Preview', rc: 'RC', target: '다음 목표', unpublished: '발행 태그 없음', releasePublished: 'GitHub Release 게시됨', tagPublished: '태그 생성됨', notes: '릴리스 노트', manifest: '검증 manifest', runs: '발행 실행', plan: '작업 계획', history: '발행 이력' },
  en: { title: 'Versions by repository', checked: 'Checked at', channel: 'Release channel', stable: 'Stable', preview: 'Preview', rc: 'RC', target: 'Next target', unpublished: 'No published tag', releasePublished: 'GitHub Release published', tagPublished: 'Tag created', notes: 'Release notes', manifest: 'Validation manifest', runs: 'Publication runs', plan: 'Planned work', history: 'Version history' },
  ja: { title: 'リポジトリ別のバージョン', checked: '確認日時', channel: 'リリースチャンネル', stable: '正式', preview: 'Preview', rc: 'RC', target: '次の目標', unpublished: '公開タグなし', releasePublished: 'GitHub Release 公開済み', tagPublished: 'タグ作成済み', notes: 'リリースノート', manifest: '検証 manifest', runs: '公開ワークフロー', plan: '作業計画', history: '公開履歴' },
  'zh-Hans': { title: '各仓库的版本', checked: '检查时间', channel: '发布渠道', stable: '正式', preview: 'Preview', rc: 'RC', target: '下一目标', unpublished: '暂无已发布标签', releasePublished: 'GitHub Release 已发布', tagPublished: '标签已创建', notes: '发行说明', manifest: '验证 manifest', runs: '发布工作流', plan: '工作计划', history: '版本历史' },
  'zh-Hant': { title: '各儲存庫的版本', checked: '檢查時間', channel: '發佈通道', stable: '正式', preview: 'Preview', rc: 'RC', target: '下一目標', unpublished: '尚無已發佈標籤', releasePublished: 'GitHub Release 已發佈', tagPublished: '標籤已建立', notes: '發行說明', manifest: '驗證 manifest', runs: '發佈工作流程', plan: '工作計畫', history: '版本歷史' },
}

export function releaseCopy(lang: string) {
  if (lang.startsWith('ko')) return copies.ko
  if (lang.startsWith('ja')) return copies.ja
  if (lang === 'zh-CN' || lang === 'zh-Hans') return copies['zh-Hans']
  if (lang === 'zh-TW' || lang === 'zh-Hant') return copies['zh-Hant']
  return copies.en
}
