<script setup>
</script>

<template>
  <div class="framework-tabs">
    <slot name="spine" />
    <slot name="nestjs" />
    <slot name="spring" />
  </div>
</template>

<style scoped>
/* Basic styling to prevent layout break */
.framework-tabs {
  margin-top: 2rem;
}
</style>
