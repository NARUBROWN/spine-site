<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang } = useData()
const selected = ref('codex')
const status = ref('')
const agents = [
  { id: 'codex', name: 'Codex', icon: 'codex' },
  { id: 'claude', name: 'Claude Code', icon: 'claude-color' },
  { id: 'cursor', name: 'Cursor', icon: 'cursor' },
  { id: 'antigravity', name: 'Antigravity', icon: 'antigravity-color' }
]
const content: Record<string, { title: string; description: string; label: string; open: string; copy: string; copied: string; failed: string; codexHelp: string; copyHelp: string; prompt: string }> = {
  ko: { title: '에이전트와 함께 시작하기', description: '사용하는 코딩 에이전트를 선택하고 Spine 프로젝트 생성을 요청하세요.', label: '코딩 에이전트 선택', open: 'Codex에서 시작하기', copy: '프롬프트 복사하기', copied: '복사했습니다. 에이전트에 붙여 넣으세요.', failed: '복사하지 못했습니다. 아래 프롬프트를 직접 선택해 복사하세요.', codexHelp: 'Codex 앱이 설치되어 있어야 합니다. 앱이 열리지 않으면 프롬프트를 복사해 사용하세요.', copyHelp: '프롬프트를 복사한 뒤 선택한 에이전트에 붙여 넣으세요.', prompt: 'Go 백엔드 프레임워크 Spine 프로젝트를 생성해줘.\n공식 CLI 저장소 https://github.com/NARUBROWN/spine-cli 의 README를 확인하고, `go install github.com/NARUBROWN/spine-cli/cmd/spine@latest`로 설치해줘.\n설치한 `spine` 명령으로 프로젝트를 생성하고, 프로젝트 이름과 Go 모듈 경로는 적절한 기본값으로 정해줘.' },
  en: { title: 'Start with your agent', description: 'Choose your coding agent and ask it to create a Spine project.', label: 'Choose a coding agent', open: 'Start in Codex', copy: 'Copy prompt', copied: 'Copied. Paste it into your agent.', failed: 'Could not copy. Select and copy the prompt below.', codexHelp: 'The Codex app must be installed. If it does not open, copy the prompt instead.', copyHelp: 'Copy the prompt and paste it into your selected agent.', prompt: 'Create a project using Spine, the Go backend framework.\nRead the README in the official CLI repository at https://github.com/NARUBROWN/spine-cli and install it with `go install github.com/NARUBROWN/spine-cli/cmd/spine@latest`.\nUse the installed `spine` command to create the project, choosing suitable defaults for the project name and Go module path.' },
  ja: { title: 'エージェントと始める', description: 'コーディングエージェントを選び、Spine プロジェクトの作成を依頼しましょう。', label: 'エージェントを選択', open: 'Codex で始める', copy: 'プロンプトをコピー', copied: 'コピーしました。エージェントに貼り付けてください。', failed: 'コピーできませんでした。下のプロンプトを選択してコピーしてください。', codexHelp: 'Codex アプリのインストールが必要です。開かない場合はプロンプトをコピーしてください。', copyHelp: 'プロンプトをコピーし、選択したエージェントに貼り付けてください。', prompt: 'Go バックエンドフレームワーク Spine のプロジェクトを作成してください。\n公式 CLI リポジトリ https://github.com/NARUBROWN/spine-cli の README を確認し、`go install github.com/NARUBROWN/spine-cli/cmd/spine@latest` でインストールしてください。\nインストールした `spine` コマンドでプロジェクトを作成し、プロジェクト名と Go モジュールパスには適切な初期値を選んでください。' },
  'zh-CN': { title: '与智能体一起开始', description: '选择编码智能体，让它创建 Spine 项目。', label: '选择编码智能体', open: '在 Codex 中开始', copy: '复制提示词', copied: '已复制，请粘贴到智能体中。', failed: '无法复制，请手动选择并复制下方提示词。', codexHelp: '需要安装 Codex 应用。如果无法打开，请复制提示词。', copyHelp: '复制提示词，然后粘贴到所选智能体中。', prompt: '请使用 Go 后端框架 Spine 创建一个项目。\n请阅读官方 CLI 仓库 https://github.com/NARUBROWN/spine-cli 的 README，并使用 `go install github.com/NARUBROWN/spine-cli/cmd/spine@latest` 安装。\n使用安装的 `spine` 命令创建项目，并为项目名称和 Go 模块路径选择合适的默认值。' },
  'zh-TW': { title: '與代理程式一起開始', description: '選擇程式開發代理程式，請它建立 Spine 專案。', label: '選擇程式開發代理程式', open: '在 Codex 中開始', copy: '複製提示詞', copied: '已複製，請貼到代理程式中。', failed: '無法複製，請手動選取並複製下方提示詞。', codexHelp: '需要安裝 Codex 應用程式。如果無法開啟，請複製提示詞。', copyHelp: '複製提示詞，然後貼到選擇的代理程式中。', prompt: '請使用 Go 後端框架 Spine 建立一個專案。\n請閱讀官方 CLI 儲存庫 https://github.com/NARUBROWN/spine-cli 的 README，並使用 `go install github.com/NARUBROWN/spine-cli/cmd/spine@latest` 安裝。\n使用安裝的 `spine` 指令建立專案，並為專案名稱和 Go 模組路徑選擇適當的預設值。' }
}
const copy = computed(() => content[lang.value] || content.en)
const fallbackLabel: Record<string, string> = {
  ko: '자동으로 앱이 열리지 않으시나요?',
  en: 'App not opening automatically?',
  ja: 'アプリが自動で開きませんか？',
  'zh-CN': '应用没有自动打开？',
  'zh-TW': '應用程式沒有自動開啟？'
}
const antigravityRequirement: Record<string, string> = {
  ko: 'Antigravity 데스크톱 앱 2.29.0 이상이 필요합니다.',
  en: 'Requires Antigravity desktop app 2.29.0 or later.',
  ja: 'Antigravity デスクトップアプリ 2.29.0 以降が必要です。',
  'zh-CN': '需要 Antigravity 桌面应用 2.29.0 或更高版本。',
  'zh-TW': '需要 Antigravity 桌面應用程式 2.29.0 以上版本。'
}
const agentUrl = computed(() => selected.value === 'claude'
  ? `claude://code/new?q=${encodeURIComponent(copy.value.prompt)}`
  : selected.value === 'cursor'
    ? `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(copy.value.prompt)}`
    : selected.value === 'antigravity'
      ? `antigravity://open?prompt=${encodeURIComponent(copy.value.prompt)}`
      : `codex://threads/new?prompt=${encodeURIComponent(copy.value.prompt)}`)
