import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
    title: "Spine",
    description: "Spine is a backend framework for explicit request execution. It makes the entire execution flow visible and controllable — from request resolution to completion. No magic. No hidden behavior. Just execution.",
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

    locales: {
        en: {
            label: 'English',
            lang: 'en',
            link: '/en/',
            themeConfig: {
                outlineTitle: 'On this page',
                sidebarMenuLabel: 'Menu',
                docFooter: {
                    prev: 'Previous page',
                    next: 'Next page'
                },
                nav: [
                    { text: 'Learn', link: '/en/learn/getting-started/intro' },
                    { text: 'Reference', link: '/en/reference/api/spine-app' },
                    { text: 'Community', link: '/en/community/' }
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
                                { text: '5. Database', link: '/en/learn/tutorial/5-database' },
                                { text: '6. Transaction', link: '/en/learn/tutorial/6-transaction' },
                                { text: '7. Error Handling', link: '/en/learn/tutorial/7-error-handling' },
                                { text: '8. Swagger', link: '/en/learn/tutorial/8-swagger' }
                            ]
                        },
                        {
                            text: 'Core Concepts',
                            items: [
                                { text: 'Pipeline', link: '/en/learn/core-concepts/pipeline' },
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
                                { text: 'CRUD', link: '/en/reference/examples/crud' },
                                { text: 'JWT Login', link: '/en/reference/examples/login' },
                                { text: 'Kafka MSA', link: '/en/reference/examples/msa' },
                                { text: 'WebSocket Chat', link: '/en/reference/examples/websocket' }
                            ]
                        }
                    ],
                    '/en/community/': [
                        {
                            text: 'Community',
                            items: [
                                { text: 'Overview', link: '/en/community/' },
                                { text: 'Contributing', link: '/en/community/contributing' },
                                { text: 'Changelog', link: '/en/community/changelog' }
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
            themeConfig: {
                siteTitle: false,
                outlineTitle: '이 페이지에서',
                sidebarMenuLabel: '메뉴',
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
                    { text: '커뮤니티', link: '/ko/community/' }
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
                                { text: '5. 데이터베이스', link: '/ko/learn/tutorial/5-database' },
                                { text: '6. 트랜잭션', link: '/ko/learn/tutorial/6-transaction' },
                                { text: '7. 에러 처리', link: '/ko/learn/tutorial/7-error-handling' },
                                { text: '8. 스웨거', link: '/ko/learn/tutorial/8-swagger' }
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
                                { text: 'CRUD 기본', link: '/ko/reference/examples/crud' },
                                { text: 'JWT 로그인', link: '/ko/reference/examples/login' },
                                { text: 'Kafka MSA', link: '/ko/reference/examples/msa' },
                                { text: '웹소켓 채팅', link: '/ko/reference/examples/websocket' }
                            ]
                        }
                    ],
                    '/ko/community/': [
                        {
                            text: '커뮤니티',
                            items: [
                                { text: '개요', link: '/ko/community/' },
                                { text: '기여하기', link: '/ko/community/contributing' },
                                { text: '변경 기록', link: '/ko/community/changelog' }
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
            themeConfig: {
                siteTitle: false,
                outlineTitle: 'このページ',
                sidebarMenuLabel: 'メニュー',
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
                    { text: 'コミュニティ', link: '/ja/community/' }
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
                                { text: '5. データベース', link: '/ja/learn/tutorial/5-database' },
                                { text: '6. トランザクション', link: '/ja/learn/tutorial/6-transaction' },
                                { text: '7. エラーハンドリング', link: '/ja/learn/tutorial/7-error-handling' },
                                { text: '8. Swagger', link: '/ja/learn/tutorial/8-swagger' }
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
                                { text: 'CRUDの基本', link: '/ja/reference/examples/crud' },
                                { text: 'JWTログイン', link: '/ja/reference/examples/login' },
                                { text: 'Kafka MSA', link: '/ja/reference/examples/msa' },
                                { text: 'WebSocketチャット', link: '/ja/reference/examples/websocket' }
                            ]
                        }
                    ],
                    '/ja/community/': [
                        {
                            text: 'コミュニティ',
                            items: [
                                { text: '概要', link: '/ja/community/' },
                                { text: '貢献する', link: '/ja/community/contributing' },
                                { text: '変更履歴', link: '/ja/community/changelog' }
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
            themeConfig: {
                siteTitle: false,
                outlineTitle: '本页内容',
                docFooter: { prev: '上一页', next: '下一页' },
                nav: [
                    { text: '学习', link: '/zh-Hans/learn/getting-started/intro' },
                    { text: '参考', link: '/zh-Hans/reference/api/spine-app' },
                    { text: '社区', link: '/zh-Hans/community/' }
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
                            { text: '5. 数据库', link: '/zh-Hans/learn/tutorial/5-database' },
                            { text: '6. 事务', link: '/zh-Hans/learn/tutorial/6-transaction' },
                            { text: '7. 错误处理', link: '/zh-Hans/learn/tutorial/7-error-handling' },
                            { text: '8. Swagger', link: '/zh-Hans/learn/tutorial/8-swagger' }
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
                            { text: 'CRUD', link: '/zh-Hans/reference/examples/crud' },
                            { text: 'JWT 登录', link: '/zh-Hans/reference/examples/login' },
                            { text: 'Kafka MSA', link: '/zh-Hans/reference/examples/msa' },
                            { text: 'WebSocket 聊天', link: '/zh-Hans/reference/examples/websocket' }
                        ] }
                    ],
                    '/zh-Hans/community/': [
                        { text: '社区', items: [
                            { text: '概览', link: '/zh-Hans/community/' },
                            { text: '贡献指南', link: '/zh-Hans/community/contributing' },
                            { text: '更新日志', link: '/zh-Hans/community/changelog' }
                        ] }
                    ]
                }
            }
        },
        'zh-Hant': {
            label: '繁體中文',
            lang: 'zh-TW',
            link: '/zh-Hant/',
            themeConfig: {
                siteTitle: false,
                outlineTitle: '本頁內容',
                docFooter: { prev: '上一頁', next: '下一頁' },
                nav: [
                    { text: '學習', link: '/zh-Hant/learn/getting-started/intro' },
                    { text: '參考', link: '/zh-Hant/reference/api/spine-app' },
                    { text: '社群', link: '/zh-Hant/community/' }
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
                            { text: '5. 資料庫', link: '/zh-Hant/learn/tutorial/5-database' },
                            { text: '6. 交易', link: '/zh-Hant/learn/tutorial/6-transaction' },
                            { text: '7. 錯誤處理', link: '/zh-Hant/learn/tutorial/7-error-handling' },
                            { text: '8. Swagger', link: '/zh-Hant/learn/tutorial/8-swagger' }
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
                            { text: 'CRUD', link: '/zh-Hant/reference/examples/crud' },
                            { text: 'JWT 登入', link: '/zh-Hant/reference/examples/login' },
                            { text: 'Kafka MSA', link: '/zh-Hant/reference/examples/msa' },
                            { text: 'WebSocket 聊天', link: '/zh-Hant/reference/examples/websocket' }
                        ] }
                    ],
                    '/zh-Hant/community/': [
                        { text: '社群', items: [
                            { text: '概覽', link: '/zh-Hant/community/' },
                            { text: '貢獻指南', link: '/zh-Hant/community/contributing' },
                            { text: '更新日誌', link: '/zh-Hant/community/changelog' }
                        ] }
                    ]
                }
            }
        }
    }
}))
