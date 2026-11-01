<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'

const { lang } = useData()
const locale = computed(() => benchmarkCopy(lang.value).path)
const view = ref<'code' | 'flow'>('code')
const words = {
  ko: { label: 'Spine CLI 첫 앱 예시', code: 'CLI로 시작', flow: '실행 흐름', note: 'CLI로 프로젝트를 생성하고 검증한 뒤 실행합니다. 전체 절차는 첫 앱 문서에서 확인하세요.', guide: 'CLI로 첫 앱 만들기', request: '조립', controller: '검증', service: '실행', response: '응답', caption: 'CLI가 생성한 앱은 검증 후 서버를 실행하고 /health 요청에 응답합니다.' },
  en: { label: 'Spine CLI first app example', code: 'Start with the CLI', flow: 'Execution flow', note: 'Generate, verify and run a project with the CLI. Follow the first-app guide for the full steps.', guide: 'Build your first app with the CLI', request: 'Assemble', controller: 'Validate', service: 'Run', response: 'Response', caption: 'The CLI-generated app validates before starting the server and responding to /health.' },
  ja: { label: 'Spine CLIの最初のアプリ', code: 'CLIで始める', flow: '実行の流れ', note: 'CLIでプロジェクトを生成し、検証して実行します。全手順は最初のアプリのガイドで確認できます。', guide: 'CLIで最初のアプリを作る', request: '組み立て', controller: '検証', service: '実行', response: '応答', caption: 'CLIが生成したアプリは検証後にサーバーを起動し、/health に応答します。' },
  'zh-Hans': { label: 'Spine CLI第一个应用示例', code: '从CLI开始', flow: '执行流程', note: '使用CLI生成、验证并运行项目。完整步骤见第一个应用指南。', guide: '使用CLI创建第一个应用', request: '组装', controller: '验证', service: '运行', response: '响应', caption: 'CLI生成的应用先验证，再启动服务器并响应 /health 请求。' },
  'zh-Hant': { label: 'Spine CLI第一個應用程式範例', code: '從CLI開始', flow: '執行流程', note: '使用CLI產生、驗證並執行專案。完整步驟請見第一個應用程式指南。', guide: '使用CLI建立第一個應用程式', request: '組裝', controller: '驗證', service: '執行', response: '回應', caption: 'CLI產生的應用程式先驗證，再啟動伺服器並回應 /health 請求。' }
}
const copy = computed(() => words[locale.value as keyof typeof words] || words.en)
const lines = [
  'go install github.com/NARUBROWN/spine-cli/cmd/spine@v0.1.4',
  'spine new hello-spine --module example.com/hello-spine',
  'cd hello-spine',
  'go mod tidy',
  'spine contract check',
  'spine verify',
  'spine dev'
]
const steps = computed(() => [
  { label: copy.value.request, value: 'BuildApplication()' },
  { label: copy.value.controller, value: 'app.Validate(options)' },
  { label: copy.value.service, value: 'app.Run(options)' },
  { label: copy.value.response, value: 'GET /health → {"status":"ok"}' }
])

function selectWithKeyboard(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  view.value = event.key === 'Home' ? 'code' : event.key === 'End' ? 'flow' : view.value === 'code' ? 'flow' : 'code'
  const container = (event.currentTarget as HTMLElement).parentElement
  container?.querySelector<HTMLButtonElement>(`#workbench-tab-${view.value}`)?.focus()
}
</script>

<template>
  <div class="spine-workbench" data-ui :aria-label="copy.label">
    <div class="workbench-header">
      <div class="workbench-tabs" role="tablist" :aria-label="copy.label">
        <button v-for="tab in (['code', 'flow'] as const)" :id="`workbench-tab-${tab}`" :key="tab"
          type="button" role="tab" :aria-selected="view === tab" aria-controls="workbench-panel"
          :tabindex="view === tab ? 0 : -1" @click="view = tab" @keydown="selectWithKeyboard">
          {{ copy[tab] }}
        </button>
      </div>
      <span class="workbench-language">Shell</span>
    </div>
    <div id="workbench-panel" class="workbench-panel" role="tabpanel" :aria-labelledby="`workbench-tab-${view}`" tabindex="0">
      <pre v-if="view === 'code'" class="workbench-code"><code><span v-for="(line, index) in lines" :key="index" class="code-line" :class="{ 'code-call': line.startsWith('app.') }" :style="{ '--line': index }">{{ line || ' ' }}
