<template>
    <div>
        <div v-if="svg" v-html="svg"></div>
        <pre v-else-if="failed"><code>{{ source }}</code></pre>
        <div ref="workspace" class="mermaid-workspace" aria-hidden="true"></div>
    </div>
</template>

<script lang="ts">
let renderQueue = Promise.resolve()
</script>

<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{ graph: string; id: string }>()
const { frontmatter, isDark } = useData()
const source = computed(() => decodeURIComponent(props.graph))
const theme = computed(() => isDark.value ? 'dark' : frontmatter.value.mermaidTheme)
const id = `${props.id}-${useId()}`
let renderCount = 0
const workspace = ref<HTMLElement>()
const svg = ref('')
const failed = ref(false)

onMounted(() => {
    watch([source, theme], ([graph, diagramTheme], _, onCleanup) => {
        let current = true
        onCleanup(() => { current = false })

        // Mermaid shares its configuration across render calls.
        renderQueue = renderQueue.then(async () => {
            const container = workspace.value
            if (!current || !container) return

            try {
                const { default: mermaid } = await import('mermaid')
                if (!current) return
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'loose',
                    suppressErrorRendering: true,
                    theme: diagramTheme || 'default'
                })
                const result = await mermaid.render(`${id}-${++renderCount}`, graph, container)
                if (current) {
                    svg.value = result.svg
                    failed.value = false
                }
            } catch (error) {
                if (current) {
                    failed.value = true
                    console.error('Mermaid rendering failed', error)
                }
            } finally {
                container.replaceChildren()
            }
        })
    }, { immediate: true })
})
</script>

<style scoped>
.mermaid-workspace {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
}
</style>
