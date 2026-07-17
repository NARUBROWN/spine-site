<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { lang, page } = useData()

const isHome = computed(() => /^(?:[a-z-]+\/)?index\.md$/.test(page.value.relativePath))

const currentLang = computed(() => {
  if (lang.value === 'ko') return 'ko'
  if (lang.value === 'ja') return 'ja'
  if (lang.value === 'zh-CN') return 'zhHans'
  if (lang.value === 'zh-TW') return 'zhHant'
  return 'en'
})

const content = computed(() => {
  return locales[currentLang.value]
})

const locales = {
  ko: {
    description: '요청 과정을 숨기지 않는 프레임워크.',
    columns: [
      {
        title: '제품',
        items: [
          { text: '소개', link: '/ko/learn/getting-started/intro' }
        ]
      },
      {
        title: '리소스',
        items: [
          { text: '문서', link: '/ko/learn/getting-started/intro' },
          { text: '가이드', link: '/ko/learn/tutorial/1-project-structure' },
          { text: '변경 이력', link: '/ko/community/changelog' }
        ]
      },
      {
        title: '약관',
        items: [
          { text: '개인정보 처리방침', link: '#' },
          { text: '이용약관', link: '#' },
          { text: '보안', link: '#' }
        ]
      }
    ],
    copyright: '© 2026 김원정. All rights reserved.',
    tagline: '세상의 모든 개발자들을 위해 만들었습니다.'
  },
  en: {
    description: "A framework that doesn't hide the request process.",
    columns: [
      {
        title: 'Product',
        items: [
          { text: 'Intro', link: '/en/learn/getting-started/intro' }
        ]
      },
      {
        title: 'Resources',
        items: [
          { text: 'Docs', link: '/en/learn/getting-started/intro' },
          { text: 'Guides', link: '/en/tutorial/1-project-structure' },
          { text: 'Changelog', link: '/en/community/changelog' }
        ]
      },
      {
        title: 'Legal',
        items: [
          { text: 'Privacy Policy', link: '#' },
          { text: 'Terms of Service', link: '#' },
          { text: 'Security', link: '#' }
        ]
      }
    ],
    copyright: '© 2026 김원정. All rights reserved.',
    tagline: 'Made for all developers in the world.'
  },
  ja: {
    description: 'リクエストの処理過程を隠さないフレームワーク。',
    columns: [
      {
        title: '製品',
        items: [
          { text: '紹介', link: '/ja/learn/getting-started/intro' }
        ]
      },
      {
        title: 'リソース',
        items: [
          { text: 'ドキュメント', link: '/ja/learn/getting-started/intro' },
          { text: 'ガイド', link: '/ja/learn/tutorial/1-project-structure' },
          { text: '変更履歴', link: '/ja/community/changelog' }
        ]
      },
      {
        title: '規約',
        items: [
          { text: '個人情報保護方針', link: '#' },
          { text: '利用規約', link: '#' },
          { text: 'セキュリティ', link: '#' }
        ]
      }
    ],
    copyright: '© 2026 Wonjeong Kim. All rights reserved.',
    tagline: '世界中のすべての開発者のために作りました。'
  },
  zhHans: {
    description: '不隐藏请求流程的框架。',
    columns: [
      { title: '产品', items: [{ text: '简介', link: '/zh-Hans/learn/getting-started/intro' }] },
      { title: '资源', items: [
        { text: '文档', link: '/zh-Hans/learn/getting-started/intro' },
        { text: '教程', link: '/zh-Hans/learn/tutorial/1-project-structure' },
        { text: '更新日志', link: '/zh-Hans/community/changelog' }
      ] },
      { title: '法律信息', items: [
        { text: '隐私政策', link: '#' }, { text: '服务条款', link: '#' }, { text: '安全', link: '#' }
      ] }
    ],
    copyright: '© 2026 Wonjeong Kim. 保留所有权利。',
    tagline: '为世界各地的开发者打造。'
  },
  zhHant: {
    description: '不隱藏請求流程的框架。',
    columns: [
      { title: '產品', items: [{ text: '簡介', link: '/zh-Hant/learn/getting-started/intro' }] },
      { title: '資源', items: [
        { text: '文件', link: '/zh-Hant/learn/getting-started/intro' },
        { text: '教學', link: '/zh-Hant/learn/tutorial/1-project-structure' },
        { text: '更新日誌', link: '/zh-Hant/community/changelog' }
      ] },
      { title: '法律資訊', items: [
        { text: '隱私權政策', link: '#' }, { text: '服務條款', link: '#' }, { text: '安全性', link: '#' }
      ] }
    ],
    copyright: '© 2026 Wonjeong Kim. 保留所有權利。',
    tagline: '為世界各地的開發者打造。'
  }
}
</script>

<template>
  <footer v-if="isHome" class="custom-footer">
    <div class="footer-container">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="logo">
            <a :href="`/${currentLang}/`" class="logo-link">
              <img src="/header_logo.png" alt="Spine" class="footer-logo" />
            </a>
          </div>
          <p class="description">{{ content.description }}</p>
        </div>
        
        <div v-for="col in content.columns" :key="col.title" class="footer-column">
          <h3 class="column-title">{{ col.title }}</h3>
          <ul class="column-list">
            <li v-for="item in col.items" :key="item.text">
              <a :href="item.link" class="footer-link">{{ item.text }}</a>
            </li>
          </ul>
        </div>
      </div>
      
      <div class="footer-divider"></div>
      
      <div class="footer-bottom">
        <span class="copyright">{{ content.copyright }}</span>
        <span class="tagline">{{ content.tagline }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.custom-footer {
  background-color: #0f0f11;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  color: #a1a1a5;
  padding: 4rem 2rem 3rem 2rem;
  font-family: var(--vp-font-family-base);
  position: relative;
  z-index: 12;
}

.footer-container {
  max-width: 1152px;
  margin: 0 auto;
}

.footer-top {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 2.5rem;
}

.footer-brand {
  /* Grid column sizing handles the width layout */
}

.logo {
  margin-bottom: 1.2rem;
}

.logo-link {
  display: inline-block;
  text-decoration: none;
}

.footer-logo {
  height: 24px;
  display: block;
  filter: brightness(0) invert(1);
}

.description {
  font-size: 14px;
  line-height: 1.6;
  max-width: 320px;
}

.footer-column {
  min-width: 120px;
}

.column-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 1.2rem;
  letter-spacing: -0.2px;
}

.column-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.column-list li {
  margin-bottom: 0.8rem;
}

.footer-link {
  font-size: 14px;
  color: #a1a1a5;
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: var(--vp-c-brand-1);
}

.footer-divider {
  height: 1px;
  background-color: rgba(255, 255, 255, 0.05);
  margin: 3rem 0 1.5rem 0;
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #66666a;
  flex-wrap: wrap;
  gap: 1rem;
}

@media (max-width: 768px) {
  .footer-top {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  
  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
