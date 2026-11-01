<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import { supportCopy, supportIssueUrl, supportLocale } from '../support/copy'

const { lang } = useData()
const copy = computed(() => supportCopy(lang.value))
const locale = computed(() => supportLocale(lang.value))
const copyStatus = ref('')

async function copyTemplate(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value = copy.value.copied
  } catch {
    copyStatus.value = copy.value.copyFailed
  }
}
</script>

<template>
  <article class="enterprise-support">
    <div class="support-column">
      <header class="support-hero">
        <h1><span v-for="line in copy.title" :key="line">{{ line }}</span></h1>
        <p class="support-lead">{{ copy.intro }}</p>
        <div class="support-actions">
          <a class="support-primary" :href="supportIssueUrl">{{ copy.contactAction }}</a>
          <a href="#support-scope">{{ copy.scopeAction }}</a>
        </div>
        <dl class="support-principles">
          <div v-for="fact in copy.facts" :key="fact[0]">
            <dt>{{ fact[0] }}</dt><dd>{{ fact[1] }}</dd>
          </div>
        </dl>
        <p class="support-response"><strong>{{ copy.responseNote }}</strong></p>
      </header>

      <section id="support-scope" aria-labelledby="support-scope-title">
        <h2 id="support-scope-title">{{ copy.scopeTitle }}</h2>
        <p>{{ copy.positioning }}</p>
        <div class="support-services">
          <div v-for="service in copy.services" :key="service[0]">
            <h3>{{ service[0] }}</h3><p>{{ service[1] }}</p>
          </div>
        </div>
        <p>{{ copy.ownership }}</p>
        <details class="support-details">
          <summary>{{ copy.boundaryTitle }}</summary>
          <p>{{ copy.boundary }}</p>
        </details>
      </section>

      <section aria-labelledby="support-process-title">
        <h2 id="support-process-title">{{ copy.processTitle }}</h2>
        <p v-for="step in copy.process" :key="step[0]" class="support-step"><strong>{{ step[0] }}</strong> {{ step[1] }}</p>
      </section>

      <section aria-labelledby="support-priority-title">
        <h2 id="support-priority-title">{{ copy.priorityTitle }}</h2>
        <dl class="support-priorities">
          <div v-for="priority in copy.priorities" :key="priority[0]">
            <dt>{{ priority[0] }}</dt><dd>{{ priority[1] }}</dd>
          </div>
        </dl>
        <p>{{ copy.priorityNote }}</p>
        <p>{{ copy.incidentNote }}</p>
      </section>

      <section aria-labelledby="support-prepare-title">
        <h2 id="support-prepare-title">{{ copy.prepareTitle }}</h2>
        <p>{{ copy.prepareIntro }}</p>
        <details v-for="(template, index) in copy.templates" :key="template[0]" class="support-details" :open="index === 0">
          <summary>{{ template[0] }}</summary>
          <div class="support-template">
            <textarea :aria-label="template[0]" :value="template[1]" :rows="index === 0 ? 4 : 8" readonly spellcheck="false" />
            <button type="button" @click="copyTemplate(template[1])">{{ copy.copy }}</button>
          </div>
        </details>
        <p class="support-copy-status" role="status" aria-live="polite">{{ copyStatus }}</p>
        <p>{{ copy.privacy }}</p>
        <p>{{ copy.versionNote }}</p>
      </section>

      <section id="support-contact" class="support-contact" aria-labelledby="support-contact-title">
        <h2 id="support-contact-title">{{ copy.contactTitle }}</h2>
        <p class="support-contact-status">{{ copy.contactStatus }}</p>
        <p>{{ copy.contactIntro }}</p>
        <p><strong>{{ copy.contactNote }}</strong></p>
        <div class="support-actions">
          <a class="support-primary" :href="supportIssueUrl">{{ copy.contactAction }}</a>
        </div>
        <div class="support-resource-links">
          <a :href="withBase(`/${locale}/learn/getting-started/first-app`)">{{ copy.docsLink }}</a>
          <a :href="withBase(`/${locale}/community/`)">{{ copy.communityLink }}</a>
        </div>
      </section>
      <p class="support-consent">{{ copy.consentNote }}</p>
      <a class="support-back" :href="withBase(`/${locale}/`)">{{ copy.home }}</a>
    </div>
  </article>
</template>

