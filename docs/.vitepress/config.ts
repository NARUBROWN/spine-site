import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
    title: "Spine",
    description: "Spine is a backend framework for explicit request execution. It makes the entire execution flow visible and controllable — from request resolution to completion. No magic. No hidden behavior. Just execution.",
    head: [['link', { rel: 'icon', href: '/logo.png' }]],

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
                                { text: 'JWT Auth', link: '/en/reference/examples/jwt' },
                                { text: 'File Upload', link: '/en/reference/examples/file-upload' },
                                { text: 'WebSocket', link: '/en/reference/examples/websocket' }
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
                                { text: 'JWT 로그인', link: '/ko/reference/examples/login' }
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