</span></code></pre>
      <div v-else class="workbench-flow">
        <div v-for="(step, index) in steps" :key="step.value" class="flow-step" :style="{ '--line': index }">
          <span class="flow-label">{{ step.label }}</span>
          <code>{{ step.value }}</code>
          <span v-if="index < steps.length - 1" class="flow-connector" aria-hidden="true">↓</span>
        </div>
      </div>
    </div>
    <div class="workbench-bottom">
      <p>{{ view === 'code' ? copy.note : copy.caption }}</p>
      <a :href="withBase(`/${locale}/learn/getting-started/first-app`)">{{ copy.guide }} <span aria-hidden="true">↗</span></a>
    </div>
  </div>
</template>

<style scoped>
.spine-workbench { width: 100%; min-width: 0; overflow: hidden; color: #eeeaf6; background: #262330; border-radius: 8px; text-align: left; }
.workbench-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; background: #302b3e; }
.workbench-tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.workbench-tabs button { min-height: 44px; padding: 8px 12px; border-radius: 3px; color: #c8c2d8; font-size: 14px; font-weight: 500; transition: background .18s, color .18s; }
.workbench-tabs button:hover { color: #fff; background: #3d3651; }
.workbench-tabs button[aria-selected='true'] { color: #fff; background: #48405f; }
.workbench-language { color: #c8c2d8; font-size: 14px; }
.workbench-panel { min-height: 308px; }
.workbench-code { margin: 0; padding: 28px; overflow: visible; background: none; }
.workbench-code code { display: block; margin: 0; padding: 0; color: #e4deee; font-family: var(--vp-font-family-mono); font-size: 14px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.code-line { display: block; }
.code-call { color: #c5b8ff; }
.workbench-flow { display: grid; gap: 22px; padding: 24px 28px 28px; }
.flow-step { position: relative; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 16px; min-height: 36px; }
.flow-label { color: #c8c2d8; font-size: 14px; }
.flow-step code { padding: 0; color: #eeeaf6; background: none; font-size: 14px; overflow-wrap: anywhere; }
.flow-step:first-child code, .flow-step:last-child code { color: #c5b8ff; }
.flow-connector { position: absolute; bottom: -23px; left: 1px; color: #b8a9ed; font-size: 18px; }
.workbench-bottom { padding: 20px 28px 24px; background: #211e2a; }
.workbench-bottom p { min-height: 3.4em; margin: 0 0 12px; color: #c8c2d8; font-size: 14px; line-height: 1.7; word-break: keep-all; }
.workbench-bottom a { display: inline-flex; align-items: center; gap: 10px; min-height: 28px; color: #d4c9ff; font-size: 14px; font-weight: 550; text-decoration: none; }
.workbench-bottom a:hover { color: #fff; }
.spine-workbench a:focus-visible, .spine-workbench button:focus-visible, .workbench-panel:focus-visible { outline: 2px solid #c5b8ff; outline-offset: 3px; }
@media (max-width: 640px) {
  .workbench-header { padding: 8px 12px; }
  .workbench-tabs button { padding-inline: 10px; font-size: 13px; }
  .workbench-language { font-size: 13px; }
  .workbench-code { padding: 16px; }
  .workbench-code code { font-size: 13px; line-height: 1.6; }
  .workbench-flow { gap: 18px; padding: 16px; }
  .flow-label, .flow-step code { font-size: 13px; }
  .flow-connector { bottom: -19px; }
  .workbench-panel { min-height: 240px; }
  .workbench-bottom { padding: 14px 16px; }
  .workbench-bottom p { min-height: 0; margin-bottom: 8px; font-size: 13px; line-height: 1.6; }
  .workbench-bottom a { min-height: 44px; font-size: 13px; }
}
@media (prefers-reduced-motion: no-preference) {
  .code-line { animation: code-arrive .45s cubic-bezier(.16, 1, .3, 1) both; animation-delay: calc(var(--line) * 30ms); }
  .flow-step { animation: code-arrive .4s cubic-bezier(.16, 1, .3, 1) both; animation-delay: calc(var(--line) * 65ms); }
  @keyframes code-arrive { from { opacity: .6; transform: translateY(6px); } to { opacity: 1; transform: none; } }
}
@media (prefers-reduced-motion: reduce) { .workbench-tabs button { transition: none; } }
</style>