const claudeCopy: Record<string, { open: string; help: string }> = {
  ko: { open: 'Claude Code에서 시작하기', help: 'Claude 데스크톱 앱이 필요합니다. 앱이 열리지 않으면 프롬프트를 복사해 사용하세요.' },
  en: { open: 'Start in Claude Code', help: 'The Claude desktop app is required. If it does not open, copy the prompt instead.' },
  ja: { open: 'Claude Code で始める', help: 'Claude デスクトップアプリが必要です。開かない場合はプロンプトをコピーしてください。' },
  'zh-CN': { open: '在 Claude Code 中开始', help: '需要 Claude 桌面应用。如果无法打开，请复制提示词。' },
  'zh-TW': { open: '在 Claude Code 中開始', help: '需要 Claude 桌面應用程式。如果無法開啟，請複製提示詞。' }
}
const claudeText = computed(() => claudeCopy[lang.value] || claudeCopy.en)
const cursorCopy: Record<string, { open: string; help: string }> = {
  ko: { open: 'Cursor에서 시작하기', help: 'Cursor 앱이 필요합니다. 앱이 열리지 않으면 프롬프트를 복사해 사용하세요.' },
  en: { open: 'Start in Cursor', help: 'The Cursor app is required. If it does not open, copy the prompt instead.' },
  ja: { open: 'Cursor で始める', help: 'Cursor アプリが必要です。開かない場合はプロンプトをコピーしてください。' },
  'zh-CN': { open: '在 Cursor 中开始', help: '需要 Cursor 应用。如果无法打开，请复制提示词。' },
  'zh-TW': { open: '在 Cursor 中開始', help: '需要 Cursor 應用程式。如果無法開啟，請複製提示詞。' }
}
const cursorText = computed(() => cursorCopy[lang.value] || cursorCopy.en)
const antigravityCopy: Record<string, { open: string; help: string }> = {
  ko: { open: 'Antigravity에서 시작하기', help: 'Antigravity 데스크톱 앱 2.29.0 이상이 필요합니다. 앱이 열리지 않으면 프롬프트를 복사해 사용하세요.' },
  en: { open: 'Start in Antigravity', help: 'Antigravity desktop app 2.29.0 or later is required. If it does not open, copy the prompt instead.' },
  ja: { open: 'Antigravity で始める', help: 'Antigravity デスクトップアプリ 2.29.0 以降が必要です。開かない場合はプロンプトをコピーしてください。' },
  'zh-CN': { open: '在 Antigravity 中开始', help: '需要 Antigravity 桌面应用 2.29.0 或更高版本。如果无法打开，请复制提示词。' },
  'zh-TW': { open: '在 Antigravity 中開始', help: '需要 Antigravity 桌面應用程式 2.29.0 以上版本。如果無法開啟，請複製提示詞。' }
}
const antigravityText = computed(() => antigravityCopy[lang.value] || antigravityCopy.en)
async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(copy.value.prompt)
    status.value = copy.value.copied
  } catch {
    status.value = copy.value.failed
  }
}
function choose(id: string) { selected.value = id; status.value = '' }
</script>

