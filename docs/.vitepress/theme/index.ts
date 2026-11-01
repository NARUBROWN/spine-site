import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import FrameworkTabs from '../components/FrameworkTabs.vue'
import TerminalBoot from './components/TerminalBoot.vue'
import Footer from './components/Footer.vue'
import BenchmarkSection from './components/BenchmarkSection.vue'
import BenchmarkReport from './components/BenchmarkReport.vue'
import SpineWorkbench from './components/SpineWorkbench.vue'
import EnterpriseSupport from './components/EnterpriseSupport.vue'
import EnterpriseSupportBanner from './components/EnterpriseSupportBanner.vue'
import './custom.css'

export default {
    extends: DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            'home-hero-image': () => h(SpineWorkbench),
            'home-hero-actions-after': () => h(EnterpriseSupportBanner),
            'layout-bottom': () => h(Footer)
        })
    },
    enhanceApp({ app }) {
        app.component('FrameworkTabs', FrameworkTabs)
        app.component('TerminalBoot', TerminalBoot)
        app.component('BenchmarkSection', BenchmarkSection)
        app.component('BenchmarkReport', BenchmarkReport)
        app.component('EnterpriseSupport', EnterpriseSupport)
    }
} satisfies Theme
