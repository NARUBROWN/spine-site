import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { localizeMarkdownUi, themeUi } from './localized-ui'

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
    title: "Spine",
    description: "Spine is a web framework that lets you register constructors, routes, and interceptors in Go code. Use the CLI to create a project, validate the app configuration, and start HTTP and message processing.",
    head: [
        ['link', { rel: 'icon', href: '/logo.png' }],
        ['meta', { property: 'og:image', content: 'https://spine.na2ru2.me/og-image.png' }],
        ['meta', { name: 'twitter:image', content: 'https://spine.na2ru2.me/og-image.png' }]
    ],

    themeConfig: {
        logo: '/header_logo.png',
        siteTitle: false,
        // https://vitepress.dev/reference/default-theme-config
        socialLinks: [
            { icon: 'github', link: 'https://github.com/NARUBROWN/spine' }
        ]
    },

    markdown: {
        config: localizeMarkdownUi
    },

    locales: {
        en: {
            label: 'English',
            lang: 'en',
            link: '/en/',
            description: 'Spine is a web framework that lets you register constructors, routes, and interceptors in Go code. Use the CLI to create a project, validate the app configuration, and start HTTP and message processing.',
            themeConfig: {
                ...themeUi('en'),
                outlineTitle: 'On this page',
                docFooter: {
                    prev: 'Previous page',
                    next: 'Next page'
                },
                nav: [
                    { text: 'Learn', link: '/en/learn/getting-started/intro' },
                    { text: 'Reference', link: '/en/reference/api/spine-app' },
                    { text: 'Community', link: '/en/community/' },
                    { text: 'Business support', link: '/en/enterprise-support' }
                ],
                sidebar: {
                    '/en/learn/': [
                        {
                            text: 'Getting Started',
                            items: [
                                { text: 'Introduction', link: '/en/learn/getting-started/intro' },
                                { text: 'Installation', link: '/en/learn/getting-started/installation' },
                                { text: 'First App', link: '/en/learn/getting-started/first-app' }
                            ]
                        },
                        {
                            text: 'Tutorial',
                            items: [
                                { text: '1. Project Structure', link: '/en/learn/tutorial/1-project-structure' },
                                { text: '2. Controller', link: '/en/learn/tutorial/2-controller' },
                                { text: '3. Dependency Injection', link: '/en/learn/tutorial/3-dependency-injection' },
                                { text: '4. Interceptor', link: '/en/learn/tutorial/4-interceptor' },
                                { text: '5. Database Connection', link: '/en/learn/tutorial/5-database' },
                                { text: '6. Transaction Management', link: '/en/learn/tutorial/6-transaction' },
                                { text: '7. Error Handling', link: '/en/learn/tutorial/7-error-handling' },
                                { text: '8. Swagger and OpenAPI Documentation', link: '/en/learn/tutorial/8-swagger' }
                            ]
                        },
                        {
                            text: 'Core Concepts',
                            items: [
                                { text: 'Execution Pipeline', link: '/en/learn/core-concepts/pipeline' },
                                { text: 'ExecutionContext', link: '/en/learn/core-concepts/execution-context' },
                                { text: 'HandlerMeta', link: '/en/learn/core-concepts/handler-meta' },
                                { text: 'query.Values', link: '/en/learn/core-concepts/query-values' },
                                { text: 'httperr', link: '/en/learn/core-concepts/httperr' }
                            ]
                        }
                    ],
                    '/en/reference/': [
                        {
                            text: 'API Reference',
                            items: [
                                { text: 'spine.App', link: '/en/reference/api/spine-app' },
                                { text: 'ExecutionContext', link: '/en/reference/api/execution-context' },
                                { text: 'Interceptor', link: '/en/reference/api/interceptor' },
                                { text: 'query.Values', link: '/en/reference/api/query-values' }
                            ]
                        },
                        {
                            text: 'Examples',
                            items: [
                                { text: 'Build a User CRUD API', link: '/en/reference/examples/crud' },
                                { text: 'JWT Login Example', link: '/en/reference/examples/login' },
                                { text: 'Connect Order and Inventory Services with Kafka', link: '/en/reference/examples/msa' },
                                { text: 'Build a WebSocket Chat', link: '/en/reference/examples/websocket' }
                            ]
                        },
                        {
                            text: 'Operations',
                            items: [
                                { text: 'Security Configuration', link: '/en/reference/security-configuration' }
                            ]
                        }
                    ],
                    '/en/community/': [
                        {
                            text: 'Community',
                            items: [
                                { text: 'Overview', link: '/en/community/' },
                                { text: 'Contributing', link: '/en/community/contributing' },
                                { text: 'Current Release', link: '/en/community/changelog' }
                            ]
                        }
                    ]
                }
            }
        },
        ko: {
            label: '한국어',
            lang: 'ko',
            link: '/ko/',
            description: 'Spine은 생성자, 라우트, 인터셉터를 Go 코드로 등록하는 웹 프레임워크입니다. CLI로 프로젝트를 만들고 앱 구성을 검증한 뒤 HTTP와 메시지 처리를 실행합니다.',
            themeConfig: {
                ...themeUi('ko'),
                siteTitle: false,
                outlineTitle: '이 페이지에서',
                socialLinks: [
                    { icon: 'github', link: 'https://github.com/NARUBROWN/spine' }
                ],
                docFooter: {
                    prev: '이전 페이지',
                    next: '다음 페이지'
                },
                nav: [
                    { text: '배우기', link: '/ko/learn/getting-started/intro' },
                    { text: '참조', link: '/ko/reference/api/spine-app' },
                    { text: '커뮤니티', link: '/ko/community/' },
                    { text: '기업 지원', link: '/ko/enterprise-support' }
                ],
                sidebar: {
                    '/ko/learn/': [
                        {
                            text: '시작하기',
                            items: [
                                { text: '소개', link: '/ko/learn/getting-started/intro' },
                                { text: '설치', link: '/ko/learn/getting-started/installation' },
                                { text: '첫 번째 앱', link: '/ko/learn/getting-started/first-app' }
                            ]
                        },
                        {
                            text: '튜토리얼',
                            items: [
                                { text: '1. 프로젝트 구조', link: '/ko/learn/tutorial/1-project-structure' },
                                { text: '2. 컨트롤러', link: '/ko/learn/tutorial/2-controller' },
                                { text: '3. 의존성 주입', link: '/ko/learn/tutorial/3-dependency-injection' },
                                { text: '4. 인터셉터', link: '/ko/learn/tutorial/4-interceptor' },
                                { text: '5. 데이터베이스 연결', link: '/ko/learn/tutorial/5-database' },
                                { text: '6. 트랜잭션 관리', link: '/ko/learn/tutorial/6-transaction' },
                                { text: '7. 오류 처리', link: '/ko/learn/tutorial/7-error-handling' },
                                { text: '8. Swagger와 OpenAPI 문서', link: '/ko/learn/tutorial/8-swagger' }
                            ]
                        },
                        {
                            text: '핵심 개념',
                            items: [
                                { text: '실행 파이프라인', link: '/ko/learn/core-concepts/pipeline' },
                                { text: 'ExecutionContext', link: '/ko/learn/core-concepts/execution-context' },
                                { text: 'HandlerMeta', link: '/ko/learn/core-concepts/handler-meta' },
                                { text: 'query.Values', link: '/ko/learn/core-concepts/query-values' },
                                { text: 'httperr 패키지', link: '/ko/learn/core-concepts/httperr' }
                            ]
                        },

                    ],
                    '/ko/reference/': [
                        {
                            text: 'API 문서',
                            items: [
                                { text: 'spine.App', link: '/ko/reference/api/spine-app' },
                                { text: 'core.ExecutionContext', link: '/ko/reference/api/execution-context' },
                                { text: 'core.Interceptor', link: '/ko/reference/api/interceptor' },
                                { text: 'query.Values', link: '/ko/reference/api/query-values' }
                            ]
                        },
                        {
                            text: '예제 모음',
                            items: [
                                { text: '사용자 CRUD API 만들기', link: '/ko/reference/examples/crud' },
                                { text: 'JWT 로그인 예제', link: '/ko/reference/examples/login' },
                                { text: 'Kafka로 주문 서비스와 재고 서비스 연결하기', link: '/ko/reference/examples/msa' },
                                { text: 'WebSocket 채팅 만들기', link: '/ko/reference/examples/websocket' }
                            ]
                        },
                        {
                            text: '운영',
                            items: [
                                { text: '보안 설정', link: '/ko/reference/security-configuration' }
                            ]
                        }
                    ],
                    '/ko/community/': [
                        {
                            text: '커뮤니티',
                            items: [
                                { text: '개요', link: '/ko/community/' },
                                { text: '기여하기', link: '/ko/community/contributing' },
                                { text: '현재 릴리스', link: '/ko/community/changelog' }
                            ]
                        }
                    ]
                }
            }
        },
        ja: {
            label: '日本語',
            lang: 'ja',
            link: '/ja/',
            description: 'Spineは、コンストラクター、ルート、インターセプターをGoコードで登録するWebフレームワークです。CLIでプロジェクトを作成し、アプリの構成を検証してからHTTPとメッセージの処理を実行します。',
            themeConfig: {
                ...themeUi('ja'),
                siteTitle: false,
                outlineTitle: 'このページ',
                socialLinks: [
                    { icon: 'github', link: 'https://github.com/NARUBROWN/spine' }
                ],
                docFooter: {
                    prev: '前のページ',
                    next: '次のページ'
                },
                nav: [
                    { text: '学ぶ', link: '/ja/learn/getting-started/intro' },
                    { text: 'リファレンス', link: '/ja/reference/api/spine-app' },
                    { text: 'コミュニティ', link: '/ja/community/' },
                    { text: '企業向け支援', link: '/ja/enterprise-support' }
                ],
                sidebar: {
                    '/ja/learn/': [
                        {
                            text: 'はじめに',
                            items: [
                                { text: '紹介', link: '/ja/learn/getting-started/intro' },
                                { text: 'インストール', link: '/ja/learn/getting-started/installation' },
                                { text: '最初のアプリ', link: '/ja/learn/getting-started/first-app' }
                            ]
                        },
                        {
                            text: 'チュートリアル',
                            items: [
                                { text: '1. プロジェクト構造', link: '/ja/learn/tutorial/1-project-structure' },
                                { text: '2. コントローラー', link: '/ja/learn/tutorial/2-controller' },
                                { text: '3. 依存関係の注入', link: '/ja/learn/tutorial/3-dependency-injection' },
                                { text: '4. インターセプター', link: '/ja/learn/tutorial/4-interceptor' },
                                { text: '5. データベース接続', link: '/ja/learn/tutorial/5-database' },
                                { text: '6. トランザクション管理', link: '/ja/learn/tutorial/6-transaction' },
                                { text: '7. エラーハンドリング', link: '/ja/learn/tutorial/7-error-handling' },
                                { text: '8. SwaggerとOpenAPIドキュメント', link: '/ja/learn/tutorial/8-swagger' }
                            ]
                        },
                        {
                            text: 'コア概念',
                            items: [
                                { text: '実行パイプライン', link: '/ja/learn/core-concepts/pipeline' },
                                { text: 'ExecutionContext', link: '/ja/learn/core-concepts/execution-context' },
                                { text: 'HandlerMeta', link: '/ja/learn/core-concepts/handler-meta' },
                                { text: 'query.Values', link: '/ja/learn/core-concepts/query-values' },
                                { text: 'httperr パッケージ', link: '/ja/learn/core-concepts/httperr' }
                            ]
                        }
                    ],
                    '/ja/reference/': [
                        {
                            text: 'APIドキュメント',
                            items: [
                                { text: 'spine.App', link: '/ja/reference/api/spine-app' },
                                { text: 'core.ExecutionContext', link: '/ja/reference/api/execution-context' },
                                { text: 'core.Interceptor', link: '/ja/reference/api/interceptor' },
                                { text: 'query.Values', link: '/ja/reference/api/query-values' }
                            ]
                        },
                        {
                            text: 'サンプル集',
                            items: [
                                { text: 'ユーザーCRUD APIを作る', link: '/ja/reference/examples/crud' },
                                { text: 'JWTログインの例', link: '/ja/reference/examples/login' },
                                { text: 'Kafkaで注文サービスと在庫サービスを接続する', link: '/ja/reference/examples/msa' },
                                { text: 'WebSocketチャットを作る', link: '/ja/reference/examples/websocket' }
                            ]
                        },
                        {
                            text: '運用',
                            items: [
                                { text: 'セキュリティ設定', link: '/ja/reference/security-configuration' }
                            ]
                        }
                    ],
                    '/ja/community/': [
                        {
                            text: 'コミュニティ',
                            items: [
                                { text: '概要', link: '/ja/community/' },
                                { text: '貢献する', link: '/ja/community/contributing' },
                                { text: '現在のリリース', link: '/ja/community/changelog' }
                            ]
                        }
                    ]
                }
            }
        },
        'zh-Hans': {
            label: '简体中文',
            lang: 'zh-CN',
            link: '/zh-Hans/',
            description: 'Spine 是一个通过 Go 代码注册构造函数、路由和拦截器的 Web 框架。使用 CLI 创建项目、验证应用配置，然后启动 HTTP 和消息处理。',
            themeConfig: {
                ...themeUi('zh-Hans'),
                siteTitle: false,
                outlineTitle: '本页内容',
                docFooter: { prev: '上一页', next: '下一页' },
                nav: [
                    { text: '学习', link: '/zh-Hans/learn/getting-started/intro' },
                    { text: '参考', link: '/zh-Hans/reference/api/spine-app' },
                    { text: '社区', link: '/zh-Hans/community/' },
                    { text: '企业支持', link: '/zh-Hans/enterprise-support' }
                ],
                sidebar: {
                    '/zh-Hans/learn/': [
                        { text: '快速开始', items: [
                            { text: '简介', link: '/zh-Hans/learn/getting-started/intro' },
                            { text: '安装', link: '/zh-Hans/learn/getting-started/installation' },
                            { text: '第一个应用', link: '/zh-Hans/learn/getting-started/first-app' }
                        ] },
                        { text: '教程', items: [
                            { text: '1. 项目结构', link: '/zh-Hans/learn/tutorial/1-project-structure' },
                            { text: '2. 控制器', link: '/zh-Hans/learn/tutorial/2-controller' },
                            { text: '3. 依赖注入', link: '/zh-Hans/learn/tutorial/3-dependency-injection' },
                            { text: '4. 拦截器', link: '/zh-Hans/learn/tutorial/4-interceptor' },
                            { text: '5. 数据库连接', link: '/zh-Hans/learn/tutorial/5-database' },
                            { text: '6. 事务管理', link: '/zh-Hans/learn/tutorial/6-transaction' },
                            { text: '7. 错误处理', link: '/zh-Hans/learn/tutorial/7-error-handling' },
                            { text: '8. Swagger 和 OpenAPI 文档', link: '/zh-Hans/learn/tutorial/8-swagger' }
                        ] },
                        { text: '核心概念', items: [
                            { text: '执行管道', link: '/zh-Hans/learn/core-concepts/pipeline' },
                            { text: 'ExecutionContext', link: '/zh-Hans/learn/core-concepts/execution-context' },
                            { text: 'HandlerMeta', link: '/zh-Hans/learn/core-concepts/handler-meta' },
                            { text: 'query.Values', link: '/zh-Hans/learn/core-concepts/query-values' },
                            { text: 'httperr', link: '/zh-Hans/learn/core-concepts/httperr' }
                        ] }
                    ],
                    '/zh-Hans/reference/': [
                        { text: 'API 参考', items: [
                            { text: 'spine.App', link: '/zh-Hans/reference/api/spine-app' },
                            { text: 'ExecutionContext', link: '/zh-Hans/reference/api/execution-context' },
                            { text: 'Interceptor', link: '/zh-Hans/reference/api/interceptor' },
                            { text: 'query.Values', link: '/zh-Hans/reference/api/query-values' }
                        ] },
                        { text: '示例', items: [
                            { text: '创建用户 CRUD API', link: '/zh-Hans/reference/examples/crud' },
                            { text: 'JWT 登录示例', link: '/zh-Hans/reference/examples/login' },
                            { text: '使用 Kafka 连接订单服务和库存服务', link: '/zh-Hans/reference/examples/msa' },
                            { text: '创建 WebSocket 聊天应用', link: '/zh-Hans/reference/examples/websocket' }
                        ] },
                        { text: '运维', items: [
                            { text: '安全配置', link: '/zh-Hans/reference/security-configuration' }
                        ] }
                    ],
                    '/zh-Hans/community/': [
                        { text: '社区', items: [
                            { text: '概览', link: '/zh-Hans/community/' },
                            { text: '贡献指南', link: '/zh-Hans/community/contributing' },
                            { text: '当前版本', link: '/zh-Hans/community/changelog' }
                        ] }
                    ]
                }
            }
        },
        'zh-Hant': {
            label: '繁體中文',
            lang: 'zh-TW',
            link: '/zh-Hant/',
            description: 'Spine 是一個透過 Go 程式碼註冊建構子、路由和攔截器的 Web 框架。使用 CLI 建立專案、驗證應用程式設定，然後啟動 HTTP 和訊息處理。',
            themeConfig: {
                ...themeUi('zh-Hant'),
                siteTitle: false,
                outlineTitle: '本頁內容',
                docFooter: { prev: '上一頁', next: '下一頁' },
                nav: [
                    { text: '學習', link: '/zh-Hant/learn/getting-started/intro' },
                    { text: '參考', link: '/zh-Hant/reference/api/spine-app' },
                    { text: '社群', link: '/zh-Hant/community/' },
                    { text: '企業支援', link: '/zh-Hant/enterprise-support' }
                ],
                sidebar: {
                    '/zh-Hant/learn/': [
                        { text: '快速開始', items: [
                            { text: '簡介', link: '/zh-Hant/learn/getting-started/intro' },
                            { text: '安裝', link: '/zh-Hant/learn/getting-started/installation' },
                            { text: '第一個應用程式', link: '/zh-Hant/learn/getting-started/first-app' }
                        ] },
                        { text: '教學', items: [
                            { text: '1. 專案結構', link: '/zh-Hant/learn/tutorial/1-project-structure' },
                            { text: '2. 控制器', link: '/zh-Hant/learn/tutorial/2-controller' },
                            { text: '3. 相依性注入', link: '/zh-Hant/learn/tutorial/3-dependency-injection' },
                            { text: '4. 攔截器', link: '/zh-Hant/learn/tutorial/4-interceptor' },
                            { text: '5. 資料庫連線', link: '/zh-Hant/learn/tutorial/5-database' },
                            { text: '6. 交易管理', link: '/zh-Hant/learn/tutorial/6-transaction' },
                            { text: '7. 錯誤處理', link: '/zh-Hant/learn/tutorial/7-error-handling' },
                            { text: '8. Swagger 與 OpenAPI 文件', link: '/zh-Hant/learn/tutorial/8-swagger' }
                        ] },
                        { text: '核心概念', items: [
                            { text: '執行管線', link: '/zh-Hant/learn/core-concepts/pipeline' },
                            { text: 'ExecutionContext', link: '/zh-Hant/learn/core-concepts/execution-context' },
                            { text: 'HandlerMeta', link: '/zh-Hant/learn/core-concepts/handler-meta' },
                            { text: 'query.Values', link: '/zh-Hant/learn/core-concepts/query-values' },
                            { text: 'httperr', link: '/zh-Hant/learn/core-concepts/httperr' }
                        ] }
                    ],
                    '/zh-Hant/reference/': [
                        { text: 'API 參考', items: [
                            { text: 'spine.App', link: '/zh-Hant/reference/api/spine-app' },
                            { text: 'ExecutionContext', link: '/zh-Hant/reference/api/execution-context' },
                            { text: 'Interceptor', link: '/zh-Hant/reference/api/interceptor' },
                            { text: 'query.Values', link: '/zh-Hant/reference/api/query-values' }
                        ] },
                        { text: '範例', items: [
                            { text: '建立使用者 CRUD API', link: '/zh-Hant/reference/examples/crud' },
                            { text: 'JWT 登入範例', link: '/zh-Hant/reference/examples/login' },
                            { text: '使用 Kafka 連接訂單服務與庫存服務', link: '/zh-Hant/reference/examples/msa' },
                            { text: '建立 WebSocket 聊天應用程式', link: '/zh-Hant/reference/examples/websocket' }
                        ] },
                        { text: '維運', items: [
                            { text: '安全性設定', link: '/zh-Hant/reference/security-configuration' }
                        ] }
                    ],
                    '/zh-Hant/community/': [
                        { text: '社群', items: [
                            { text: '概覽', link: '/zh-Hant/community/' },
                            { text: '貢獻指南', link: '/zh-Hant/community/contributing' },
                            { text: '目前版本', link: '/zh-Hant/community/changelog' }
                        ] }
                    ]
                }
            }
        }
    }
}))
