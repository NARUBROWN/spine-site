export const supportIssueUrl = 'https://github.com/NARUBROWN/spine/issues/new?title=%5BAdoption%20support%5D'

const ko = {
  nav: '기업 지원', home: '메인으로',
  bannerTitle: '기업 도입 무상 기술 지원',
  bannerDetail: '기업 수 제한 없이, 도입 상담부터 오류 대응까지.',
  bannerLink: '지원 안내 보기',
  title: ['기업 도입', '무상 기술 지원'],
  intro: 'Spine 도입을 검토하거나 사용 중인 기업과 개발팀을 위해, 개발자가 도입 상담부터 프레임워크 오류 대응까지 직접 지원합니다.',
  positioning: 'Spring과 NestJS의 비즈니스 아키텍처와 개발 경험을 Go로 이어 가는 것이 Spine의 기준입니다.',
  contactAction: 'GitHub 이슈로 문의하기', scopeAction: '지원 범위 보기',
  facts: [
    ['무상 지원', '아래 범위의 상담과 기술 지원에 비용을 받지 않습니다.'],
    ['기업 수 제한 없음', '모집 정원 없이 상시 신청할 수 있습니다.'],
    ['24/7 문의 접수', '주말과 공휴일에도 언제든 문의를 남길 수 있습니다.'],
    ['개발자 직접 대응', '가용 시간에 확인하고, 운영 영향과 긴급도에 따라 대응합니다.']
  ],
  responseNote: '고정 응답 시간과 복구 시간은 보장하지 않습니다.',
  scopeTitle: '함께 해결하는 범위',
  services: [
    ['도입 상담', '서비스 특성을 살펴보고 적용 가능한 범위, 필요한 작업과 다음 단계를 정리합니다.'],
    ['아키텍처 상담', 'Controller, Service, Repository, DI, 인터셉터, 오류 처리 등 익숙한 구조를 Go에서 어떻게 구성할지 검토합니다.'],
    ['초기 적용 지원', '설정, 등록, 실행 문제를 확인하고 대표 기능이나 문의와 관련된 코드를 검토합니다. 적용 방법을 확인하거나 실행을 막는 원인을 정리합니다.'],
    ['오류 대응', '재현과 원인 분석을 바탕으로 우회 방법이나 프레임워크 수정을 검토합니다. 조치 결과를 확인하거나 남은 작업을 후속 추적으로 연결합니다.'],
    ['개선 제안', '사용성, 문서, 예제, 신규 기능 의견을 검토하고 반영, 추가 검토, 보류 여부와 이유를 안내합니다.']
  ],
  ownership: '기업 개발팀은 업무 기능 구현과 서비스 운영을 맡고, Spine 측은 도입 방향, 프레임워크 사용과 연동 문제 해결을 지원합니다.',
  boundaryTitle: '별도 협의가 필요한 작업',
  boundary: '전체 프로젝트 구현, 상시 운영 대행, 장기간의 기업 전용 기능 개발은 별도 범위 협의가 필요합니다. 코드 리뷰는 문의와 관련된 기능과 변경 부분을 기준으로 진행합니다.',
  processTitle: '지원은 이렇게 진행합니다',
  process: [
    ['글과 코드로 시작합니다.', '비동기 지원이 기본입니다. 추가 논의가 필요하면 30분 내외의 미팅 일정을 협의합니다.'],
    ['확인 가능한 범위부터 진행합니다.', '처리를 시작하면 확인한 내용, 필요한 정보, 다음 행동을 알려드립니다. 원인 발견이나 우회 방법 확보처럼 의미 있는 변화가 있을 때 진행 상황을 공유합니다.'],
    ['문의 단위로 이어 갑니다.', '일률적인 종료 기간은 없습니다. 대기량이 늘면 착수가 지연될 수 있으며, 이 경우 안내합니다. 기능 추가나 큰 수정의 즉시 반영은 약속하지 않습니다.']
  ],
  priorityTitle: '실제 영향을 보고 대응합니다',
  priorities: [
    ['긴급', '운영 서비스 핵심 기능 중단이나 데이터 정합성 문제를 먼저 확인합니다.'],
    ['적용 차단', '빌드, 기동, 핵심 기능 오류는 재현 정보가 갖춰지면 일반 상담보다 우선합니다.'],
    ['일반', '사용법, 설계 질문, 우회 가능한 오류와 코드 검토는 기본적으로 접수 순서대로 진행합니다.'],
    ['개선 제안', '도입을 막지 않는 기능, 문서, 예제 제안은 관련 작업과 묶어서 검토합니다.']
  ],
  priorityNote: '운영 영향, 우회 가능성, 다른 사용자에게 미치는 영향을 함께 봅니다. 배포 일정이 급하다는 사정만으로 긴급 장애와 같은 순위가 되지는 않습니다.',
  incidentNote: '원인이 아직 밝혀지지 않은 운영 장애도 우선 확인할 수 있습니다. 앱 코드나 외부 인프라 문제로 확인되면 근거와 다음 조치를 안내합니다.',
  prepareTitle: '세 가지 정보면 시작할 수 있어요',
  prepareIntro: '긴 신청서 대신 서비스, 현재 기술과 적용 범위, 궁금한 점을 알려주세요. 오류 문의는 버전과 재현 정보를 함께 준비하면 도움이 됩니다.',
  templates: [
    ['도입 상담에 필요한 정보', '적용하려는 서비스:\n현재 기술과 Spine으로 옮기려는 범위:\n궁금한 점 또는 막힌 부분:'],
    ['오류 문의에 추가할 정보', 'Spine 버전 / Go 버전:\n실행 환경:\n기대한 동작과 실제 동작:\n재현 방법:\n관련 코드 또는 오류 로그:\n운영 영향:\n현재 가능한 우회 방법:']
  ],
  copy: '양식 복사', copied: '복사했습니다.', copyFailed: '복사하지 못했습니다. 아래 내용을 선택해 복사해 주세요.',
  privacy: '필요한 정보는 확인 과정에서 추가로 요청합니다. 기업 내부 코드 전체를 공유하기 어렵다면 축소한 재현 코드로 진행할 수 있습니다.',
  versionNote: '최신 정식 릴리스를 우선 확인합니다. 구버전은 사용 환경과 재현 여부를 보고 판단합니다.',
  consentNote: '기업 사례 공개는 지원과 별도로 동의를 받습니다. 기업명, 로고, 코드와 성과 수치는 승인받은 범위만 사용합니다.',
  contactTitle: '도입 문의', contactStatus: 'Spine 공식 GitHub Issues',
  contactIntro: '공식 저장소에 이슈를 남겨 도입 상담이나 기술 지원을 신청해 주세요. 서비스 개요, 현재 기술 구성, 적용 범위와 궁금한 점을 적어주시면 됩니다.',
  contactNote: 'GitHub 이슈는 공개됩니다. 비밀정보를 제외한 요약이나 최소 재현 코드를 공유해 주세요.',
  docsLink: '첫 앱 만들기', communityLink: '커뮤니티 둘러보기'
}

