<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref('spine')

const tabs = [
  { id: 'spine', label: 'Spine (Go)' },
  { id: 'nestjs', label: 'NestJS (TypeScript)' },
  { id: 'spring', label: 'Spring Boot (Java)' }
]
</script>

<template>
  <div class="framework-tabs">
    <div class="tab-buttons">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="tab-content">
      <div v-show="activeTab === 'spine'" class="tab-pane">
        <slot name="spine" />
      </div>
      <div v-show="activeTab === 'nestjs'" class="tab-pane">
        <slot name="nestjs" />
      </div>
      <div v-show="activeTab === 'spring'" class="tab-pane">
        <slot name="spring" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.framework-tabs {
  margin-top: 2rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.tab-buttons {
  display: flex;
  background-color: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
}

.tab-btn {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--vp-c-text-1);
}

.tab-btn.active {
  color: var(--vp-c-brand-1);
  border-bottom: 2px solid var(--vp-c-brand-1);
  margin-bottom: -1px;
}

.tab-content {
  padding: 24px;
  background-color: var(--vp-c-bg);
}
</style>
