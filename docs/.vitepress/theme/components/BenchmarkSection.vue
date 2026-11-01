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
  if (mode.value === 'throughput') return copy.value.throughputRatio.replace('{value}', number(spine.value.rps / row.rps, 2))
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
      <div>
        <p class="benchmark-eyebrow">{{ copy.badge }}<span class="benchmark-date">2026.11.01</span></p>
        <h2 id="benchmark-heading" class="benchmark-heading">{{ copy.title[0] }}<br><span>{{ copy.title[1] }}</span></h2>
        <p class="benchmark-intro">{{ copy.intro }}</p>
      </div>
      <a class="benchmark-report-link" :href="withBase(`/${copy.path}/benchmarks/`)">{{ copy.cta }}<span aria-hidden="true">↗</span></a>
    </div>
    <div class="benchmark-stats">
      <div class="benchmark-stat">
        <p class="stat-label">{{ copy.throughputStat }}</p>
        <p class="stat-number">{{ number(throughput[0].rps) }}<span>req/s</span></p>
        <p class="stat-context">{{ copy.throughputContext }}</p>
      </div>
      <div class="benchmark-stat">
        <p class="stat-label">{{ copy.memoryStat }}</p>
        <p class="stat-number">{{ number(common[0].memory_current_median_mib, 1) }}<span>MiB</span></p>
        <p class="stat-context">{{ copy.memoryContext }}</p>
      </div>
      <div class="benchmark-stat">
        <p class="stat-label">{{ copy.latencyStat }}</p>
        <p class="stat-number">{{ number(common[0].p99_ms, 3) }}<span>ms</span></p>
        <p class="stat-context">{{ copy.latencyContext }}</p>
      </div>
    </div>
    <div class="benchmark-comparison">
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
      <div id="benchmark-comparison-panel" role="tabpanel" :aria-labelledby="`benchmark-tab-${mode}`" tabindex="0">
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
        <p class="chart-condition">{{ mode === 'throughput' ? copy.throughputCondition : copy.memoryCondition }}</p>
      </div>
    </div>
    <div class="benchmark-bottom">
      <p class="benchmark-method">{{ copy.method }}</p>
      <a class="benchmark-csv" :href="withBase(`${assetRoot}/measurements.csv`)" download>{{ copy.csv }}<span aria-hidden="true">↓</span></a>
    </div>
  </section>
</template>

