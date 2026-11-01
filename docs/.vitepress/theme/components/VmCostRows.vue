<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'
import { nameFor, number } from '../benchmark/data'
import { monthlyVmCostKrw, monthlyVmSavingKrw, vmCostRows } from '../benchmark/vm-cost'
import { vmCostCopy } from '../benchmark/vm-cost-copy'

const { lang } = useData()
const copy = computed(() => vmCostCopy(benchmarkCopy(lang.value).path))
const maximum = Math.max(...vmCostRows.map(monthlyVmCostKrw))

function memoryLabel(memory: number) {
  return memory < 1024 ? `${memory}MB` : `${memory / 1024}GB`
}
</script>

<template>
  <div class="vm-cost-rows" role="list">
    <div v-for="row in vmCostRows" :key="row.case" class="vm-cost-row" :class="{ 'is-spine': row.case === 'spine' }" role="listitem">
      <div class="vm-cost-heading">
        <span class="vm-cost-name">{{ nameFor(row.case) }}</span>
        <span class="vm-cost-value">₩{{ number(monthlyVmCostKrw(row)) }}<span>/ {{ copy.monthly }}</span></span>
      </div>
      <div class="vm-cost-track" aria-hidden="true"><div :style="{ width: `${monthlyVmCostKrw(row) / maximum * 100}%` }"></div></div>
      <div v-if="row.case !== 'spine'" class="vm-cost-plan">
        <span>{{ row.selectedPlan.vcpus }} vCPU / {{ memoryLabel(row.selectedPlan.memoryMiB) }}</span>
        <span>{{ copy.annual.replace('{value}', number(row.selectedPlan.annualUsd)) }}</span>
      </div>
      <p v-if="row.case !== 'spine'" class="vm-cost-saving">{{ copy.saving.replace('{value}', number(monthlyVmSavingKrw(row))) }}</p>
    </div>
  </div>
</template>

<style scoped>
.vm-cost-rows { display: grid; gap: 28px; min-width: 0; }
.vm-cost-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.vm-cost-name { min-width: 0; color: var(--vp-c-text-1); font-size: 16px; line-height: 1.6; }
.vm-cost-value { flex-shrink: 0; color: var(--vp-c-text-1); font-size: 20px; font-weight: 600; line-height: 1.5; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vm-cost-value span { margin-left: 5px; color: var(--vp-c-text-2); font-size: 13px; font-weight: 450; }
.vm-cost-track { height: 10px; overflow: hidden; background: var(--vp-c-bg-soft); border-radius: 2px; }
.vm-cost-track div { height: 100%; background: var(--vp-c-text-3); }
.is-spine .vm-cost-name, .is-spine .vm-cost-value { color: var(--vp-c-brand-1); font-weight: 650; }
.is-spine .vm-cost-track div { background: var(--vp-c-brand-1); }
.vm-cost-plan { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 3px 16px; margin-top: 8px; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.6; }
.vm-cost-plan span { white-space: nowrap; }
.vm-cost-row .vm-cost-saving { margin: 7px 0 0; color: var(--vp-c-brand-1); font-size: 14px; font-weight: 550; line-height: 1.75; text-align: right; text-wrap: balance; }
@media (max-width: 640px) {
  .vm-cost-rows { gap: 22px; }
  .vm-cost-name { font-size: 14px; }
  .vm-cost-value { font-size: 18px; }
  .vm-cost-row .vm-cost-saving { font-size: 13px; }
}
@media (forced-colors: active) { /* taste-skill-ignore */
  .vm-cost-track { outline: 1px solid CanvasText; }
  .vm-cost-track div, .is-spine .vm-cost-track div { background: Highlight; forced-color-adjust: none; }
}
</style>