<template>
  <section class="agent-start" aria-labelledby="agent-start-title">
    <div class="agent-start-inner">
      <div class="agent-intro">
        <h2 id="agent-start-title">{{ copy.title }}</h2>
        <p>{{ copy.description }}</p>
      </div>
      <div class="agent-panel">
        <div class="agent-options" role="group" :aria-label="copy.label">
          <button v-for="agent in agents" :key="agent.id" type="button" class="agent-option" :class="{ active: selected === agent.id }" :aria-pressed="selected === agent.id" @click="choose(agent.id)">
            <img :src="withBase(`/agents/${agent.icon}.svg`)" alt="" width="28" height="28">
            <span>{{ agent.name }}</span>
          </button>
        </div>
        <div class="agent-actions">
          <a class="agent-primary" :href="agentUrl">{{ selected === 'claude' ? claudeText.open : selected === 'cursor' ? cursorText.open : selected === 'antigravity' ? antigravityText.open : copy.open }} <span aria-hidden="true">↗</span></a>
        </div>
        <button type="button" class="agent-fallback-action" :aria-label="`${fallbackLabel[lang] || fallbackLabel.en} ${copy.copy}`" @click="copyPrompt">{{ fallbackLabel[lang] || fallbackLabel.en }}</button>
        <p v-if="selected === 'antigravity'" class="agent-help">{{ antigravityRequirement[lang] || antigravityRequirement.en }}</p>
        <p v-if="status" class="agent-status" role="status">{{ status }}</p>
        <pre v-if="status === copy.failed" class="agent-fallback">{{ copy.prompt }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.agent-start { padding: 80px var(--home-gutter) 0; }
.agent-start-inner { max-width: var(--home-width); margin: 0 auto; padding: clamp(24px, 4vw, 44px); background: var(--vp-c-default-soft); display: grid; grid-template-columns: .8fr 1.2fr; gap: 48px; }
.agent-start .agent-intro h2 { margin: 0; padding: 0; border: 0; font-size: clamp(26px, 3vw, 36px); font-weight: 700; line-height: 1.3; letter-spacing: -.035em; word-break: keep-all; }
.agent-start .agent-intro p { margin: 18px 0 0; font-size: 16px; line-height: 1.7; word-break: keep-all; }
.agent-panel { min-width: 0; }
.agent-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.agent-option { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 64px; padding: 10px; background: var(--vp-c-bg); border: 2px solid transparent; font-size: 14px; font-weight: 600; cursor: pointer; }
.agent-option.active { border-color: var(--vp-c-brand-1); }
.agent-option img { flex: 0 0 28px; }
.dark .agent-option img[src*="codex"], .dark .agent-option img[src*="cursor"] { filter: invert(1); }
.agent-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.agent-primary { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 46px; padding: 0 18px; border-radius: 4px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; }
.agent-primary { color: white; background: #5750c8; }
.agent-primary:hover { background: #4840ad; color: white; }
.agent-fallback-action { display: block; margin-top: 12px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.6; text-align: left; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.agent-fallback-action:hover { color: var(--vp-c-brand-1); }
.agent-help, .agent-status { margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: var(--vp-c-text-2); }
.agent-status { color: var(--vp-c-brand-1); }
.agent-fallback { white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px; background: var(--vp-c-bg); font-size: 13px; line-height: 1.7; }
.agent-start :is(button, a):focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
@media (max-width: 800px) { .agent-start-inner { grid-template-columns: 1fr; gap: 24px; } }
@media (max-width: 640px) { .agent-start { padding-top: 40px; } }
@media (max-width: 540px) { .agent-options { grid-template-columns: 1fr; } .agent-option { justify-content: flex-start; min-height: 52px; } .agent-actions > * { flex: 1 1 auto; } }
</style>
