<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { documentationSections, siteLocale } from '../../navigation'

const { page } = useData()
const sections = computed(() => documentationSections(siteLocale(page.value.relativePath)))
</script>

<template>
  <div class="documentation-map">
    <section v-for="section in sections" :key="section.id" :aria-labelledby="`map-${section.id}`">
      <h2 :id="`map-${section.id}`">{{ section.text }}</h2>
      <ul>
        <li v-for="item in section.items" :key="item.link">
          <a :href="item.link">{{ item.text }}</a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.documentation-map {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px 48px;
  margin-top: 36px;
}

.documentation-map section {
  min-width: 0;
}

.documentation-map h2 {
  margin-top: 0;
}

.documentation-map ul {
  margin-bottom: 0;
}

@media (max-width: 767px) {
  .documentation-map {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
</style>
