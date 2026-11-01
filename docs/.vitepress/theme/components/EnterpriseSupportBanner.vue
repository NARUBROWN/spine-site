<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { supportCopy, supportLocale } from '../support/copy'

const { lang } = useData()
const copy = computed(() => supportCopy(lang.value))
const href = computed(() => withBase(`/${supportLocale(lang.value)}/enterprise-support`))
</script>

<template>
  <a class="enterprise-banner" :href="href">
    <span class="enterprise-banner-copy">
      <strong>{{ copy.bannerTitle }}</strong>
      <span>{{ copy.bannerDetail }}</span>
    </span>
    <span class="enterprise-banner-action">{{ copy.bannerLink }} <span aria-hidden="true">↗</span></span>
  </a>
</template>

<style scoped>
.enterprise-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  width: 100%;
  padding: 18px 20px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: background-color .18s ease;
}
.enterprise-banner-copy { display: grid; gap: 5px; min-width: 0; }
.enterprise-banner-copy strong { font-size: 16px; font-weight: 650; line-height: 1.5; }
.enterprise-banner-copy > span { font-size: 14px; line-height: 1.6; }
.enterprise-banner-action { display: inline-flex; align-items: center; gap: 10px; color: var(--vp-c-brand-1); font-size: 14px; font-weight: 600; line-height: 1.5; }
.enterprise-banner-action > span { transition: transform .18s ease; }
.enterprise-banner:hover { background: var(--vp-c-default-3); }
.enterprise-banner:hover .enterprise-banner-action > span { transform: translate(2px, -2px); }
.enterprise-banner:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; }
@media (max-width: 640px) {
  .enterprise-banner { padding: 16px; gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .enterprise-banner, .enterprise-banner-action > span { transition: none; transform: none; }
}
</style>
