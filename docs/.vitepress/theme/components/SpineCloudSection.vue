<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'
import { spineCloudCopy, spineCloudURL } from '../cloud/copy'
import SpineCloudBrand from './SpineCloudBrand.vue'

const { lang } = useData()
const locale = computed(() => benchmarkCopy(lang.value).path)
const copy = computed(() => spineCloudCopy(locale.value))
</script>

<template>
  <section id="spine-cloud" class="spine-cloud-section" aria-labelledby="spine-cloud-heading">
    <div class="spine-cloud-inner">
      <div class="spine-cloud-identity">
        <SpineCloudBrand />
        <a class="spine-cloud-link" :href="spineCloudURL(locale)">{{ copy.link }}<span aria-hidden="true">↗</span></a>
      </div>
      <div class="spine-cloud-description">
        <h2 id="spine-cloud-heading">{{ copy.title }}</h2>
        <p>{{ copy.description }}</p>
        <p class="spine-cloud-beta">{{ copy.beta }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.spine-cloud-section {
  --cloud-mint: #12a876;
  --cloud-ink: #f5f5f5;
  --cloud-muted: #b5c6bd;
  padding: 64px var(--home-gutter, 24px);
  background: #11251e;
  color: var(--cloud-ink);
  scroll-margin-top: 88px;
}
.spine-cloud-inner { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); align-items: center; gap: 72px; max-width: var(--home-width, 1120px); margin: 0 auto; }
.spine-cloud-identity, .spine-cloud-description { min-width: 0; }
.spine-cloud-section .spine-cloud-link { display: inline-flex; align-items: center; gap: 12px; min-height: 44px; margin-top: 16px; color: var(--cloud-mint); font-size: 16px; font-weight: 600; text-decoration: none; }
.spine-cloud-link:hover { text-decoration: underline; text-underline-offset: 5px; }
.spine-cloud-section .spine-cloud-link:focus-visible { outline: 2px solid var(--cloud-mint); outline-offset: 5px; }
.spine-cloud-section #spine-cloud-heading { margin: 0; padding: 0; border: 0; color: var(--cloud-ink); font-size: clamp(26px, 2.8vw, 36px); font-weight: 650; line-height: 1.35; letter-spacing: -.04em; text-wrap: balance; }
.spine-cloud-section .spine-cloud-description p { margin: 16px 0 0; color: var(--cloud-ink); font-size: 16px; line-height: 1.8; }
.spine-cloud-section .spine-cloud-description p.spine-cloud-beta { margin-top: 12px; color: var(--cloud-muted); font-size: 14px; }
@media (max-width: 900px) { .spine-cloud-inner { gap: 40px; } }
@media (max-width: 640px) {
  .spine-cloud-section { padding-block: 40px; }
  .spine-cloud-inner { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .spine-cloud-identity { display: contents; }
  .spine-cloud-link { order: 1; justify-self: start; }
  .spine-cloud-section .spine-cloud-link { margin-top: 0; font-size: 15px; }
  .spine-cloud-section #spine-cloud-heading { font-size: 26px; }
  .spine-cloud-section .spine-cloud-description p { margin-top: 12px; font-size: 15px; }
  .spine-cloud-section .spine-cloud-description p.spine-cloud-beta { font-size: 13px; }
}
</style>
