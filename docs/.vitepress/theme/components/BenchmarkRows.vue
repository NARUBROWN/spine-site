<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'
import { common, nameFor, number, throughput } from '../benchmark/data'
import { annualVmSavingKrw, monthlyVmSavingKrw, vmCostRows } from '../benchmark/vm-cost'
import { vmCostCopy } from '../benchmark/vm-cost-copy'

const props = withDefaults(defineProps<{ metric?: 'throughput' | 'memory' | 'cost' }>(), { metric: 'cost' })
const { lang } = useData()
const copy = computed(() => benchmarkCopy(lang.value))
const costCopy = computed(() => vmCostCopy(copy.value.path))

interface ComparisonRow {
  case: string
  name: string
  amount: string
  unit: string
  width: number
  comparison?: string
  monthly?: string
  plan?: { vcpus: number; memoryMiB: number; annualUsd: number }
}

const rows = computed<ComparisonRow[]>(() => {
  if (props.metric === 'cost') {
    const comparisons = vmCostRows.filter(row => row.case !== 'spine')
    const maximum = Math.max(...comparisons.map(annualVmSavingKrw))
    return comparisons.map(row => ({
      case: row.case,
      name: costCopy.value.comparison.replace('{framework}', nameFor(row.case)),
      amount: `₩${number(annualVmSavingKrw(row))}`,
      unit: costCopy.value.annualSavingUnit,
      width: annualVmSavingKrw(row) / maximum * 100,
      monthly: costCopy.value.saving.replace('{value}', number(monthlyVmSavingKrw(row))),
      plan: row.selectedPlan
    }))
  }

  const isThroughput = props.metric === 'throughput'
  const measured = isThroughput ? throughput : common
  const value = (row: typeof measured[number]) => isThroughput ? row.rps : row.memory_current_median_mib
  const maximum = Math.max(...measured.map(value))
  const spine = measured[0]
  return measured.map(row => ({
    case: row.case,
    name: nameFor(row.case),
    amount: number(value(row), isThroughput ? 0 : 1),
    unit: isThroughput ? 'req/s' : 'MiB',
    width: value(row) / maximum * 100,
    comparison: row.case === 'spine' ? undefined : isThroughput
      ? copy.value.throughputCapacity.replace('{value}', number(spine.rps - row.rps))
      : copy.value.memoryRatio.replace('{value}', number((1 - spine.memory_current_median_mib / row.memory_current_median_mib) * 100, 1))
  }))
})

function memoryLabel(memory: number) {
  return memory < 1024 ? `${memory}MB` : `${memory / 1024}GB`
}
</script>

<template>
  <!-- 지표가 바뀌어도 같은 프레임워크의 행과 막대를 유지해 길이 전환을 이어갑니다. -->
  <TransitionGroup name="benchmark-row" tag="div" class="comparison-rows" :class="{ 'is-cost': metric === 'cost', 'vm-cost-rows': metric === 'cost' }" role="list">
    <div v-for="row in rows" :key="row.case" :data-case="row.case" class="comparison-row" :class="{ 'is-spine': row.case === 'spine', 'vm-cost-row': metric === 'cost' }" role="listitem">
      <div class="row-heading" :class="{ 'vm-cost-heading': metric === 'cost' }">
        <span class="row-name" :class="{ 'vm-cost-name': metric === 'cost' }">{{ row.name }}<span v-if="row.case === 'spine'" class="spine-version">0.5.2</span></span>
        <div class="row-value" :class="{ 'vm-cost-value': metric === 'cost' }">{{ row.amount }}<span class="row-unit">{{ row.unit }}</span></div>
      </div>
      <div v-show="row.monthly" class="vm-cost-saving">{{ row.monthly }}</div>
      <div class="bar-track" :class="{ 'vm-cost-track': metric === 'cost' }" aria-hidden="true"><div class="bar-fill" :style="{ width: `${row.width}%` }"></div></div>
      <div v-if="row.plan" class="vm-cost-plan">
        <span>{{ row.plan.vcpus }} vCPU / {{ memoryLabel(row.plan.memoryMiB) }}</span>
        <span>{{ costCopy.annual.replace('{value}', number(row.plan.annualUsd)) }}</span>
      </div>
      <p v-show="row.comparison" class="row-comparison">{{ row.comparison }}</p>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.comparison-rows { position: relative; display: grid; gap: 28px; min-width: 0; }
.comparison-row { min-width: 0; }
.row-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
.row-name { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; color: var(--vp-c-text-1); font-size: 16px; line-height: 1.6; }
.row-value { flex-shrink: 0; color: var(--vp-c-text-1); font-size: 18px; font-weight: 600; line-height: 1.5; white-space: nowrap; font-variant-numeric: tabular-nums; }
.row-unit { margin-left: 6px; color: var(--vp-c-text-2); font-size: 14px; font-weight: 450; }
.spine-version { color: var(--vp-c-text-2); font-size: 13px; font-weight: 450; }
.bar-track { height: 10px; overflow: hidden; background: var(--vp-c-bg-soft); border-radius: 2px; }
.bar-fill { height: 100%; background: var(--vp-c-text-3); transition: width .25s ease, background-color .25s ease; }
.is-spine .row-name, .is-spine .row-value { color: var(--vp-c-brand-1); font-weight: 650; }
.is-spine .bar-fill { background: var(--vp-c-brand-1); }
.comparison-row .row-comparison { margin: 8px 0 0; color: var(--vp-c-text-1); font-size: 14px; font-weight: 450; line-height: 1.8; text-align: right; }
.comparison-rows:lang(ko) .row-comparison { text-wrap: balance; }
.is-cost .row-heading { display: block; margin-bottom: 0; }
.is-cost .row-value { margin-top: 6px; color: var(--vp-c-brand-1); font-size: 30px; font-weight: 650; line-height: 1.35; }
.is-cost .row-unit { margin-left: 5px; font-size: 13px; }
.is-cost .bar-track { margin-top: 12px; }
.is-cost .bar-fill { background: var(--vp-c-brand-1); }
.vm-cost-plan { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 3px 16px; margin-top: 8px; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.6; }
.vm-cost-plan span { white-space: nowrap; }
.vm-cost-saving { margin-top: 4px; color: var(--vp-c-text-2); font-size: 13px; font-weight: 400; line-height: 1.7; }
.benchmark-row-move, .benchmark-row-enter-active, .benchmark-row-leave-active { transition: transform .25s ease, opacity .25s ease; }
.benchmark-row-enter-from, .benchmark-row-leave-to { opacity: 0; transform: translateY(8px); }
.benchmark-row-leave-active { position: absolute; width: 100%; transition-duration: .12s; }
@media (max-width: 640px) {
  .comparison-rows { gap: 22px; }
  .row-name { font-size: 14px; gap: 6px; }
  .row-value { font-size: 16px; }
  .row-unit { font-size: 13px; }
  .comparison-row .row-comparison { font-size: 13px; line-height: 1.65; }
  .is-cost .row-value { font-size: 26px; }
}
@media (prefers-reduced-motion: reduce) {
  .bar-fill, .benchmark-row-move, .benchmark-row-enter-active, .benchmark-row-leave-active { transition: none; }
  .benchmark-row-enter-from, .benchmark-row-leave-to { opacity: 1; transform: none; }
}
@media (forced-colors: active) { /* taste-skill-ignore */
  .bar-track { outline: 1px solid CanvasText; }
  .bar-fill, .is-spine .bar-fill, .is-cost .bar-fill { background: Highlight; forced-color-adjust: none; }
}
</style>
