const ko = {
  costLead: 'Spine Cloud를 썼다면,',
  cost: '0원',
  costNote: '오픈 베타 이용 요금입니다. 정식 출시 후에도 무료 요금제를 계속 제공합니다.',
  title: '앱 배포는 Spine Cloud로.',
  description: 'Spine 앱을 CLI에서 배포하고, 웹에서 상태와 로그를 확인하세요.',
  link: 'Spine Cloud 알아보기',
  beta: '오픈 베타 운영 중이며, 정식 출시 후에도 무료 요금제를 계속 제공합니다. 배포에는 preview CLI가 필요합니다.'
}

const en: typeof ko = {
  costLead: 'With Spine Cloud,',
  cost: '₩0',
  costNote: 'Open beta pricing. A free plan will remain available after the official launch.',
  title: 'Deploy with Spine Cloud.',
  description: 'Deploy your Spine app from the CLI, then check its status and logs on the web.',
  link: 'Explore Spine Cloud',
  beta: 'Now in open beta. A free plan will remain available after the official launch. Deployment requires the preview CLI.'
}

const ja: typeof ko = {
  costLead: 'Spine Cloudを使えば、',
  cost: '₩0',
  costNote: 'オープンベータの利用料金です。正式リリース後も無料プランを引き続き提供します。',
  title: 'アプリのデプロイはSpine Cloudで。',
  description: 'SpineアプリをCLIからデプロイし、状態とログをウェブで確認できます。',
  link: 'Spine Cloudを見る',
  beta: 'オープンベータ運用中。正式リリース後も無料プランを引き続き提供します。デプロイにはpreview CLIが必要です。'
}

const zhHans: typeof ko = {
  costLead: '使用 Spine Cloud，',
  cost: '₩0',
  costNote: '公开测试期间的使用费用。正式发布后也将继续提供免费套餐。',
  title: '用 Spine Cloud 部署应用。',
  description: '通过 CLI 部署 Spine 应用，在网页上查看状态和日志。',
  link: '了解 Spine Cloud',
  beta: '公开测试进行中。正式发布后也将继续提供免费套餐。部署需要 preview CLI。'
}

const zhHant: typeof ko = {
  costLead: '使用 Spine Cloud，',
  cost: '₩0',
  costNote: '公開測試期間的使用費用。正式發布後也將繼續提供免費方案。',
  title: '用 Spine Cloud 部署應用程式。',
  description: '透過 CLI 部署 Spine 應用程式，在網頁上查看狀態和日誌。',
  link: '認識 Spine Cloud',
  beta: '公開測試進行中。正式發布後也將繼續提供免費方案。部署需要 preview CLI。'
}

export function spineCloudCopy(path: string): typeof ko {
  if (path === 'ko') return ko
  if (path === 'ja') return ja
  if (path === 'zh-Hans') return zhHans
  if (path === 'zh-Hant') return zhHant
  return en
}

export function spineCloudURL(path: string): string {
  return `https://home.spinecloud.dev/${path === 'ko' ? '' : `${path}/`}`
}
