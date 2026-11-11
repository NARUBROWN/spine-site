import type { DefaultTheme } from 'vitepress'

export type SiteLocale = 'ko' | 'en' | 'ja' | 'zh-Hans' | 'zh-Hant'

// 문서 지도, 상단 메뉴와 사이드바에서 같은 분류와 목적지를 사용합니다.
const sectionPaths = {
    "getting-started": [
        "learn/getting-started/intro",
        "learn/getting-started/installation",
        "learn/getting-started/first-app",
        "learn/getting-started/platforms"
    ],
    "tutorial": [
        "learn/tutorial/1-project-structure",
        "learn/tutorial/2-controller",
        "learn/tutorial/3-dependency-injection",
        "learn/tutorial/4-interceptor",
        "learn/tutorial/5-database",
        "learn/tutorial/6-transaction",
        "learn/tutorial/7-error-handling",
        "learn/tutorial/8-swagger"
    ],
    "concepts": [
        "learn/core-concepts/pipeline",
        "learn/core-concepts/execution-context",
        "learn/core-concepts/handler-meta",
        "learn/core-concepts/query-values",
        "learn/core-concepts/httperr"
    ],
    "api": [
        "reference/api/spine-app",
        "reference/api/execution-context",
        "reference/api/interceptor",
        "reference/api/query-values",
        "reference/api/openapi"
    ],
    "examples": [
        "reference/examples/crud",
        "reference/examples/login",
        "reference/examples/msa",
        "reference/examples/websocket"
    ],
    "operations": [
        "reference/security-configuration"
    ],
    "preview": [
        "learn/migration/v0.7.5",
        "learn/migration/v0.7.1",
        "learn/migration/preview-features",
        "learn/migration/preview-controller-routes",
        "learn/migration/v0.7.1-preview"
    ],
    "releases": [
        "community/versions",
        "community/release-channels",
        "community/changelog"
    ],
    "community": [
        "community/",
        "community/contributing"
    ],
    "product": [
        "",
        "benchmarks/",
        "enterprise-support"
    ]
} as const
type SectionId = keyof typeof sectionPaths

const copy = {
    "ko": {
        "docs": "문서",
        "map": "문서 안내",
        "preview": "마이그레이션",
        "releases": "릴리스",
        "community": "커뮤니티",
        "support": "기업 지원",
        "participate": "릴리스와 참여",
        "groups": [
            "시작하기",
            "튜토리얼",
            "핵심 개념",
            "API 참조",
            "예제",
            "운영",
            "마이그레이션",
            "릴리스",
            "커뮤니티",
            "제품과 지원"
        ]
    },
    "en": {
        "docs": "Docs",
        "map": "Documentation map",
        "preview": "Migration",
        "releases": "Releases",
        "community": "Community",
        "support": "Business support",
        "participate": "Releases and community",
        "groups": [
            "Getting started",
            "Tutorial",
            "Core concepts",
            "API reference",
            "Examples",
            "Operations",
            "Migration",
            "Releases",
            "Community",
            "Product and support"
        ]
    },
    "ja": {
        "docs": "ドキュメント",
        "map": "ドキュメント案内",
        "preview": "移行",
        "releases": "リリース",
        "community": "コミュニティ",
        "support": "企業向け支援",
        "participate": "リリースと参加",
        "groups": [
            "はじめに",
            "チュートリアル",
            "基本概念",
            "API リファレンス",
            "サンプル",
            "運用",
            "移行",
            "リリース",
            "コミュニティ",
            "製品とサポート"
        ]
    },
    "zh-Hans": {
        "docs": "文档",
        "map": "文档导航",
        "preview": "迁移",
        "releases": "版本发布",
        "community": "社区",
        "support": "企业支持",
        "participate": "发布与参与",
        "groups": [
            "入门",
            "教程",
            "核心概念",
            "API 参考",
            "示例",
            "运维",
            "迁移",
            "版本发布",
            "社区",
            "产品与支持"
        ]
    },
    "zh-Hant": {
        "docs": "文件",
        "map": "文件導覽",
        "preview": "移轉",
        "releases": "版本發佈",
        "community": "社群",
        "support": "企業支援",
        "participate": "發佈與參與",
        "groups": [
            "入門",
            "教學",
            "核心概念",
            "API 參考",
            "範例",
            "維運",
            "移轉",
            "版本發佈",
            "社群",
            "產品與支援"
        ]
    }
} as const