const en: typeof ko = {
  nav: 'Business support', home: 'Back to home',
  bannerTitle: 'Free technical support for business teams',
  bannerDetail: 'From adoption advice to troubleshooting, with no limit on teams.',
  bannerLink: 'Explore support', title: ['Free support', 'for business teams'],
  intro: 'For companies and development teams considering or using Spine, the developer provides direct help with adoption, architecture, initial setup, and framework issues.',
  positioning: 'Spine brings the business architecture and developer experience of Spring and NestJS to Go.',
  contactAction: 'Ask via GitHub Issues', scopeAction: 'What we support',
  facts: [
    ['Free support', 'Advice and technical support within the scope below are free of charge.'],
    ['No limit on teams', 'Applications are ongoing, with no company quota.'],
    ['24/7 intake', 'Enquiries can be submitted at any time, including weekends and holidays.'],
    ['Direct developer support', 'The developer reviews enquiries when available and responds according to impact and urgency.']
  ],
  responseNote: 'Fixed response and recovery times are not guaranteed.',
  scopeTitle: 'What we can help with',
  services: [
    ['Adoption advice', 'Review your service, identify where Spine fits, and outline the work and next steps.'],
    ['Architecture advice', 'Discuss how to structure controllers, services, repositories, DI, interceptors, and error handling in Go.'],
    ['Initial setup', 'Investigate configuration, registration, and startup issues, and review a representative feature or code related to your enquiry. Confirm an approach or identify what blocks execution.'],
    ['Troubleshooting', 'Reproduce and investigate issues, assess workarounds or framework fixes, and verify the result or clearly identify the remaining follow-up work.'],
    ['Improvement proposals', 'Review feedback on usability, docs, examples, and features, and explain whether it will be adopted, considered further, or deferred.']
  ],
  ownership: 'Your team implements business features and operates the service. Spine supports adoption decisions, framework usage, and integration troubleshooting.',
  boundaryTitle: 'Work requiring a separate scope discussion',
  boundary: 'Full project implementation, ongoing service operations, and long-term company-specific feature development require a separate scope discussion. Code review covers the features and changes related to your enquiry.',
  processTitle: 'How support works',
  process: [
    ['Start with text and code.', 'Support is asynchronous by default. If further discussion is needed, we can arrange a meeting of about 30 minutes.'],
    ['Start where the evidence allows.', 'Once work starts, we share what we have confirmed, the information needed, and the next action. Updates follow meaningful progress such as identifying a cause or finding a workaround.'],
    ['Continue per enquiry.', 'There is no uniform end date. A growing queue may delay the start of work; we will let you know. Immediate delivery of features or major changes is not promised.']
  ],
  priorityTitle: 'Priority follows actual impact',
  priorities: [
    ['Urgent', 'Production outages affecting core functionality and active data consistency problems are reviewed first.'],
    ['Blocked adoption', 'Build, startup, or core functionality failures take priority over general advice once reproduction details are available.'],
    ['General', 'Usage and design questions, issues with workarounds, and code reviews are generally handled in order of arrival.'],
    ['Improvements', 'Non-blocking feature, documentation, and example proposals are reviewed alongside related work.']
  ],
  priorityNote: 'Production impact, available workarounds, and effects on other users all matter. A tight deployment deadline alone does not make an enquiry equivalent to an urgent outage.',
  incidentNote: 'Production incidents with an unknown cause can also be reviewed first. If application code or external infrastructure is responsible, we share the evidence and suggested next action.',
  prepareTitle: 'Start with three details',
  prepareIntro: 'Tell us about your service, current technology and adoption scope, and your question. For errors, version and reproduction details help.',
  templates: [
    ['Details for adoption advice', 'Service you want to build or migrate:\nCurrent technology and scope to move to Spine:\nQuestion or blocker:'],
    ['Additional details for an error', 'Spine version / Go version:\nRuntime environment:\nExpected and actual behavior:\nSteps to reproduce:\nRelated code or error logs:\nProduction impact:\nAvailable workaround:']
  ],
  copy: 'Copy template', copied: 'Copied.', copyFailed: 'Could not copy. Select and copy the text below.',
  privacy: 'We can request missing information during the review. If you cannot share internal source code, a minimal reproduction is enough to begin.',
  versionNote: 'The latest stable release is checked first. Older versions are assessed based on the environment and reproducibility.',
  consentNote: 'Publishing a company case study requires separate consent. Names, logos, code, and results are used only within the approved scope.',
  contactTitle: 'Adoption enquiries', contactStatus: 'Official Spine GitHub Issues',
  contactIntro: 'Open an issue in the official repository for adoption advice or technical support. Describe your service, current technology, adoption scope, and questions.',
  contactNote: 'GitHub issues are public. Share a summary or minimal reproduction without confidential information.',
  docsLink: 'Build your first app', communityLink: 'Explore the community'
}

