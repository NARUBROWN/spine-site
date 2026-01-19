import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
    title: "Spine",
    description: "Spine is a backend framework for explicit request execution. It makes the entire execution flow visible and controllable — from request resolution to completion. No magic. No hidden behavior. Just execution.",
    head: [['link', { rel: 'icon', href: '/logo.png' }]],

    themeConfig: {
        logo: '/logo.png',
        siteTitle: false,
        // https://vitepress.dev/reference/default-theme-config
        socialLinks: [
            { icon: 'github', link: 'https://github.com/NARUBROWN/spine' }
        ]
    },

    locales: {
        root: {
            label: 'English',
            lang: 'en',
            themeConfig: {
                nav: [
                    { text: 'Learn', link: '/learn/getting-started/intro' },
                    { text: 'Reference', link: '/reference/api/spine-app' },
                    { text: 'Community', link: '/community/' }
                ],
                sidebar: {
                    '/learn/': [
                        {
                            text: 'Getting Started',
                            items: [
                                { text: 'Introduction', link: '/learn/getting-started/intro' },
                                { text: 'Installation', link: '/learn/getting-started/installation' },
                                { text: 'First App', link: '/learn/getting-started/first-app' }
                            ]
                        },
                        {
                            text: 'Tutorial',
                            items: [
                                { text: '1. Project Structure', link: '/learn/tutorial/1-project-structure' },
                                { text: '2. Controller', link: '/learn/tutorial/2-controller' },
                                { text: '3. Dependency Injection', link: '/learn/tutorial/3-dependency-injection' },
                                { text: '4. Interceptor', link: '/learn/tutorial/4-interceptor' },
                                { text: '5. Database', link: '/learn/tutorial/5-database' },
                                { text: '6. Transaction', link: '/learn/tutorial/6-transaction' },
                                { text: '7. Error Handling', link: '/learn/tutorial/7-error-handling' },
                                { text: '8. Swagger', link: '/learn/tutorial/8-swagger' }
                            ]
                        },
                        {
                            text: 'Core Concepts',
                            items: [
                                { text: 'Pipeline', link: '/learn/core-concepts/pipeline' },
                                { text: 'ExecutionContext', link: '/learn/core-concepts/execution-context' },
                                { text: 'HandlerMeta', link: '/learn/core-concepts/handler-meta' },
                                { text: 'query.Values', link: '/learn/core-concepts/query-values' },
                                { text: 'httperr', link: '/learn/core-concepts/httperr' }
                            ]
                        }
                    ],
                    '/reference/': [
                        {
                            text: 'API Reference',
                            items: [
                                { text: 'spine.App', link: '/reference/api/spine-app' },
                                { text: 'ExecutionContext', link: '/reference/api/execution-context' },
                                { text: 'Interceptor', link: '/reference/api/interceptor' },
                                { text: 'query.Values', link: '/reference/api/query-values' }
                            ]
                        },
                        {
                            text: 'Examples',
                            items: [
                                { text: 'CRUD', link: '/reference/examples/crud' },
                                { text: 'JWT Auth', link: '/reference/examples/jwt' },
                                { text: 'File Upload', link: '/reference/examples/file-upload' },
                                { text: 'WebSocket', link: '/reference/examples/websocket' }
                            ]
                        }
                    ],
                    '/community/': [
                        {
                            text: 'Community',
                            items: [
                                { text: 'Overview', link: '/community/' },
                                { text: 'Contributing', link: '/community/contributing' },
                                { text: 'Changelog', link: '/community/changelog' }
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
                socialLinks: [
                    { icon: 'github', link: 'https://github.com/NARUBROWN/spine' }
                ],
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
                                { text: '파이프라인', link: '/ko/learn/core-concepts/pipeline' },
                                { text: '실행 컨텍스트', link: '/ko/learn/core-concepts/execution-context' },
                                { text: '핸들러 메타', link: '/ko/learn/core-concepts/handler-meta' },
                                { text: 'query.Values', link: '/ko/learn/core-concepts/query-values' },
                                { text: 'httperr', link: '/ko/learn/core-concepts/httperr' }
                            ]
                        }
                    ],
                    '/ko/reference/': [
                        {
                            text: 'API 참조',
                            items: [
                                { text: 'spine.App', link: '/ko/reference/api/spine-app' },
                                { text: 'ExecutionContext', link: '/ko/reference/api/execution-context' },
                                { text: 'Interceptor', link: '/ko/reference/api/interceptor' },
                                { text: 'query.Values', link: '/ko/reference/api/query-values' }
                            ]
                        },
                        {
                            text: '예제',
                            items: [
                                { text: 'CRUD', link: '/ko/reference/examples/crud' },
                                { text: 'JWT 인증', link: '/ko/reference/examples/jwt' },
                                { text: '파일 업로드', link: '/ko/reference/examples/file-upload' },
                                { text: '웹소켓', link: '/ko/reference/examples/websocket' }
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
        }
    }
}))
