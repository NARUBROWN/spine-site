import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { localizeMarkdownUi, themeUi } from './localized-ui'
import { siteNavigation } from './navigation'

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
    title: "Spine",
    description: "Spine is a Go backend framework with public HTTP, WebSocket, event, and DTO validation contracts. Use the CLI to select independent implementations, create projects, and verify application contracts.",
    head: [
        ['link', { rel: 'icon', href: '/logo.png' }],
        ['meta', { property: 'og:image', content: 'https://spine.na2ru2.me/og-image.png' }],
        ['meta', { name: 'twitter:image', content: 'https://spine.na2ru2.me/og-image.png' }],
        ['script', {
            src: 'https://context7.com/widget.js',
            async: '',
            'data-library': '/websites/spine_na2ru2_me_ko'
        }]
    ],

    themeConfig: {
        logo: '/header_logo.png',
        siteTitle: false,
        // https://vitepress.dev/reference/default-theme-config
        socialLinks: [
            { icon: 'github', link: 'https://github.com/NARUBROWN/spine' }
        ]
    },

    vite: {
        resolve: {
            alias: {
                'vitepress-plugin-mermaid/Mermaid.vue': fileURLToPath(
                    new URL('./theme/components/MermaidDiagram.vue', import.meta.url)
                )
            }
        }
    },

    markdown: {
        config: localizeMarkdownUi
    },

    locales: {
        en: {
            label: 'English',
            lang: 'en',
            link: '/en/',
            description: 'Spine is a Go backend framework with public HTTP, WebSocket, event, and DTO validation contracts. Use the CLI to select independent implementations, create projects, and verify application contracts.',
            themeConfig: {
                ...themeUi('en'),
                outlineTitle: 'On this page',
                docFooter: {
                    prev: 'Previous page',
                    next: 'Next page'
                },
                ...siteNavigation('en')
            }
        },
        ko: {
            label: '한국어',
            lang: 'ko',
            link: '/ko/',
            description: 'Spine은 HTTP, WebSocket, 이벤트와 DTO 검증의 공개 계약을 제공하는 Go 백엔드 프레임워크입니다. CLI로 독립 구현을 선택해 프로젝트를 만들고 앱의 실행 계약을 검사합니다.',
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
                ...siteNavigation('ko')
            }
        },
        ja: {
            label: '日本語',
            lang: 'ja',
            link: '/ja/',
            description: 'SpineはHTTP、WebSocket、イベント、DTO検証の公開契約を提供するGoバックエンドフレームワークです。CLIで独立実装を選び、プロジェクトの生成とアプリの実行契約の検査を行います。',
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
                ...siteNavigation('ja')
            }
        },
        'zh-Hans': {
            label: '简体中文',
            lang: 'zh-CN',
            link: '/zh-Hans/',
            description: 'Spine 是提供 HTTP、WebSocket、事件和 DTO 验证公共契约的 Go 后端框架。通过 CLI 选择独立实现、创建项目并检查应用执行契约。',
            themeConfig: {
                ...themeUi('zh-Hans'),
                siteTitle: false,
                outlineTitle: '本页内容',
                docFooter: { prev: '上一页', next: '下一页' },
                ...siteNavigation('zh-Hans')
            }
        },
        'zh-Hant': {
            label: '繁體中文',
            lang: 'zh-TW',
            link: '/zh-Hant/',
            description: 'Spine 是提供 HTTP、WebSocket、事件與 DTO 驗證公開契約的 Go 後端框架。透過 CLI 選擇獨立實作、建立專案並檢查應用程式執行契約。',
            themeConfig: {
                ...themeUi('zh-Hant'),
                siteTitle: false,
                outlineTitle: '本頁內容',
                docFooter: { prev: '上一頁', next: '下一頁' },
                ...siteNavigation('zh-Hant')
            }
        }
    }
}))
