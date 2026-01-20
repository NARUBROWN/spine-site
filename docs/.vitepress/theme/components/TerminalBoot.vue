<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useData } from 'vitepress'

const { lang } = useData()

const logs = {
  ko: [
    '________       _____             ',
    '__  ___/__________(_)___________ ',
    '_____ \\___  __ \\_  /__  __ \\  _ \\',
    '____/ /__  /_/ /  / _  / / /  __/',
    '/____/ _  .___//_/  /_/ /_/\\___/ ',
    '       /_/        ',
    '2026/01/20 19:20:05 [Bootstrap] Spine version: v0.2.1',
    '2026/01/20 19:20:05 [Bootstrap] 컨테이너 초기화 시작',
    '2026/01/20 19:20:05 [Bootstrap] 생성자 등록 시작 (5개)',
    '2026/01/20 19:20:05 [Bootstrap] 생성자 등록 : func() *bun.DB',
    '2026/01/20 19:20:05 [Bootstrap] 생성자 등록 : func(bun.IDB) *repository.UserRepository',
    '2026/01/20 19:20:05 [Bootstrap] 생성자 등록 : func(*repository.UserRepository) *service.UserService',
    '2026/01/20 19:20:05 [Bootstrap] 생성자 등록 : func(*service.UserService) *controller.UserController',
    '2026/01/20 19:20:05 [Bootstrap] 생성자 등록 : func(*bun.DB) *interceptor.TxInterceptor',
    '2026/01/20 19:20:05 [Bootstrap] 라우터 구성 시작 (4개 라우트)',
    '2026/01/20 19:20:05 [Bootstrap] 라우터 등록 : (GET) /users',
    '2026/01/20 19:20:05 [Bootstrap] 라우터 등록 : (POST) /users',
    '2026/01/20 19:20:05 [Bootstrap] 라우터 등록 : (PUT) /users',
    '2026/01/20 19:20:05 [Bootstrap] 라우터 등록 : (DELETE) /users',
    '2026/01/20 19:20:05 [Bootstrap] 컨트롤러 의존성 Warm-up 시작',
    '2026/01/20 19:20:05 [Container] Resolve 요청 : *controller.UserController',
    '2026/01/20 19:20:05 [Container] Resolve 요청 : *service.UserService',
    '2026/01/20 19:20:05 [Container] Resolve 요청 : *repository.UserRepository',
    '2026/01/20 19:20:05 [Container] Resolve 요청 : bun.IDB',
    '2026/01/20 19:20:05 [Bootstrap] 실행 파이프라인 구성',
    '2026/01/20 19:20:05 [Bootstrap] ArgumentResolver 등록',
    '2026/01/20 19:20:05 [Bootstrap] ReturnValueHandler 등록',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor 등록 시작',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor TxInterceptor가 컨테이너에서 생성됐습니다.',
    '2026/01/20 19:20:05 [Container] Resolve 요청 : *interceptor.TxInterceptor',
    '2026/01/20 19:20:05 [Container] Resolve 요청 : *bun.DB',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor *cors.CORSInterceptor가 인스턴스에서 사용됩니다.',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor *interceptor.LoggingInterceptor가 인스턴스에서 사용됩니다.',
    '2026/01/20 19:20:05 [Bootstrap] HTTP 어댑터 마운트',
    '2026/01/20 19:20:05 [Bootstrap] 서버 리스닝 시작: :8080'
  ],
  en: [
    '________       _____             ',
    '__  ___/__________(_)___________ ',
    '_____ \\___  __ \\_  /__  __ \\  _ \\',
    '____/ /__  /_/ /  / _  / / /  __/',
    '/____/ _  .___//_/  /_/ /_/\\___/ ',
    '       /_/        ',
    '2026/01/20 19:20:05 [Bootstrap] Spine version: v0.2.1',
    '2026/01/20 19:20:05 [Bootstrap] Container initialization started',
    '2026/01/20 19:20:05 [Bootstrap] Constructor registration started (5 items)',
    '2026/01/20 19:20:05 [Bootstrap] Register constructor : func() *bun.DB',
    '2026/01/20 19:20:05 [Bootstrap] Register constructor : func(bun.IDB) *repository.UserRepository',
    '2026/01/20 19:20:05 [Bootstrap] Register constructor : func(*repository.UserRepository) *service.UserService',
    '2026/01/20 19:20:05 [Bootstrap] Register constructor : func(*service.UserService) *controller.UserController',
    '2026/01/20 19:20:05 [Bootstrap] Register constructor : func(*bun.DB) *interceptor.TxInterceptor',
    '2026/01/20 19:20:05 [Bootstrap] Router configuration started (4 routes)',
    '2026/01/20 19:20:05 [Bootstrap] Register route : (GET) /users',
    '2026/01/20 19:20:05 [Bootstrap] Register route : (POST) /users',
    '2026/01/20 19:20:05 [Bootstrap] Register route : (PUT) /users',
    '2026/01/20 19:20:05 [Bootstrap] Register route : (DELETE) /users',
    '2026/01/20 19:20:05 [Bootstrap] Controller dependency warm-up started',
    '2026/01/20 19:20:05 [Container] Resolve request : *controller.UserController',
    '2026/01/20 19:20:05 [Container] Resolve request : *service.UserService',
    '2026/01/20 19:20:05 [Container] Resolve request : *repository.UserRepository',
    '2026/01/20 19:20:05 [Container] Resolve request : bun.IDB',
    '2026/01/20 19:20:05 [Bootstrap] Execution pipeline configuration',
    '2026/01/20 19:20:05 [Bootstrap] ArgumentResolver registration',
    '2026/01/20 19:20:05 [Bootstrap] ReturnValueHandler registration',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor registration started',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor TxInterceptor created from container.',
    '2026/01/20 19:20:05 [Container] Resolve request : *interceptor.TxInterceptor',
    '2026/01/20 19:20:05 [Container] Resolve request : *bun.DB',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor *cors.CORSInterceptor used from instance.',
    '2026/01/20 19:20:05 [Bootstrap] Interceptor *interceptor.LoggingInterceptor used from instance.',
    '2026/01/20 19:20:05 [Bootstrap] HTTP adapter mounted',
    '2026/01/20 19:20:05 [Bootstrap] Server started listening: :8080'
  ]
}

