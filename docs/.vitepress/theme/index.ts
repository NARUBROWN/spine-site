import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import FrameworkTabs from '../components/FrameworkTabs.vue'
import HeroBackground from './components/HeroBackground.vue'
import TerminalBoot from './components/TerminalBoot.vue'
import './custom.css'

export default {
    extends: DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            'home-hero-before': () => h(HeroBackground)
        })
    },
    enhanceApp({ app }) {
        app.component('FrameworkTabs', FrameworkTabs)
        app.component('TerminalBoot', TerminalBoot)
    }
} satisfies Theme