const ja: typeof ko = {
  nav: '企業向け支援', home: 'ホームへ',
  bannerTitle: '企業導入の無償技術支援', bannerDetail: '企業数の制限なく、導入相談から不具合対応まで。',
  bannerLink: '支援内容を見る', title: ['企業導入の', '無償技術支援'],
  intro: 'Spineの導入を検討中、または利用中の企業と開発チームに、開発者が導入相談からフレームワークの不具合対応まで直接支援します。',
  positioning: 'SpringとNestJSのビジネスアーキテクチャと開発体験をGoへつなぐことが、Spineの基準です。',
  contactAction: 'GitHub Issueで相談する', scopeAction: '支援範囲を見る',
  facts: [
    ['無償支援', '以下の範囲の相談と技術支援は無償です。'],
    ['企業数の制限なし', '募集枠を設けず、随時申し込めます。'],
    ['24/7受付', '週末や祝日を含め、いつでも問い合わせを送れます。'],
    ['開発者が直接対応', '対応可能な時間に確認し、運用への影響と緊急度に応じて対応します。']
  ],
  responseNote: '一定の応答時間や復旧時間は保証しません。', scopeTitle: '一緒に解決する範囲',
  services: [
    ['導入相談', 'サービスの特性を確認し、適用範囲、必要な作業、次のステップを整理します。'],
    ['アーキテクチャ相談', 'Controller、Service、Repository、DI、インターセプター、エラー処理などの構成をGoでどう設計するか検討します。'],
    ['初期導入支援', '設定、登録、起動の問題や、代表的な機能と関連コードを確認します。適用方法または実行を妨げる原因を整理します。'],
    ['不具合対応', '再現と原因分析を行い、回避策やフレームワーク修正を検討します。結果を検証するか、残る作業を明確にして継続追跡します。'],
    ['改善提案', '使いやすさ、文書、サンプル、新機能の意見を検討し、反映、継続検討、保留の判断と理由を伝えます。']
  ],
  ownership: '企業の開発チームが業務機能の実装とサービス運用を担い、Spine側は導入方針、利用方法、連携の問題解決を支援します。',
  boundaryTitle: '別途範囲の相談が必要な作業',
  boundary: 'プロジェクト全体の実装、常時運用代行、長期の企業専用機能開発は別途範囲の相談が必要です。コードレビューは問い合わせに関連する機能と変更を対象にします。',
  processTitle: '支援の進め方',
  process: [
    ['文章とコードから始めます。', '非同期の支援が基本です。必要に応じて30分程度のミーティング日程を相談します。'],
    ['確認できる範囲から進めます。', '着手時に確認事項、必要な情報、次の行動を伝えます。原因の特定や回避策の確保など、意味のある進展があったときに共有します。'],
    ['問い合わせ単位で継続します。', '一律の終了期限はありません。待機件数が増えて着手が遅れる場合は案内します。機能追加や大きな修正の即時反映は約束しません。']
  ],
  priorityTitle: '実際の影響で優先度を判断',
  priorities: [
    ['緊急', '本番の主要機能停止や、発生中のデータ整合性の問題を優先して確認します。'],
    ['導入を阻害', 'ビルド、起動、主要機能のエラーは、再現情報がそろえば一般相談より優先します。'],
    ['一般', '使い方や設計の質問、回避可能な不具合、コードレビューは原則受付順に進めます。'],
    ['改善提案', '導入を妨げない機能、文書、サンプルの提案は関連作業とまとめて検討します。']
  ],
  priorityNote: '運用への影響、回避策の有無、他の利用者への影響を総合的に判断します。リリース日程が迫っているだけでは、緊急障害と同じ優先度にはなりません。',
  incidentNote: '原因不明の本番障害も優先確認の対象です。アプリのコードや外部インフラが原因と分かれば、根拠と次の対応を案内します。',
  prepareTitle: '三つの情報から始められます',
  prepareIntro: '長い申請書ではなく、サービス、現在の技術と導入範囲、質問をお知らせください。不具合の場合はバージョンと再現情報も役立ちます。',
  templates: [
    ['導入相談に必要な情報', '導入したいサービス:\n現在の技術とSpineへ移す範囲:\n質問または困っている点:'],
    ['不具合の追加情報', 'Spine / Goのバージョン:\n実行環境:\n期待する動作と実際の動作:\n再現手順:\n関連コードまたはエラーログ:\n運用への影響:\n利用できる回避策:']
  ],
  copy: '書式をコピー', copied: 'コピーしました。', copyFailed: 'コピーできませんでした。以下の内容を選択してコピーしてください。',
  privacy: '不足情報は確認の過程で依頼します。社内コード全体を共有できない場合は、最小限の再現コードで進められます。',
  versionNote: '最新の安定版を優先して確認します。旧版は使用環境と再現性から判断します。',
  consentNote: '企業事例の公開は支援とは別に同意を得ます。企業名、ロゴ、コード、成果数値は承認された範囲だけ使用します。',
  contactTitle: '導入のお問い合わせ', contactStatus: 'Spine公式GitHub Issues',
  contactIntro: '導入相談や技術支援は公式リポジトリのIssueから申し込めます。サービス概要、現在の技術構成、導入範囲、質問をお知らせください。',
  contactNote: 'GitHub Issueは公開されます。機密情報を除いた概要や最小限の再現コードを共有してください。',
  docsLink: '最初のアプリを作る', communityLink: 'コミュニティを見る'
}