const uiText = {
  ko: {
    prompt: '눈 깜짝하는 사이에 부팅이 끝났습니다.<br>다시 해볼까요?',
    button: '다시 보기'
  },
  en: {
    prompt: 'Boot finished in the blink of an eye.<br>Want to see it again?',
    button: 'Replay'
  }
}

// Current language logs and text
// Default to 'ko' if not found (though 'en' is likely default in many setups, spine docs seem KR focused first)
// However, the user is adding EN now.
const currentLines = computed(() => {
  const currentLang = lang.value || 'ko'
  // Simplified check: if lang starts with 'en', use 'en', else 'ko'
  // Adjust based on strict locale codes if needed (e.g. en-US)
  if (currentLang.startsWith('en')) return logs.en
  return logs.ko
})

const currentUi = computed(() => {
  const currentLang = lang.value || 'ko'
  if (currentLang.startsWith('en')) return uiText.en
  return uiText.ko
})


const visibleLines = ref<string[]>([])
const isFinished = ref(false)

const startAnimation = () => {
  visibleLines.value = [] // Reset
  isFinished.value = false
  
  const lines = currentLines.value
  const startTime = performance.now()
  const duration = 200 // 0.2 seconds
  const totalLines = lines.length

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // Calculate how many lines strictly based on progress
    const linesToShow = Math.floor(totalLines * progress)
    
    visibleLines.value = lines.slice(0, linesToShow)

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      isFinished.value = true
      visibleLines.value = lines
    }
  }

  requestAnimationFrame(animate)
}

