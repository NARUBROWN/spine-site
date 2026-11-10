<script setup lang="ts">
import { withBase } from 'vitepress'

withDefaults(defineProps<{ variant?: 'dark' | 'mint' }>(), { variant: 'dark' })
</script>

<template>
  <img class="spine-cloud-brand" :src="withBase(`/spine-cloud/spinecloud-logo-horizontal-${variant}.svg`)"
    width="832" height="180" alt="Spine Cloud" loading="lazy">
</template>

<style scoped>
.spine-cloud-brand { display: block; width: 220px; max-width: 100%; height: auto; }
</style>