<style scoped>
.enterprise-support {
  --support-paper: #faf9fc;
  --support-surface: #f0eef5;
  --support-accent: #5750c8;
  --support-action-ink: #ffffff;
  background: var(--support-paper);
  color: var(--vp-c-text-1);
  padding: 88px 24px 72px;
  font-size: 17px;
  line-height: 1.8;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.dark .enterprise-support {
  --support-paper: #1b1b1f;
  --support-surface: #252529;
  --support-accent: #b6afff;
  --support-action-ink: #1b1b1f;
}
.enterprise-support:lang(ja), .enterprise-support:lang(zh) { word-break: normal; }
.support-column { max-width: 720px; margin-inline: auto; }
.support-hero h1 { margin: 0; font-size: clamp(36px, 4.6vw, 60px); font-weight: 650; line-height: 1.18; letter-spacing: -.045em; }
.support-hero h1 span { display: block; }
.support-lead { margin-top: 32px !important; max-width: 620px; }
.enterprise-support p { margin: 20px 0 0; }
.support-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px; margin-top: 28px; }
.enterprise-support a { color: var(--support-accent); text-decoration: underline; text-underline-offset: 5px; }
.enterprise-support a:hover { text-decoration-thickness: 2px; }
.enterprise-support .support-primary { display: inline-flex; align-items: center; min-height: 48px; padding: 10px 20px; color: var(--support-action-ink); background: var(--support-accent); text-decoration: none; font-size: 16px; font-weight: 600; transition: opacity .18s ease; }
.support-primary:hover { opacity: .86; }
.support-principles { display: grid; gap: 22px; margin-top: 48px; }
.support-principles > div, .support-priorities > div { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 20px; }
.enterprise-support dt { font-weight: 650; }
.enterprise-support dd { margin: 0; }
.support-response { margin-top: 28px !important; }
.enterprise-support section { margin-top: 112px; scroll-margin-top: 96px; }
.enterprise-support h2 { font-size: 30px; font-weight: 650; line-height: 1.4; letter-spacing: -.035em; }
.support-services { display: grid; gap: 28px; margin: 36px 0; }
.support-services h3 { font-size: 17px; font-weight: 650; }
.support-services p { margin-top: 6px; }
.support-step { margin-top: 28px !important; }
.support-priorities { display: grid; gap: 24px; margin: 32px 0; }
.support-details { margin-top: 24px; padding: 20px 24px; background: var(--support-surface); }
.support-details summary { font-size: 17px; font-weight: 600; cursor: pointer; min-height: 44px; padding-block: 7px; }
.support-details summary:hover { color: var(--support-accent); }
.support-template { margin-top: 20px; }
.support-template textarea { display: block; width: 100%; min-height: 120px; resize: vertical; padding: 12px; background: var(--support-paper); color: var(--vp-c-text-1); font: inherit; font-size: 16px; line-height: 1.8; border-radius: 0; }
.support-template button { min-height: 44px; margin-top: 12px; padding: 8px 14px; background: var(--support-accent); color: var(--support-action-ink); font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity .18s ease; }
.support-template button:hover { opacity: .86; }
.support-copy-status:empty { display: none; }
.support-contact { padding: 32px; background: var(--support-surface); }
.support-contact-status { font-size: 20px; font-weight: 650; }
.support-resource-links { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-top: 28px; }
.support-consent { margin-top: 32px !important; font-size: 16px; }
.support-back { display: inline-flex; align-items: center; min-height: 44px; margin-top: 32px; font-size: 16px; }
.enterprise-support :is(a, button, summary, textarea):focus-visible { outline: 2px solid var(--support-accent); outline-offset: 5px; }
@media (max-width: 640px) {
  .enterprise-support { padding: 40px 20px 48px; font-size: 16px; line-height: 1.8; }
  .support-hero h1 { font-size: 34px; line-height: 1.25; }
  .support-lead { margin-top: 24px !important; }
  .support-principles { margin-top: 36px; gap: 24px; }
  .support-principles > div, .support-priorities > div { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .enterprise-support section { margin-top: 64px; scroll-margin-top: 80px; }
  .enterprise-support h2 { font-size: 26px; }
  .support-details { padding: 18px; }
  .support-contact { padding: 24px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .support-primary, .support-template button { transition: none; }
}
@media (max-width: 360px) {
  .enterprise-support:lang(en) .support-hero h1 { font-size: 30px; }
}
</style>