// Watch for lang changes to restart/reset if user switches language while sticking on the component (rare in MPA but possible in SPA nav)
watch(lang, () => {
    // Reset on lang change
    visibleLines.value = []
    isFinished.value = false
    // Auto-start again? Or wait for intersection?
    // Let's just leave it blank or restart.
    // For now, let's just reset.
})

onMounted(() => {
  // Use Intersection Observer to start animation when visible
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      startAnimation()
      observer.disconnect() 
    }
  }, { threshold: 0.5 })
  
  const el = document.querySelector('.terminal-boot')
  if (el) observer.observe(el)
})

</script>

<template>
  <div class="terminal-boot window">
    <div class="title-bar">
      <div class="buttons">
        <div class="mac-btn close"></div>
        <div class="mac-btn minimize"></div>
        <div class="mac-btn maximize"></div>
      </div>
      <div class="title">zsh — 80x24</div>
    </div>
    <div class="content">
      <div class="command-line">
        <span class="prompt">➜  spine-app </span>
        <span class="command">go run .</span>
      </div>
      <div v-for="(line, index) in visibleLines" :key="index" class="line" :class="{ 'ascii-art': index < 6, 'log-line': index >= 6 }">
        {{ line }}
      </div>
      <div v-if="isFinished" class="cursor-line">
         <span class="prompt">➜  spine-app </span><span class="cursor">█</span>
      </div>
    </div>
  </div>
  
  <div class="replay-container" v-if="isFinished">
    <p class="replay-text" v-html="currentUi.prompt"></p>
    <button @click="startAnimation" class="replay-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="refresh-icon"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
      {{ currentUi.button }}
    </button>
  </div>
</template>

<style scoped>
.window {
  background: #1e1e1e;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
  color: #f0f0f0;
  margin: 20px 0;
  max-width: 100%;
}

.title-bar {
  background: #2d2d2d;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  position: relative;
}

.buttons {
  display: flex;
  gap: 6px;
}

.mac-btn {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.close { background: #ff5f56; }
.minimize { background: #ffbd2e; }
.maximize { background: #27c93f; }

.title {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  color: #999;
  font-size: 12px;
  pointer-events: none;
}

.content {
  padding: 12px;
  min-height: 300px;
}

.command-line {
  margin-bottom: 8px;
}

.prompt {
  color: #27c93f;
  font-weight: bold;
}

.command {
  color: #fff;
}

.line {
  white-space: pre-wrap;
  word-break: break-all;
}

.ascii-art {
  color: #569cd6; /* VS Code blue-ish */
  line-height: 1.2;
}

.log-line {
  color: #cccccc;
}

.cursor {
  animation: blink 1s step-end infinite;
}


@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.replay-container {
  text-align: center;
  margin-top: -10px;
  margin-bottom: 30px;
  animation: fadeIn 0.5s ease-in-out;
}

.replay-text {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  margin-bottom: 12px;
  line-height: 1.5;
}

.replay-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: var(--vp-c-brand-1);
  color: white;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.replay-btn:hover {
  background-color: var(--vp-c-brand-2);
  transform: translateY(-1px);
}

.replay-btn:active {
  transform: translateY(0);
}

.refresh-icon {
  width: 16px;
  height: 16px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .window {
    font-size: 10px;
    margin: 16px -16px; /* Break out of container padding slightly or just reduce margin */
    /* Actually better not to use negative margins unless sure about parent */
    margin: 10px 0;
    border-radius: 4px;
  }
  
  .content {
    min-height: 200px;
    padding: 8px;
  }
  
  .title-bar {
    padding: 6px 8px;
  }
  
  .mac-btn {
    width: 10px;
    height: 10px;
  }
  
  .title {
    font-size: 10px;
  }
  
  /* Log lines modification for mobile? 
     Maybe reduce line-height further? */
  .line {
    line-height: 1.3;
  }
}
</style>
