<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import catalog from '../releases/catalog.json'
import { releaseCopy } from '../releases/copy'

const { lang } = useData()
const copy = computed(() => releaseCopy(lang.value))
const channel = ref<'stable' | 'preview' | 'rc'>('stable')
const channels = ['stable', 'preview', 'rc'] as const
const rows = computed(() => catalog.repositories.map(repo => ({
  ...repo, versions: repo.tags.filter(tag => tag.channel === channel.value)
})))
// 서버와 브라우저에서 같은 시각을 표시해 hydration 차이를 피한다.
const checkedAt = catalog.checked_at.replace('T', ' ').replace('Z', ' UTC')
const date = (value: string) => value.slice(0, 10)
</script>

<template>
  <section class="release-catalog" aria-labelledby="catalog-title">
    <h2 id="catalog-title">{{ copy.title }}</h2>
    <p class="catalog-date">{{ copy.checked }} <time :datetime="catalog.checked_at">{{ checkedAt }}</time></p>
    <div class="catalog-channels" :aria-label="copy.channel">
      <button v-for="item in channels" :key="item" type="button" :aria-pressed="channel === item" @click="channel = item">{{ copy[item] }}</button>
    </div>
    <ul class="catalog-list">
      <li v-for="repo in rows" :key="repo.name">
        <h3><a :href="repo.tags_url">{{ repo.name }}</a></h3>
        <dl>
          <div><dt>{{ copy[channel] }}</dt><dd><a v-if="repo.versions[0]" :href="repo.versions[0].tag_url">{{ repo.versions[0].version }}</a><span v-else>{{ copy.unpublished }}</span></dd></div>
          <div><dt>{{ copy.target }}</dt><dd><a :href="repo.policy_url">{{ repo.target_version }}</a></dd></div>
        </dl>
        <p v-if="repo.versions[0]" class="catalog-state">
          {{ repo.versions[0].notes_url ? copy.releasePublished : copy.tagPublished }}<template v-if="repo.versions[0].published_at">, <time :datetime="repo.versions[0].published_at">{{ date(repo.versions[0].published_at) }}</time></template>
        </p>
        <div class="catalog-links">
          <a v-if="repo.versions[0]?.notes_url" :href="repo.versions[0].notes_url">{{ copy.notes }}</a>
          <a v-if="repo.versions[0]?.manifest_url" :href="repo.versions[0].manifest_url">{{ copy.manifest }}</a>
          <a :href="repo.actions_url">{{ copy.runs }}</a>
          <a :href="repo.milestones_url">{{ copy.plan }}</a>
        </div>
        <details v-if="repo.versions.length">
          <summary>{{ copy.history }} ({{ repo.versions.length }})</summary>
          <ul class="catalog-history"><li v-for="tag in repo.versions" :key="tag.version"><a :href="tag.tag_url">{{ tag.version }}</a><a v-if="tag.notes_url" :href="tag.notes_url">{{ copy.notes }}</a></li></ul>
        </details>
      </li>
    </ul>
  </section>
</template>

<style scoped>
:global(.release-versions) { --vp-c-brand-1: #5750c8; --vp-code-color: #5750c8; }
:global(.dark .release-versions), :global(.dark.release-versions) { --vp-c-brand-1: #c6bcff; --vp-code-color: #c6bcff; }
:global(.release-versions .vp-doc h1 + p) { font-size: 18px; }
.catalog-date { color: var(--vp-c-text-2); font-size: 14px; }
.catalog-channels { display: flex; gap: 8px; margin: 24px 0; flex-wrap: wrap; }
.catalog-channels button { background: var(--vp-c-bg-soft); border-radius: 6px; padding: 8px 18px; min-height: 44px; font-weight: 600; }
.catalog-channels button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
.catalog-channels button:hover { background: var(--vp-c-default-soft); }
.catalog-channels button[aria-pressed="true"]:hover { background: var(--vp-c-text-1); }
.catalog-channels button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.catalog-list { list-style: none; padding: 0; }
.catalog-list > li { padding: 24px 0; margin: 0; display: grid; grid-template-columns: 1.1fr 1fr; gap: 8px 20px; }
.catalog-list h3 { margin: 0 0 16px; font-size: 18px; overflow-wrap: anywhere; }
.catalog-list dl { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 0; }
.catalog-list dt { color: var(--vp-c-text-2); font-size: 14px; }
.catalog-list dd { margin: 4px 0 0; font-size: 16px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.catalog-state { font-size: 14px; margin: 12px 0; color: var(--vp-c-text-2); }
.catalog-links { display: flex; gap: 8px 20px; flex-wrap: wrap; margin: 12px 0; font-size: 14px; }
.catalog-list details { grid-column: 1 / -1; font-size: 14px; }
.catalog-list summary { cursor: pointer; min-height: 32px; }
.catalog-history { padding-left: 20px; }
.catalog-history li { display: flex; gap: 16px; flex-wrap: wrap; }
@media (max-width: 640px) { .catalog-list > li { display: block; } }
@media (max-width: 420px) { .catalog-list dl { grid-template-columns: 1fr; gap: 12px; } .catalog-channels { gap: 6px; } .catalog-channels button { padding: 8px 14px; } }
</style>