const pageLabels: Record<SiteLocale, Record<string, string>> = {
    "ko": {
        "learn/getting-started/intro": "소개",
        "reference/api/spine-app": "spine.App",
        "community/": "개요",
        "enterprise-support": "기업 지원",
        "learn/getting-started/installation": "설치",
        "community/release-channels": "릴리스 채널과 설치",
        "learn/getting-started/first-app": "첫 번째 앱",
        "learn/getting-started/platforms": "플랫폼과 DTO 검증 선택",
        "learn/tutorial/1-project-structure": "1. 프로젝트 구조",
        "learn/tutorial/2-controller": "2. 컨트롤러",
        "learn/tutorial/3-dependency-injection": "3. 의존성 주입",
        "learn/tutorial/4-interceptor": "4. 인터셉터",
        "learn/tutorial/5-database": "5. 데이터베이스 연결",
        "learn/tutorial/6-transaction": "6. 트랜잭션 관리",
        "learn/tutorial/7-error-handling": "7. 오류 처리",
        "learn/tutorial/8-swagger": "8. Swagger와 OpenAPI 문서",
        "learn/core-concepts/pipeline": "실행 파이프라인",
        "learn/core-concepts/execution-context": "spine.Ctx",
        "learn/core-concepts/handler-meta": "HandlerMeta",
        "learn/core-concepts/query-values": "쿼리 입력 사용법",
        "learn/core-concepts/httperr": "httperr 패키지",
        "learn/migration/v0.7.5": "0.7.5 API로 전환",
        "learn/migration/v0.7.1": "v0.7.1로 전환",
        "learn/migration/preview-features": "HTTP v3와 부팅 옵션",
        "learn/migration/preview-controller-routes": "컨트롤러와 라우트 전환",
        "learn/migration/v0.7.1-preview": "핸들러 입력 전환",
        "reference/api/openapi": "런타임 OpenAPI",
        "reference/api/execution-context": "spine.Ctx",
        "reference/api/interceptor": "core.Interceptor",
        "reference/api/query-values": "query.Values",
        "reference/examples/crud": "사용자 CRUD API 만들기",
        "reference/examples/login": "JWT 로그인 예제",
        "reference/examples/msa": "Kafka로 주문 서비스와 재고 서비스 연결하기",
        "reference/examples/websocket": "WebSocket 메시지 송수신",
        "reference/security-configuration": "보안 설정",
        "community/contributing": "기여하기",
        "community/versions": "버전 현황",
        "community/changelog": "릴리스 노트",
        "": "Spine 홈",
        "benchmarks/": "성능 측정과 비교",
        "docs": "문서 안내"
    },
    "en": {
        "learn/getting-started/intro": "Introduction",
        "reference/api/spine-app": "spine.App",
        "community/": "Overview",
        "enterprise-support": "Business support",
        "learn/getting-started/installation": "Installation",
        "community/release-channels": "Release channels and installation",
        "learn/getting-started/first-app": "First App",
        "learn/getting-started/platforms": "Select platforms and DTO validation",
        "learn/tutorial/1-project-structure": "1. Project Structure",
        "learn/tutorial/2-controller": "2. Controller",
        "learn/tutorial/3-dependency-injection": "3. Dependency Injection",
        "learn/tutorial/4-interceptor": "4. Interceptor",
        "learn/tutorial/5-database": "5. Database Connection",
        "learn/tutorial/6-transaction": "6. Transaction Management",
        "learn/tutorial/7-error-handling": "7. Error Handling",
        "learn/tutorial/8-swagger": "8. Swagger and OpenAPI Documentation",
        "learn/core-concepts/pipeline": "Execution Pipeline",
        "learn/core-concepts/execution-context": "spine.Ctx",
        "learn/core-concepts/handler-meta": "HandlerMeta",
        "learn/core-concepts/query-values": "Read query inputs",
        "learn/core-concepts/httperr": "httperr",
        "learn/migration/v0.7.5": "Migrate to the 0.7.5 API",
        "learn/migration/v0.7.1": "Migrate to v0.7.1",
        "learn/migration/preview-features": "HTTP v3 and boot options",
        "learn/migration/preview-controller-routes": "Controller and route migration",
        "learn/migration/v0.7.1-preview": "Handler input migration",
        "reference/api/openapi": "Runtime OpenAPI",
        "reference/api/execution-context": "spine.Ctx",
        "reference/api/interceptor": "Interceptor",
        "reference/api/query-values": "query.Values",
        "reference/examples/crud": "Build a User CRUD API",
        "reference/examples/login": "JWT Login Example",
        "reference/examples/msa": "Connect Order and Inventory Services with Kafka",
        "reference/examples/websocket": "Build a WebSocket Chat",
        "reference/security-configuration": "Security Configuration",
        "community/contributing": "Contributing",
        "community/versions": "Version catalog",
        "community/changelog": "Release notes",
        "": "Spine home",
        "benchmarks/": "Performance measurements and comparisons",
        "docs": "Documentation map"
    },
    "ja": {
        "learn/getting-started/intro": "紹介",
        "reference/api/spine-app": "spine.App",
        "community/": "概要",
        "enterprise-support": "企業向け支援",
        "learn/getting-started/installation": "インストール",
        "community/release-channels": "リリースチャンネルとインストール",
        "learn/getting-started/first-app": "最初のアプリ",
        "learn/getting-started/platforms": "プラットフォームとDTO検証の選択",
        "learn/tutorial/1-project-structure": "1. プロジェクト構造",
        "learn/tutorial/2-controller": "2. コントローラー",
        "learn/tutorial/3-dependency-injection": "3. 依存関係の注入",
        "learn/tutorial/4-interceptor": "4. インターセプター",
        "learn/tutorial/5-database": "5. データベース接続",
        "learn/tutorial/6-transaction": "6. トランザクション管理",
        "learn/tutorial/7-error-handling": "7. エラーハンドリング",
        "learn/tutorial/8-swagger": "8. SwaggerとOpenAPIドキュメント",
        "learn/core-concepts/pipeline": "実行パイプライン",
        "learn/core-concepts/execution-context": "spine.Ctx",
        "learn/core-concepts/handler-meta": "HandlerMeta",
        "learn/core-concepts/query-values": "クエリ入力の使い方",
        "learn/core-concepts/httperr": "httperr パッケージ",
        "learn/migration/v0.7.5": "0.7.5 API への移行",
        "learn/migration/v0.7.1": "v0.7.1 への移行",
        "learn/migration/preview-features": "HTTP v3 と起動オプション",
        "learn/migration/preview-controller-routes": "コントローラーとルートの移行",
        "learn/migration/v0.7.1-preview": "ハンドラー入力の移行",
        "reference/api/openapi": "ランタイム OpenAPI",
        "reference/api/execution-context": "spine.Ctx",
        "reference/api/interceptor": "core.Interceptor",
        "reference/api/query-values": "query.Values",
        "reference/examples/crud": "ユーザーCRUD APIを作る",
        "reference/examples/login": "JWTログインの例",
        "reference/examples/msa": "Kafkaで注文サービスと在庫サービスを接続する",
        "reference/examples/websocket": "WebSocketチャットを作る",
        "reference/security-configuration": "セキュリティ設定",
        "community/contributing": "貢献する",
        "community/versions": "バージョン一覧",
        "community/changelog": "リリースノート",
        "": "Spine ホーム",
        "benchmarks/": "性能測定と比較",
        "docs": "ドキュメント案内"
    },
    "zh-Hans": {
        "learn/getting-started/intro": "简介",
        "reference/api/spine-app": "spine.App",
        "community/": "概览",
        "enterprise-support": "企业支持",
        "learn/getting-started/installation": "安装",
        "community/release-channels": "发布渠道与安装",
        "learn/getting-started/first-app": "第一个应用",
        "learn/getting-started/platforms": "选择平台与 DTO 验证",
        "learn/tutorial/1-project-structure": "1. 项目结构",
        "learn/tutorial/2-controller": "2. 控制器",
        "learn/tutorial/3-dependency-injection": "3. 依赖注入",
        "learn/tutorial/4-interceptor": "4. 拦截器",
        "learn/tutorial/5-database": "5. 数据库连接",
        "learn/tutorial/6-transaction": "6. 事务管理",
        "learn/tutorial/7-error-handling": "7. 错误处理",
        "learn/tutorial/8-swagger": "8. Swagger 和 OpenAPI 文档",
        "learn/core-concepts/pipeline": "执行管道",
        "learn/core-concepts/execution-context": "spine.Ctx",
        "learn/core-concepts/handler-meta": "HandlerMeta",
        "learn/core-concepts/query-values": "读取查询输入",
        "learn/core-concepts/httperr": "httperr",
        "learn/migration/v0.7.5": "迁移到 0.7.5 API",
        "learn/migration/v0.7.1": "迁移到 v0.7.1",
        "learn/migration/preview-features": "HTTP v3 与启动选项",
        "learn/migration/preview-controller-routes": "控制器与路由迁移",
        "learn/migration/v0.7.1-preview": "处理器输入迁移",
        "reference/api/openapi": "运行时 OpenAPI",
        "reference/api/execution-context": "spine.Ctx",
        "reference/api/interceptor": "Interceptor",
        "reference/api/query-values": "query.Values",
        "reference/examples/crud": "创建用户 CRUD API",
        "reference/examples/login": "JWT 登录示例",
        "reference/examples/msa": "使用 Kafka 连接订单服务和库存服务",
        "reference/examples/websocket": "创建 WebSocket 聊天应用",
        "reference/security-configuration": "安全配置",
        "community/contributing": "贡献指南",
        "community/versions": "版本概览",
        "community/changelog": "发布说明",
        "": "Spine 首页",
        "benchmarks/": "性能测量与比较",
        "docs": "文档导航"
    },
    "zh-Hant": {
        "learn/getting-started/intro": "簡介",
        "reference/api/spine-app": "spine.App",
        "community/": "概覽",
        "enterprise-support": "企業支援",
        "learn/getting-started/installation": "安裝",
        "community/release-channels": "發佈通道與安裝",
        "learn/getting-started/first-app": "第一個應用程式",
        "learn/getting-started/platforms": "選擇平台與 DTO 驗證",
        "learn/tutorial/1-project-structure": "1. 專案結構",
        "learn/tutorial/2-controller": "2. 控制器",
        "learn/tutorial/3-dependency-injection": "3. 相依性注入",
        "learn/tutorial/4-interceptor": "4. 攔截器",
        "learn/tutorial/5-database": "5. 資料庫連線",
        "learn/tutorial/6-transaction": "6. 交易管理",
        "learn/tutorial/7-error-handling": "7. 錯誤處理",
        "learn/tutorial/8-swagger": "8. Swagger 與 OpenAPI 文件",
        "learn/core-concepts/pipeline": "執行管線",
        "learn/core-concepts/execution-context": "spine.Ctx",
        "learn/core-concepts/handler-meta": "HandlerMeta",
        "learn/core-concepts/query-values": "讀取查詢輸入",
        "learn/core-concepts/httperr": "httperr",
        "learn/migration/v0.7.5": "移轉至 0.7.5 API",
        "learn/migration/v0.7.1": "移轉至 v0.7.1",
        "learn/migration/preview-features": "HTTP v3 與啟動選項",
        "learn/migration/preview-controller-routes": "控制器與路由遷移",
        "learn/migration/v0.7.1-preview": "處理器輸入移轉",
        "reference/api/openapi": "執行階段 OpenAPI",
        "reference/api/execution-context": "spine.Ctx",
        "reference/api/interceptor": "Interceptor",
        "reference/api/query-values": "query.Values",
        "reference/examples/crud": "建立使用者 CRUD API",
        "reference/examples/login": "JWT 登入範例",
        "reference/examples/msa": "使用 Kafka 連接訂單服務與庫存服務",
        "reference/examples/websocket": "建立 WebSocket 聊天應用程式",
        "reference/security-configuration": "安全性設定",
        "community/contributing": "貢獻指南",
        "community/versions": "版本概覽",
        "community/changelog": "版本說明",
        "": "Spine 首頁",
        "benchmarks/": "效能測量與比較",
        "docs": "文件導覽"
    }
}