const zhHans: typeof ko = {
  nav: '企业支持', home: '返回首页',
  bannerTitle: '企业采用免费技术支持', bannerDetail: '不限企业数量，涵盖采用咨询到故障排查。',
  bannerLink: '查看支持说明', title: ['企业采用', '免费技术支持'],
  intro: '面向正在评估或使用 Spine 的企业与开发团队，由开发者直接提供采用咨询、架构讨论、初期接入和框架故障支持。',
  positioning: 'Spine 致力于将 Spring 和 NestJS 的业务架构与开发体验延续到 Go。',
  contactAction: '通过 GitHub Issue 咨询', scopeAction: '查看支持范围',
  facts: [
    ['免费支持', '以下范围内的咨询与技术支持均不收费。'],
    ['不限企业数量', '长期开放申请，不设企业名额。'],
    ['24/7 接收咨询', '包括周末和节假日，随时可以提交咨询。'],
    ['开发者直接处理', '在可用时间查看，根据运营影响与紧急程度依次处理。']
  ],
  responseNote: '不保证固定的响应时间或恢复时间。', scopeTitle: '我们可以协助的范围',
  services: [
    ['采用咨询', '了解服务特点，明确适用范围、所需工作和后续步骤。'],
    ['架构咨询', '讨论如何在 Go 中设计 Controller、Service、Repository、DI、拦截器和错误处理。'],
    ['初期接入', '排查配置、注册和启动问题，审阅代表性功能或相关代码，确认接入方法或阻碍运行的原因。'],
    ['故障排查', '复现并分析原因，评估临时解决方案或框架修复，验证处理结果或明确后续跟进工作。'],
    ['改进建议', '评估易用性、文档、示例和新功能建议，说明采纳、进一步评估或暂缓的决定及理由。']
  ],
  ownership: '企业开发团队负责业务功能实现与服务运营，Spine 侧协助采用方向、框架使用与集成问题排查。',
  boundaryTitle: '需要另行商定范围的工作',
  boundary: '完整项目实现、持续运营代管、长期企业专属功能开发需要另行讨论范围。代码审阅以咨询相关的功能和改动为限。',
  processTitle: '支持如何进行',
  process: [
    ['从文字与代码开始。', '默认采用异步支持，需要进一步讨论时可协商约 30 分钟的会议。'],
    ['从可确认的部分着手。', '开始处理时会说明已确认的情况、所需信息及下一步行动。在找到原因或获得临时解决方案等有实质进展时更新状态。'],
    ['按每条咨询持续跟进。', '不设统一截止期限。排队增加可能延迟开始处理，届时会告知。不承诺立即交付新功能或大型修改。']
  ],
  priorityTitle: '按实际影响确定优先级',
  priorities: [
    ['紧急', '优先确认生产服务核心功能中断或正在发生的数据一致性问题。'],
    ['阻碍接入', '构建、启动或核心功能错误在复现信息齐全后优先于普通咨询。'],
    ['普通', '用法、设计问题、可绕过的错误与代码审阅原则上按接收顺序处理。'],
    ['改进建议', '不阻碍接入的功能、文档与示例建议结合相关工作评估。']
  ],
  priorityNote: '综合考虑运营影响、可行的临时方案及对其他用户的影响。仅因部署期限紧迫，不会获得与紧急故障相同的优先级。',
  incidentNote: '原因未明的生产故障也可优先查看。如确认是应用代码或外部基础设施问题，会提供依据与下一步建议。',
  prepareTitle: '三项信息即可开始',
  prepareIntro: '无需冗长申请表，只需说明服务、现有技术与采用范围，以及疑问。故障咨询请补充版本与复现信息。',
  templates: [
    ['采用咨询所需信息', '计划采用 Spine 的服务：\n当前技术及迁移到 Spine 的范围：\n疑问或阻碍：'],
    ['故障咨询补充信息', 'Spine / Go 版本：\n运行环境：\n预期行为与实际行为：\n复现步骤：\n相关代码或错误日志：\n运营影响：\n目前可行的临时解决方案：']
  ],
  copy: '复制模板', copied: '已复制。', copyFailed: '无法复制，请选择并复制下方内容。',
  privacy: '缺少的信息可以在确认过程中补充。无法分享完整内部代码时，可使用最小复现代码。',
  versionNote: '优先检查最新稳定版本。旧版本根据使用环境与可复现性判断。',
  consentNote: '公开企业案例须另行征得同意。企业名称、标志、代码与成果数据仅在获批范围内使用。',
  contactTitle: '采用咨询', contactStatus: 'Spine 官方 GitHub Issues',
  contactIntro: '请在官方仓库创建 Issue，申请采用咨询或技术支持。说明服务概况、现有技术、采用范围和疑问即可。',
  contactNote: 'GitHub Issue 是公开的。请提供不含机密信息的摘要或最小复现代码。', docsLink: '创建第一个应用', communityLink: '了解社区'
}

