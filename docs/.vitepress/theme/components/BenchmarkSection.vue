<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'
import { assetRoot, common, nameFor, number, throughput, type Result } from '../benchmark/data'

const { lang } = useData()
const copy = computed(() => benchmarkCopy(lang.value))
const mode = ref<'throughput' | 'memory'>('throughput')
const rows = computed(() => mode.value === 'throughput' ? throughput : common)
const maximum = computed(() => Math.max(...rows.value.map(value)))
const spine = computed(() => rows.value[0])

function value(row: Result) {
  return mode.value === 'throughput' ? row.rps : row.memory_current_median_mib
}

function comparison(row: Result) {
  if (mode.value === 'throughput') return copy.value.throughputCapacity.replace('{value}', number(spine.value.rps - row.rps))
  return copy.value.memoryRatio.replace('{value}', number((1 - spine.value.memory_current_median_mib / row.memory_current_median_mib) * 100, 1))
}

function selectWithKeyboard(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  mode.value = event.key === 'Home' ? 'throughput' : event.key === 'End' ? 'memory' : mode.value === 'throughput' ? 'memory' : 'throughput'
  const container = (event.currentTarget as HTMLElement).parentElement
  container?.querySelector<HTMLButtonElement>(`#benchmark-tab-${mode.value}`)?.focus()
}
</script>

<template>
  <section id="benchmarks" class="benchmark-section" aria-labelledby="benchmark-heading">
    <div class="benchmark-heading-row">
      <h2 id="benchmark-heading" class="benchmark-heading">{{ copy.title[0] }}<br>{{ copy.title[1] }}</h2>
      <div class="benchmark-summary">
        <p class="benchmark-intro">{{ copy.intro }}</p>
        <p class="benchmark-provenance">{{ copy.badge }} / 2026.11.01</p>
        <a class="benchmark-report-link" :href="withBase(`/${copy.path}/benchmarks/`)">{{ copy.cta }}<span aria-hidden="true">↗</span></a>
      </div>
    </div>
    <div class="benchmark-stats">
      <div class="benchmark-stat">
        <p class="stat-number">{{ number(throughput[0].rps) }}<span>req/s</span></p>
        <p class="stat-label">{{ copy.throughputStat }}</p>
        <p class="stat-context">{{ copy.throughputContext }}</p>
      </div>
      <div class="benchmark-stat">
        <p class="stat-number">{{ number(common[0].memory_current_median_mib, 1) }}<span>MiB</span></p>
        <p class="stat-label">{{ copy.memoryStat }}</p>
        <p class="stat-context">{{ copy.memoryContext }}</p>
      </div>
      <div class="benchmark-stat">
        <p class="stat-number">{{ number(common[0].p99_ms, 3) }}<span>ms</span></p>
        <p class="stat-label">{{ copy.latencyStat }}</p>
        <p class="stat-context">{{ copy.latencyContext }}</p>
      </div>
    </div>
    <div class="benchmark-comparison" data-ui>
      <div class="comparison-header">
        <div>
          <h3 class="comparison-title">{{ mode === 'throughput' ? copy.throughputTitle : copy.memoryTitle }}</h3>
          <p class="comparison-direction">{{ mode === 'throughput' ? copy.throughputDirection : copy.memoryDirection }}</p>
        </div>
        <div class="metric-tabs" role="tablist" :aria-label="copy.chartLabel">
          <button v-for="metric in (['throughput', 'memory'] as const)" :id="`benchmark-tab-${metric}`" :key="metric"
            type="button" role="tab" :aria-selected="mode === metric" aria-controls="benchmark-comparison-panel"
            :tabindex="mode === metric ? 0 : -1" @click="mode = metric" @keydown="selectWithKeyboard">
            {{ metric === 'throughput' ? copy.throughput : copy.memory }}
          </button>
        </div>
      </div>
      <div id="benchmark-comparison-panel" :aria-describedby="mode === 'throughput' ? 'benchmark-condition benchmark-capacity-note' : 'benchmark-condition'" role="tabpanel" :aria-labelledby="`benchmark-tab-${mode}`" tabindex="0">
        <p v-if="mode === 'throughput'" class="capacity-assumption">{{ copy.capacityAssumption }}</p>
        <div class="comparison-rows">
          <div v-for="row in rows" :key="row.case" class="comparison-row" :class="{ 'is-spine': row.case === 'spine' }">
            <div class="row-heading">
              <span class="row-name">{{ nameFor(row.case) }}<span v-if="row.case === 'spine'" class="spine-version">0.5.2</span></span>
              <span class="row-value">{{ number(value(row), mode === 'throughput' ? 0 : 1) }}<span class="row-unit">{{ mode === 'throughput' ? 'req/s' : 'MiB' }}</span></span>
            </div>
            <div class="bar-track" aria-hidden="true"><div class="bar-fill" :style="{ width: `${value(row) / maximum * 100}%` }"></div></div>
            <p v-if="row.case !== 'spine'" class="row-comparison">{{ comparison(row) }}</p>
          </div>
        </div>
      </div>
      <div class="comparison-notes">
        <p id="benchmark-condition" class="chart-condition">{{ mode === 'throughput' ? copy.throughputCondition : copy.memoryCondition }}</p>
        <p v-if="mode === 'throughput'" id="benchmark-capacity-note" class="capacity-note">{{ copy.capacityNote }}</p>
      </div>
    </div>
    <a class="benchmark-csv" :href="withBase(`${assetRoot}/measurements.csv`)" download>{{ copy.csv }}<span aria-hidden="true">↓</span></a>
  </section>
