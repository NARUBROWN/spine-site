<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'
import { assetRoot, common, high, nameFor, number, snapshot, throughput } from '../benchmark/data'

const { lang } = useData()
const copy = computed(() => benchmarkCopy(lang.value))
const sourceLinks = [
  ['Web Frameworks Benchmark', 'https://github.com/the-benchmarker/web-frameworks#readme'],
  ['Go garbage collector', 'https://go.dev/doc/gc-guide#GOGC'],
  ['NestJS', 'https://docs.nestjs.com/techniques/performance#choosing-an-adapter'],
  ['npm: Express', 'https://api.npmjs.org/downloads/point/2026-10-01:2026-10-30/@nestjs%2Fplatform-express'],
  ['npm: Fastify', 'https://api.npmjs.org/downloads/point/2026-10-01:2026-10-30/@nestjs%2Fplatform-fastify'],
  ['State of Spring 2024 (PDF)', 'https://www.vmware.com/docs/vmw-the-state-of-spring'],
  ['FastAPI / Uvicorn', 'https://fastapi.tiangolo.com/deployment/manually/#asgi-servers'],
  ['Uvicorn', 'https://uvicorn.dev/settings/'],
  ['CPU reference clock', 'https://browser.geekbench.com/mac-benchmarks']
]
</script>

<template>
  <div class="benchmark-report">
    <p class="report-date">{{ snapshot.measuredAt }} · Spine {{ snapshot.spineVersion }} · GOGC=400</p>
    <p class="report-lead">{{ copy.reportIntro }}</p>
    <div class="report-downloads">
      <a :href="withBase(`${assetRoot}/evidence.zip`)" download>{{ copy.evidenceLink }} ↓</a>
      <a :href="withBase(`${assetRoot}/measurements.csv`)" download>{{ copy.csv }} ↓</a>
      <a :href="withBase(`${assetRoot}/summary.json`)" download>{{ copy.jsonLink }} ↓</a>
      <a :href="withBase(`${assetRoot}/checksums.json`)" download>{{ copy.checksumLink }} ↓</a>
    </div>
    <h2>{{ copy.findingsTitle }}</h2>
    <p>{{ copy.findings }}</p>
    <h3>{{ copy.throughputTable }}</h3>
    <table>
      <thead><tr><th>{{ copy.framework }}</th><th>{{ copy.rps }}</th><th>{{ copy.p95 }}</th><th>{{ copy.p99 }}</th></tr></thead>
      <tbody><tr v-for="row in throughput" :key="row.case" :class="{ 'spine-result': row.case === 'spine' }">
        <td>{{ nameFor(row.case) }}</td><td>{{ number(row.rps) }}<small>{{ copy.range }}: {{ number(row.rps_min) }}–{{ number(row.rps_max) }}</small></td><td>{{ number(row.p95_ms, 3) }}</td><td>{{ number(row.p99_ms, 3) }}</td>
      </tr></tbody>
    </table>
    <h3>{{ copy.commonTable }}</h3>
    <table>
      <thead><tr><th>{{ copy.framework }}</th><th>{{ copy.mean }}</th><th>{{ copy.p95 }}</th><th>{{ copy.p99 }}</th><th>{{ copy.memoryColumn }}</th></tr></thead>
      <tbody><tr v-for="row in common" :key="row.case" :class="{ 'spine-result': row.case === 'spine' }">
        <td>{{ nameFor(row.case) }}</td><td>{{ number(row.mean_ms, 3) }}</td><td>{{ number(row.p95_ms, 3) }}</td><td>{{ number(row.p99_ms, 3) }}<small>{{ copy.range }}: {{ number(row.p99_ms_min, 3) }}–{{ number(row.p99_ms_max, 3) }}</small></td><td>{{ number(row.memory_current_median_mib, 1) }}</td>
      </tr></tbody>
    </table>
    <p>{{ copy.latencyNote }}</p>
    <h3>{{ copy.highTable }}</h3>
    <table>
      <thead><tr><th>{{ copy.framework }}</th><th>{{ copy.rps }}</th><th>{{ copy.p95 }}</th><th>{{ copy.p99 }}</th></tr></thead>
      <tbody><tr v-for="row in high" :key="row.case"><td>{{ nameFor(row.case) }}</td><td>{{ number(row.rps) }}</td><td>{{ number(row.p95_ms, 3) }}</td><td>{{ number(row.p99_ms, 3) }}</td></tr></tbody>
    </table>
    <p>{{ copy.highNote }}</p>
    <h2>{{ copy.methodTitle }}</h2>
    <table><tbody><tr v-for="item in copy.specifications" :key="item[0]"><th scope="row">{{ item[0] }}</th><td>{{ item[1] }}</td></tr></tbody></table>
    <h3>{{ copy.runtimeTitle }}</h3>
    <table><tbody><tr v-for="(version, id) in snapshot.versions" :key="id"><th scope="row">{{ nameFor(id) }}</th><td>{{ version }}</td></tr></tbody></table>
    <h2>{{ copy.selectionTitle }}</h2>
    <template v-for="item in copy.selection" :key="item[0]"><h3>{{ item[0] }}</h3><p>{{ item[1] }}</p></template>
    <h2>{{ copy.scopeTitle }}</h2>
    <ul><li v-for="item in copy.scope" :key="item">{{ item }}</li></ul>
    <h2>{{ copy.evidenceTitle }}</h2>
    <p>{{ copy.evidence }}</p>
    <h3>{{ copy.sourcesTitle }}</h3>
    <ul class="report-sources"><li v-for="link in sourceLinks" :key="link[1]"><a :href="link[1]" target="_blank" rel="noopener noreferrer">{{ link[0] }}</a></li></ul>
    <a :href="withBase(`/${copy.path}/#benchmarks`)">← {{ copy.back }}</a>
  </div>
</template>

<style scoped>
.report-date { color: var(--vp-c-text-3); font-size: 13px; }
:global(.dark .benchmark-report) { --vp-c-brand-1: #a8b1ff; }
.report-lead { font-size: 19px; line-height: 1.9; color: var(--vp-c-text-2); }
.report-downloads { display: flex; flex-wrap: wrap; gap: 10px 20px; padding: 18px 0; border-bottom: 1px solid var(--vp-c-divider); }
.report-downloads a { font-size: 13px; }
.benchmark-report table { width: 100%; font-variant-numeric: tabular-nums; }
.benchmark-report td, .benchmark-report th { vertical-align: top; }
.benchmark-report small { display: block; min-width: 150px; font-size: 10px; color: var(--vp-c-text-3); font-weight: 400; }
.spine-result td { color: var(--vp-c-brand-1); font-weight: 650; }
.report-sources { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; list-style: none; padding: 0; }
.report-sources li { min-width: 0; }
.report-sources li + li { margin-top: 0; }
.report-sources a { display: block; overflow-wrap: anywhere; }
.benchmark-report { word-break: normal; overflow-wrap: anywhere; }
@media (max-width: 640px) {
  .report-sources { grid-template-columns: minmax(0, 1fr); }
}
</style>
