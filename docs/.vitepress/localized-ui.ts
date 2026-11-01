import type { DefaultTheme, MarkdownOptions } from 'vitepress'

export const uiControls = {
    ko: {
        sidebarMenuLabel: '메뉴',
        langMenuLabel: '언어 변경',
        returnToTopLabel: '맨 위로',
        skipToContentLabel: '본문으로 건너뛰기',
        darkModeSwitchLabel: '화면 테마',
        lightModeSwitchTitle: '라이트 테마로 전환',
        darkModeSwitchTitle: '다크 테마로 전환',
        codeCopyButtonTitle: '코드 복사',
        codeCopiedText: '복사 완료',
        headingPermalinkLabel: '"{title}" 제목의 고유 링크',
        mermaidLoadingText: '불러오는 중...'
    },
    en: {
        sidebarMenuLabel: 'Menu',
        langMenuLabel: 'Change language',
        returnToTopLabel: 'Return to top',
        skipToContentLabel: 'Skip to content',
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme',
        codeCopyButtonTitle: 'Copy Code',
        codeCopiedText: 'Copied',
        headingPermalinkLabel: 'Permalink to "{title}"',
        mermaidLoadingText: 'Loading...'
    },
    ja: {
        sidebarMenuLabel: 'メニュー',
        langMenuLabel: '言語を変更',
        returnToTopLabel: '先頭に戻る',
        skipToContentLabel: '本文へスキップ',
        darkModeSwitchLabel: '外観',
        lightModeSwitchTitle: 'ライトテーマに切り替える',
        darkModeSwitchTitle: 'ダークテーマに切り替える',
        codeCopyButtonTitle: 'コードをコピー',
        codeCopiedText: 'コピーしました',
        headingPermalinkLabel: '「{title}」への固定リンク',
        mermaidLoadingText: '読み込み中...'
    },
    'zh-Hans': {
        sidebarMenuLabel: '菜单',
        langMenuLabel: '切换语言',
        returnToTopLabel: '返回顶部',
        skipToContentLabel: '跳转到内容',
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色主题',
        darkModeSwitchTitle: '切换到深色主题',
        codeCopyButtonTitle: '复制代码',
        codeCopiedText: '已复制',
        headingPermalinkLabel: '指向“{title}”的永久链接',
        mermaidLoadingText: '正在加载...'
    },
    'zh-Hant': {
        sidebarMenuLabel: '選單',
        langMenuLabel: '切換語言',
        returnToTopLabel: '回到頂端',
        skipToContentLabel: '跳至主要內容',
        darkModeSwitchLabel: '外觀',
        lightModeSwitchTitle: '切換為淺色主題',
        darkModeSwitchTitle: '切換為深色主題',
        codeCopyButtonTitle: '複製程式碼',
        codeCopiedText: '已複製',
        headingPermalinkLabel: '「{title}」的永久連結',
        mermaidLoadingText: '載入中...'
    }
} as const

type UiLocale = keyof typeof uiControls
type ThemeUiKey = 'sidebarMenuLabel' | 'langMenuLabel' | 'returnToTopLabel'
    | 'skipToContentLabel' | 'darkModeSwitchLabel' | 'lightModeSwitchTitle'
    | 'darkModeSwitchTitle'

export function themeUi(locale: UiLocale): Pick<DefaultTheme.Config, ThemeUiKey> {
    const { sidebarMenuLabel, langMenuLabel, returnToTopLabel, skipToContentLabel,
        darkModeSwitchLabel, lightModeSwitchTitle, darkModeSwitchTitle } = uiControls[locale]
    return { sidebarMenuLabel, langMenuLabel, returnToTopLabel, skipToContentLabel,
        darkModeSwitchLabel, lightModeSwitchTitle, darkModeSwitchTitle }
}

function pageUi(relativePath: string = '') {
    const locale = relativePath.split('/')[0] as UiLocale
    return Object.hasOwn(uiControls, locale) ? uiControls[locale] : uiControls.en
}

export const localizeMarkdownUi: NonNullable<MarkdownOptions['config']> = (md) => {
    // VitePress가 만든 코드와 제목 링크를 유지하고 접근성 문구만 페이지 언어에 맞춥니다.
    const renderFence = md.renderer.rules.fence!
    md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
        const ui = pageUi(env.relativePath)
        const title = md.utils.escapeHtml(ui.codeCopyButtonTitle)
        return renderFence(tokens, index, options, env, renderer).replace(
            /<button title="[^"]*" class="copy">/,
            `<button title="${title}" class="copy">`
        ).replace(
            /(<template #fallback>\s*)Loading\.\.\.(\s*<\/template>)/,
            (_match, before, after) => `${before}${md.utils.escapeHtml(ui.mermaidLoadingText)}${after}`
        )
    }

    const renderLink = md.renderer.rules.link_open
        ?? ((tokens, index, options, _env, renderer) => renderer.renderToken(tokens, index, options))
    md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
        const token = tokens[index]
        const label = token.attrGet('aria-label')
        if (token.attrGet('class')?.split(/\s+/).includes('header-anchor')
            && label?.startsWith('Permalink to "') && label.endsWith('"')) {
            const title = label.slice('Permalink to "'.length, -1)
            token.attrSet('aria-label', pageUi(env.relativePath).headingPermalinkLabel
                .replace('{title}', () => title))
        }
        return renderLink(tokens, index, options, env, renderer)
    }
}
