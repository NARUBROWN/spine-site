<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'
import { vmCostAsset, vmCostReference, vmCostText } from '../benchmark/vm-cost'
import { vmCostCopy } from '../benchmark/vm-cost-copy'

defineProps<{ context: 'home' | 'report' }>()
const { lang } = useData()
const copy = computed(() => vmCostCopy(benchmarkCopy(lang.value).path))
</script>

<template>
  <div class="vm-cost-notes">
    <p>{{ copy.condition }}</p>
    <p :id="`vm-cost-note-${context}`">{{ copy.note }}</p>
    <details class="vm-cost-details">
      <summary>{{ copy.details }}</summary>
      <div class="vm-cost-method-body">
        <h4>{{ copy.basis }}</h4>
        <p>{{ copy.cpu }}</p>
        <p>{{ copy.memory }}</p>
        <p>{{ copy.selection }}</p>
        <p>{{ copy.policy }}</p>
        <p>{{ copy.traffic }}</p>
        <p>{{ copy.sensitivity }}</p>
        <p>{{ vmCostText(copy.exchange) }}</p>
        <p class="vm-cost-formula">{{ copy.formula }}</p>
        <div class="vm-cost-sources">
          <a :href="vmCostReference.sources.plans" target="_blank" rel="noopener noreferrer">vpsGOD {{ copy.plans }}</a>
          <a :href="vmCostReference.sources.offers" target="_blank" rel="noopener noreferrer">vpsGOD {{ copy.offers }}</a>
          <a :href="vmCostReference.fx.source" target="_blank" rel="noopener noreferrer">{{ copy.fx }}</a>
          <a :href="withBase(vmCostAsset)" download>{{ copy.data }}</a>
        </div>
      </div>
    </details>
  </div>
</template>

<style scoped>
.vm-cost-notes { min-width: 0; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.85; }
.vm-cost-notes p { margin: 0; }
.vm-cost-notes p + p { margin-top: 12px; }
.vm-cost-details { margin-top: 12px; }
.vm-cost-details summary { display: list-item; min-height: 44px; color: var(--vp-c-brand-1); font-size: 14px; font-weight: 550; cursor: pointer; }
.vm-cost-method-body { max-width: 76ch; }
.vm-cost-method-body h4 { margin: 12px 0; color: var(--vp-c-text-1); font-size: 16px; line-height: 1.6; }
.vm-cost-method-body p { font-size: 13px; line-height: 1.8; }
.vm-cost-method-body .vm-cost-formula { margin-top: 16px; color: var(--vp-c-text-1); font-weight: 550; }
.vm-cost-sources { display: flex; flex-wrap: wrap; gap: 4px 20px; margin-top: 12px; }
.vm-cost-sources a { display: inline-flex; align-items: center; min-height: 44px; color: var(--vp-c-brand-1); font-size: 13px; text-decoration: underline; text-underline-offset: 3px; }
.vm-cost-details summary:focus-visible, .vm-cost-sources a:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; }
@media (max-width: 640px) {
  .vm-cost-notes { font-size: 13px; line-height: 1.7; }
}
</style>