export function siteLocale(value: string): SiteLocale {
    const locale = value.replace(/^\//, '').split('/')[0]
    return Object.hasOwn(copy, locale) ? locale as SiteLocale : 'en'
}

function page(locale: SiteLocale, path: string): DefaultTheme.SidebarItem & { link: string } {
    const suffix = path && !path.endsWith('/') ? '.html' : ''
    return { text: pageLabels[locale][path], link: `/${locale}/${path}${suffix}` }
}

export function documentationSections(locale: SiteLocale) {
    return (Object.entries(sectionPaths) as [SectionId, readonly string[]][]).map(([id, paths], index) => ({
        id,
        text: copy[locale].groups[index],
        items: paths.map(path => page(locale, path))
    }))
}

export function siteNavigation(locale: SiteLocale): Pick<DefaultTheme.Config, 'nav' | 'sidebar'> {
    const text = copy[locale]
    const sections = documentationSections(locale)
    const docs: DefaultTheme.SidebarItem[] = [
        page(locale, 'docs'),
        ...sections.slice(0, 7).map(section => ({
            text: section.text,
            items: section.items,
            ...(section.id === 'getting-started' || section.id === 'operations' ? {} : { collapsed: true })
        }))
    ]
    const sidebar: DefaultTheme.SidebarMulti = {
        [`/${locale}/docs`]: docs,
        [`/${locale}/learn/`]: docs,
        [`/${locale}/reference/`]: docs,
        [`/${locale}/learn/migration/`]: docs,
        [`/${locale}/community/versions`]: [sections[7]],
        [`/${locale}/community/release-channels`]: [sections[7]],
        [`/${locale}/community/changelog`]: [sections[7]],
        [`/${locale}/community/`]: [sections[8]]
    }
    return {
        nav: [
            { text: text.docs, link: `/${locale}/docs`, activeMatch: `^/${locale}/(?:docs(?:\\.html)?$|learn/|reference/)` },
            { text: text.releases, link: `/${locale}/community/versions`, activeMatch: `^/${locale}/community/(?:versions|release-channels|changelog)` },
            { text: text.community, link: `/${locale}/community/`, activeMatch: `^/${locale}/community/(?:$|index|contributing)` },
            { text: text.support, link: `/${locale}/enterprise-support` }
        ],
        sidebar
    }
}

export function footerNavigation(locale: SiteLocale) {
    const text = copy[locale]
    return [
        { title: text.docs, items: ['docs', 'learn/getting-started/first-app', 'reference/api/spine-app', 'reference/security-configuration'].map(path => page(locale, path)) },
        { title: text.preview, items: sectionPaths.preview.map(path => page(locale, path)) },
        { title: text.participate, items: ['community/versions', 'community/release-channels', 'community/contributing', 'enterprise-support'].map(path => page(locale, path)) }
    ]
}
