<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isVisible = ref(true)

const closeBanner = () => {
  isVisible.value = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('spine-top-banner-closed', 'true')
  }
}

onMounted(() => {
  if (typeof sessionStorage !== 'undefined') {
    const isClosed = sessionStorage.getItem('spine-top-banner-closed')
    if (isClosed === 'true') {
      isVisible.value = false
    }
  }
})
</script>

<template>
  <div v-if="isVisible" class="top-banner">
    <div class="banner-content">
      <div class="left-section">
        <img src="/lecture-thumb.png" alt="Lecture Thumbnail" class="thumb" />
        <span class="banner-text">
          <span class="tag">NEW</span>
          <span class="title">Spine로 구현하는 게시판 CRUD, 요청 실행 흐름의 모든 것</span>
        </span>
      </div>
      
      <div class="right-section">
        <a href="https://inf.run/dSgBv" target="_blank" class="cta-button">
          강의 보기
          <svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <button class="close-button" @click="closeBanner" aria-label="Close banner">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-banner {
  background: linear-gradient(90deg, #1a1a1a 0%, #2d2d2d 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  position: relative;
  z-index: 100;
  font-size: 14px;
  overflow: hidden;
}

.banner-content {
  max-width: var(--vp-layout-max-width);
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.thumb {
  width: 48px;
  height: 27px; /* 16:9 aspect ratio roughly */
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.1);
}

.banner-text {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag {
  background: #3eaf7c;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.title {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.right-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.cta-button {
  background: white;
  color: #1a1a1a;
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cta-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  background: #f0f0f0;
}

.arrow-icon {
  transition: transform 0.2s ease;
}

.cta-button:hover .arrow-icon {
  transform: translateX(2px);
}

.close-button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

@media (max-width: 768px) {
  .banner-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 16px 20px;
    padding-right: 48px; /* close button space */
  }
  
  .banner-text {
    flex-wrap: wrap;
    gap: 8px;
    white-space: normal;
    line-height: 1.5;
  }
  
  .right-section {
    width: 100%;
    margin-top: 4px;
  }

  .cta-button {
    width: 100%;
    justify-content: center;
    padding: 10px 16px;
  }
  
  .close-button {
    position: absolute;
    top: 12px;
    right: 12px;
  }
}
</style>
