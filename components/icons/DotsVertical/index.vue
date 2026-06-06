<script setup lang="ts">
const props = defineProps({
  size: {
    type: String,
    default: '32'
  }
})
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :width="props.size" :height="props.size" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="6" r="4" fill="currentColor"/>
    <circle cx="16" cy="16" r="4" fill="currentColor"/>
    <circle cx="16" cy="26" r="4" fill="currentColor"/>
  </svg>
</template>

<style scoped>
</style>
