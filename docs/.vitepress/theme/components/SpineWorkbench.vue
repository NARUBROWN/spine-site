<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import { benchmarkCopy } from '../benchmark/copy'

const { lang } = useData()
const locale = computed(() => benchmarkCopy(lang.value).path)
const view = ref<'code' | 'flow'>('code')
const words = {
  ko: { label: 'Spine 앱 등록 예시', code: '등록 코드', flow: '요청 흐름', note: '생성자와 핸들러는 앱 코드에 정의합니다.', guide: '전체 앱 코드 보기', request: '요청', controller: '컨트롤러', service: '서비스', response: '응답', caption: '첫 앱 예제의 요청 처리 흐름입니다.' },
  en: { label: 'Spine app registration example', code: 'Registration', flow: 'Request flow', note: 'Constructors and handlers are defined in the app.', guide: 'See the complete app', request: 'Request', controller: 'Controller', service: 'Service', response: 'Response', caption: 'The request flow in the first-app example.' },
  ja: { label: 'Spineのアプリ登録例', code: '登録コード', flow: '処理の流れ', note: 'コンストラクタとハンドラーはアプリ側で定義します。', guide: 'アプリ全体のコードを見る', request: 'リクエスト', controller: 'コントローラー', service: 'サービス', response: 'レスポンス', caption: '最初のアプリの例におけるリクエスト処理の流れです。' },
  'zh-Hans': { label: 'Spine应用注册示例', code: '注册代码', flow: '请求流程', note: '构造函数与处理方法在应用代码中定义。', guide: '查看完整应用代码', request: '请求', controller: '控制器', service: '服务', response: '响应', caption: '第一个应用示例中的请求处理流程。' },
  'zh-Hant': { label: 'Spine應用程式註冊範例', code: '註冊程式碼', flow: '請求流程', note: '建構函式與處理方法在應用程式碼中定義。', guide: '查看完整應用程式碼', request: '請求', controller: '控制器', service: '服務', response: '回應', caption: '第一個應用程式範例中的請求處理流程。' }
}
const copy = computed(() => words[locale.value as keyof typeof words] || words.en)
const lines = [
  'app := spine.New()',
  '',
  'app.Constructor(',
  '  NewUserService,',
  '  NewUserController,',
  ')',
  '',
  'app.Route("GET", "/users",',
  '  (*UserController).GetUser,',
  ')'
]
const steps = computed(() => [
  { label: copy.value.request, value: 'GET /users?id=1' },
  { label: copy.value.controller, value: 'UserController.GetUser' },
  { label: copy.value.service, value: 'UserService.Get' },
  { label: copy.value.response, value: 'httpx.Response' }
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
      <span class="workbench-language">Go</span>
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
  .workbench-header { padding: 10px 12px; }
  .workbench-tabs button { padding-inline: 10px; }
  .workbench-code { padding: 22px 20px; }
  .workbench-code code { font-size: 13px; }
  .workbench-flow { padding-inline: 20px; }
  .workbench-panel { min-height: 278px; }
  .workbench-bottom { padding: 18px 20px 20px; }
}
@media (prefers-reduced-motion: no-preference) {
  .code-line { animation: code-arrive .45s cubic-bezier(.16, 1, .3, 1) both; animation-delay: calc(var(--line) * 30ms); }
  .flow-step { animation: code-arrive .4s cubic-bezier(.16, 1, .3, 1) both; animation-delay: calc(var(--line) * 65ms); }
  @keyframes code-arrive { from { opacity: .6; transform: translateY(6px); } to { opacity: 1; transform: none; } }
}
@media (prefers-reduced-motion: reduce) { .workbench-tabs button { transition: none; } }
</style>