const zhHant: typeof ko = {
  nav: '企業支援', home: '返回首頁',
  bannerTitle: '企業導入免費技術支援', bannerDetail: '不限企業數量，從導入諮詢到問題排查。',
  bannerLink: '查看支援說明', title: ['企業導入', '免費技術支援'],
  intro: '針對正在評估或使用 Spine 的企業與開發團隊，由開發者直接提供導入諮詢、架構討論、初期整合及框架問題支援。',
  positioning: 'Spine 致力於將 Spring 與 NestJS 的業務架構及開發體驗延續到 Go。',
  contactAction: '透過 GitHub Issue 諮詢', scopeAction: '查看支援範圍',
  facts: [
    ['免費支援', '以下範圍內的諮詢與技術支援均不收費。'],
    ['不限企業數量', '持續開放申請，不設企業名額。'],
    ['24/7 受理諮詢', '包含週末及國定假日，隨時可以提出諮詢。'],
    ['開發者直接處理', '於可用時間查看，依營運影響及緊急程度依序處理。']
  ],
  responseNote: '不保證固定回應時間或恢復時間。', scopeTitle: '我們可以協助的範圍',
  services: [
    ['導入諮詢', '了解服務特性，釐清適用範圍、所需工作與後續步驟。'],
    ['架構諮詢', '討論如何在 Go 中設計 Controller、Service、Repository、DI、攔截器及錯誤處理。'],
    ['初期整合', '排查設定、註冊及啟動問題，檢視代表性功能或相關程式碼，確認整合方法或阻礙執行的原因。'],
    ['問題排查', '重現並分析原因，評估暫行方案或框架修正，驗證處理結果或明確列出後續追蹤工作。'],
    ['改善建議', '評估易用性、文件、範例及新功能建議，說明採納、進一步評估或暫緩的決定與理由。']
  ],
  ownership: '企業開發團隊負責業務功能實作與服務營運，Spine 側協助導入方向、框架使用及整合問題排查。',
  boundaryTitle: '需要另行討論範圍的工作',
  boundary: '完整專案實作、持續營運代管、長期企業專屬功能開發須另行討論範圍。程式碼審查以諮詢相關的功能及變更為限。',
  processTitle: '支援如何進行',
  process: [
    ['從文字與程式碼開始。', '預設採非同步支援，需要進一步討論時可協調約 30 分鐘的會議。'],
    ['從可確認的部分著手。', '開始處理時說明已確認的情況、所需資訊及下一步行動。找到原因或取得暫行方案等有實質進展時更新狀態。'],
    ['依每筆諮詢持續追蹤。', '不設統一截止期限。等候案件增加可能延後開始處理，屆時會告知。不承諾立即交付新功能或大型修改。']
  ],
  priorityTitle: '依實際影響決定優先順序',
  priorities: [
    ['緊急', '優先確認正式環境核心功能中斷或正在發生的資料一致性問題。'],
    ['阻礙導入', '建置、啟動或核心功能錯誤在重現資訊齊全後優先於一般諮詢。'],
    ['一般', '用法、設計問題、可繞過的錯誤及程式碼審查原則上依受理順序處理。'],
    ['改善建議', '不阻礙導入的功能、文件與範例建議配合相關工作評估。']
  ],
  priorityNote: '綜合考量營運影響、可行的暫行方案及其他使用者受到的影響。僅因部署期限緊迫，不會取得與緊急故障相同的優先順序。',
  incidentNote: '原因未明的正式環境故障也可優先查看。如確認為應用程式碼或外部基礎設施問題，會提供依據與下一步建議。',
  prepareTitle: '三項資訊即可開始',
  prepareIntro: '不必填寫冗長申請表，只需說明服務、現有技術與導入範圍，以及疑問。問題諮詢請補充版本及重現資訊。',
  templates: [
    ['導入諮詢所需資訊', '計畫導入 Spine 的服務：\n目前技術及移轉至 Spine 的範圍：\n疑問或阻礙：'],
    ['問題諮詢補充資訊', 'Spine / Go 版本：\n執行環境：\n預期行為與實際行為：\n重現步驟：\n相關程式碼或錯誤日誌：\n營運影響：\n目前可行的暫行方案：']
  ],
  copy: '複製範本', copied: '已複製。', copyFailed: '無法複製，請選取並複製下方內容。',
  privacy: '缺少的資訊可在確認過程中補充。無法分享完整內部程式碼時，可使用最小重現程式碼。',
  versionNote: '優先檢查最新穩定版本。舊版本依使用環境及可重現性判斷。',
  consentNote: '公開企業案例須另行取得同意。企業名稱、標誌、程式碼及成果數據僅在核准範圍內使用。',
  contactTitle: '導入諮詢', contactStatus: 'Spine 官方 GitHub Issues',
  contactIntro: '請在官方儲存庫建立 Issue，申請導入諮詢或技術支援。說明服務概況、現有技術、導入範圍及疑問即可。',
  contactNote: 'GitHub Issue 為公開內容。請提供不含機密資訊的摘要或最小重現程式碼。', docsLink: '建立第一個應用程式', communityLink: '了解社群'
}

export function supportLocale(lang: string) {
  if (lang === 'ko') return 'ko'
  if (lang === 'ja') return 'ja'
  if (lang === 'zh-CN' || lang === 'zh-Hans') return 'zh-Hans'
  if (lang === 'zh-TW' || lang === 'zh-Hant') return 'zh-Hant'
  return 'en'
}

export function supportCopy(lang: string) {
  return { ko, en, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant }[supportLocale(lang)]
}