</template>

<style scoped>
.benchmark-section { margin: 112px 0; padding: 0; scroll-margin-top: 96px; }
.benchmark-section:lang(ko) { word-break: keep-all; overflow-wrap: break-word; }
.benchmark-section:lang(ko) .row-comparison { text-wrap: balance; }
:global(.dark .benchmark-section) { --vp-c-brand-1: #a8b1ff; }
.benchmark-section p { margin: 0; }
.benchmark-heading-row { display: grid; grid-template-columns: 1.1fr 1fr; align-items: start; gap: 64px; }
.benchmark-section .benchmark-heading { margin: 0; padding: 0; border: 0; color: var(--vp-c-text-1); font-size: clamp(30px, 3.6vw, 48px); line-height: 1.25; font-weight: 650; letter-spacing: -.045em; word-break: keep-all; }
.benchmark-summary { padding-top: 4px; }
.benchmark-intro { color: var(--vp-c-text-1); font-size: 16px; line-height: 1.85; max-width: 48ch; word-break: keep-all; }
.benchmark-section:lang(ja) .benchmark-heading, .benchmark-section:lang(zh) .benchmark-heading,
.benchmark-section:lang(ja) .benchmark-intro, .benchmark-section:lang(zh) .benchmark-intro { word-break: normal; line-break: strict; }
.benchmark-section .benchmark-provenance { margin-top: 16px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.7; }
.benchmark-report-link { display: inline-flex; align-items: center; gap: 12px; margin-top: 20px; min-height: 44px; color: var(--vp-c-brand-1); font-size: 16px; font-weight: 600; text-decoration: none; }
.benchmark-report-link:hover { color: var(--vp-c-brand-2); }
.benchmark-report-link span { transition: transform .2s ease; }
.benchmark-report-link:hover span { transform: translate(2px, -2px); }
.benchmark-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px; margin: 56px 0 64px; }
.benchmark-stat { min-width: 0; }
.benchmark-stat .stat-number { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; color: var(--vp-c-text-1); font-size: clamp(36px, 4.6vw, 64px); font-weight: 650; letter-spacing: -.06em; line-height: 1.15; font-variant-numeric: tabular-nums; }
.stat-number span { color: var(--vp-c-text-2); font-size: 16px; letter-spacing: 0; font-weight: 450; }
.benchmark-stat .stat-label { margin-top: 16px; color: var(--vp-c-text-1); font-size: 16px; font-weight: 600; }
.benchmark-stat .stat-context { margin-top: 5px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.7; }
.benchmark-comparison { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); grid-template-areas: 'header chart' 'notes chart'; gap: 24px 72px; }
.comparison-header { grid-area: header; display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
.benchmark-section .comparison-title { margin: 0; color: var(--vp-c-text-1); font-size: 24px; line-height: 1.45; letter-spacing: -.03em; font-weight: 600; }
.benchmark-section .comparison-direction { margin-top: 8px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.7; }
.metric-tabs { display: flex; gap: 6px; padding: 4px; background: var(--vp-c-bg-soft); border-radius: 4px; }
.metric-tabs button { min-height: 44px; padding: 8px 22px; border-radius: 2px; color: var(--vp-c-text-1); font-size: 14px; font-weight: 550; line-height: 1.6; white-space: nowrap; transition: color .18s, background .18s; }
.metric-tabs button:hover { background: var(--vp-c-default-soft); }
.metric-tabs button[aria-selected='true'] { background: var(--vp-c-brand-3); color: var(--vp-c-white); }
#benchmark-comparison-panel { grid-area: chart; min-width: 0; }
.comparison-rows { display: grid; gap: 28px; }
.benchmark-section .capacity-assumption { margin-bottom: 24px; color: var(--vp-c-text-1); font-size: 14px; font-weight: 550; line-height: 1.8; }
.row-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
.row-name { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; color: var(--vp-c-text-1); font-size: 16px; line-height: 1.6; }
.row-value { flex-shrink: 0; color: var(--vp-c-text-1); font-size: 18px; font-weight: 600; line-height: 1.5; font-variant-numeric: tabular-nums; }
.row-unit { margin-left: 6px; color: var(--vp-c-text-2); font-size: 14px; font-weight: 450; }
.spine-version { color: var(--vp-c-text-2); font-size: 13px; font-weight: 450; }
.bar-track { height: 10px; overflow: hidden; background: var(--vp-c-bg-soft); border-radius: 2px; }
.bar-fill { height: 100%; background: var(--vp-c-text-3); transition: width .25s ease; }
.is-spine .row-name, .is-spine .row-value { color: var(--vp-c-brand-1); font-weight: 650; }
.is-spine .bar-fill { background: var(--vp-c-brand-1); }
.comparison-row .row-comparison { margin-top: 8px; color: var(--vp-c-text-1); font-size: 14px; font-weight: 450; line-height: 1.8; text-align: right; }
.comparison-notes { grid-area: notes; align-self: start; }
.benchmark-section .chart-condition, .benchmark-section .capacity-note { max-width: 48ch; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.85; }
.benchmark-section .capacity-note { margin-top: 16px; }
.benchmark-csv { display: inline-flex; align-items: center; gap: 10px; margin-top: 28px; min-height: 44px; color: var(--vp-c-brand-1); font-size: 14px; text-decoration: none; }
.benchmark-section a:focus-visible, .benchmark-section button:focus-visible, [role='tabpanel']:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 5px; }
@media (max-width: 900px) {
  .benchmark-heading-row { gap: 32px; }
  .benchmark-comparison { gap: 24px 40px; }
  .benchmark-stats { gap: 24px; }
  .stat-number span { font-size: 14px; }
}
@media (max-width: 640px) {
  .benchmark-section { margin: 80px 0; }
  .benchmark-heading-row { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .benchmark-report-link { margin-top: 12px; }
  .benchmark-stats { grid-template-columns: minmax(0, 1fr); gap: 28px; margin: 36px 0 48px; }
  .benchmark-stat { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 16px; align-items: baseline; }
  .benchmark-stat .stat-number { grid-column: 2; grid-row: 1; font-size: 36px; }
  .benchmark-stat .stat-label { grid-column: 1; grid-row: 1; margin: 0; }
  .benchmark-stat .stat-context { grid-column: 1 / -1; margin-top: 0; }
  .benchmark-comparison { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'header' 'chart' 'notes'; gap: 28px; }
  .comparison-header { gap: 20px; }
  .benchmark-section .comparison-title { font-size: 20px; }
  .metric-tabs { width: 100%; }
  .metric-tabs button { flex: 1; }
  .row-name { font-size: 14px; gap: 6px; }
  .row-value { font-size: 16px; }
  .row-unit { font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) { .bar-fill, .metric-tabs button, .benchmark-report-link span { transition: none; } }
/* 고대비 모드에서는 그래프 경계를 선으로 표시합니다. taste-skill-ignore */
@media (forced-colors: active) { /* taste-skill-ignore */ .bar-fill, .is-spine .bar-fill { background: Highlight; forced-color-adjust: none; } .bar-track { border: 1px solid CanvasText; } .metric-tabs button[aria-selected='true'] { outline: 2px solid Highlight; } }
</style>
