import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import FrameworkTabs from '../components/FrameworkTabs.vue'
import './custom.css'

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('FrameworkTabs', FrameworkTabs)
    }
} satisfies Theme