<style scoped>
.benchmark-section { position: relative; margin: 64px 0 88px; padding: 36px; border: 1px solid var(--vp-c-divider); border-radius: 24px; background: var(--vp-c-bg-soft); scroll-margin-top: 90px; }
:global(.dark .benchmark-section) { --vp-c-brand-1: #a8b1ff; }
.benchmark-heading-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
.benchmark-heading-row > div { min-width: 0; max-width: 100%; }
.benchmark-section p { margin: 0; }
.benchmark-eyebrow { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px; font-weight: 650; color: var(--vp-c-brand-1); letter-spacing: .02em; }
.benchmark-date { margin-left: 4px; padding-left: 12px; border-left: 1px solid var(--vp-c-divider); color: var(--vp-c-text-3); font-weight: 450; }
.benchmark-section .benchmark-heading { margin: 18px 0 14px; padding: 0; border: 0; font-size: clamp(25px, 3vw, 36px); line-height: 1.45; font-weight: 750; letter-spacing: -.045em; word-break: keep-all; }
.benchmark-heading span { color: var(--vp-c-brand-1); }
.benchmark-intro { max-width: 600px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.8; word-break: keep-all; }
.benchmark-section:lang(ja) .benchmark-heading, .benchmark-section:lang(zh) .benchmark-heading,
.benchmark-section:lang(ja) .benchmark-intro, .benchmark-section:lang(zh) .benchmark-intro { word-break: normal; line-break: strict; }
.benchmark-report-link { display: inline-flex; flex-shrink: 0; align-items: center; gap: 10px; padding: 10px 0; color: var(--vp-c-brand-1); font-size: 13px; font-weight: 650; text-decoration: none; }
.benchmark-report-link:hover { color: var(--vp-c-brand-2); }
.benchmark-report-link span { font-size: 20px; }
.benchmark-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 28px; }
.benchmark-stat { padding: 20px 22px; border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg); }
.stat-label { color: var(--vp-c-text-2); font-size: 13px; font-weight: 550; }
.benchmark-stat .stat-number { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--vp-c-text-1); font-size: clamp(25px, 3vw, 38px); font-weight: 750; letter-spacing: -.055em; line-height: 1.3; font-variant-numeric: tabular-nums; }
.stat-number span { font-size: 13px; letter-spacing: 0; font-weight: 500; color: var(--vp-c-text-3); }
.benchmark-stat .stat-context { margin-top: 8px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.6; }
.benchmark-comparison { margin-top: 24px; padding: 26px; border: 1px solid var(--vp-c-divider); border-radius: 16px; background: var(--vp-c-bg); }
.comparison-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.benchmark-section .comparison-title { margin: 0; font-size: 15px; line-height: 1.6; letter-spacing: -.02em; font-weight: 650; }
.comparison-direction { color: var(--vp-c-text-2); font-size: 12px; line-height: 1.8; }
.metric-tabs { display: flex; padding: 4px; border: 1px solid var(--vp-c-divider); border-radius: 9px; background: var(--vp-c-bg-soft); flex-shrink: 0; }
.metric-tabs button { padding: 5px 14px; border-radius: 6px; color: var(--vp-c-text-2); font-size: 12px; font-weight: 550; line-height: 1.7; transition: color .15s, background .15s; white-space: nowrap; }
.metric-tabs button[aria-selected="true"] { background: var(--vp-c-brand-3); color: var(--vp-c-white); }
.comparison-rows { display: grid; gap: 17px; }
.row-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 7px; }
.row-name { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.5; }
.row-value { flex-shrink: 0; font-size: 15px; line-height: 1.5; font-weight: 600; font-variant-numeric: tabular-nums; }
.row-unit { margin-left: 6px; color: var(--vp-c-text-3); font-size: 11px; font-weight: 450; }
.spine-version { padding: 1px 6px; color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); border-radius: 4px; font-size: 10px; font-weight: 500; }
.bar-track { height: 8px; border-radius: 3px; background: var(--vp-c-bg-soft); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 3px; background: var(--vp-c-text-3); opacity: .55; transition: width .25s ease; }
.is-spine .row-name, .is-spine .row-value { color: var(--vp-c-brand-1); font-weight: 700; }
.is-spine .bar-fill { opacity: 1; background: var(--vp-c-brand-1); }
.comparison-row .row-comparison { margin-top: 4px; color: var(--vp-c-brand-1); font-size: 12px; font-weight: 550; text-align: right; line-height: 1.6; }
.benchmark-section .chart-condition { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); font-size: 12px; line-height: 1.8; }
.benchmark-bottom { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-top: 18px; }
.benchmark-method { max-width: 740px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.8; }
.benchmark-csv { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; color: var(--vp-c-text-2); font-size: 11px; text-decoration: none; white-space: nowrap; }
.benchmark-csv:hover { color: var(--vp-c-brand-1); }
.benchmark-section a:focus-visible, .benchmark-section button:focus-visible, [role="tabpanel"]:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; }
@media (max-width: 1000px) { .benchmark-heading-row { flex-direction: column; align-items: flex-start; gap: 10px; } .benchmark-report-link { padding: 0; } .benchmark-stat { padding: 16px; } }
@media (max-width: 640px) { .benchmark-section { margin: 40px 0 56px; padding: 22px 18px; border-radius: 18px; } .benchmark-stats { gap: 0; grid-template-columns: 1fr; border: 1px solid var(--vp-c-divider); border-radius: 12px; overflow: hidden; background: var(--vp-c-bg); } .benchmark-stat { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0 12px; padding: 16px; border: 0; border-radius: 0; } .benchmark-stat + .benchmark-stat { border-top: 1px solid var(--vp-c-divider); } .benchmark-stat .stat-number { grid-column: 2; grid-row: 1 / 3; margin: 0; gap: 5px; font-size: 25px; } .benchmark-stat .stat-context { margin-top: 2px; font-size: 10px; } .stat-label { font-size: 12px; } .stat-number span { font-size: 11px; } .benchmark-comparison { padding: 18px 16px; margin-top: 16px; } .comparison-header { flex-direction: column; align-items: flex-start; gap: 12px; margin-bottom: 20px; } .metric-tabs { width: 100%; } .metric-tabs button { flex: 1; } .row-name { font-size: 11px; gap: 4px; } .row-value { font-size: 13px; } .row-unit { font-size: 10px; margin-left: 3px; } .benchmark-bottom { flex-direction: column; gap: 12px; } }
@media (prefers-reduced-motion: reduce) { .bar-fill, .metric-tabs button { transition: none; } }
@media (forced-colors: active) { .bar-fill, .is-spine .bar-fill { background: Highlight; opacity: 1; forced-color-adjust: none; } .bar-track { border: 1px solid CanvasText; } .metric-tabs button[aria-selected="true"] { outline: 2px solid Highlight; } }
</style>
