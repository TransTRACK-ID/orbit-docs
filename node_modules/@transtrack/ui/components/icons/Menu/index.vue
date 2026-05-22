<script setup lang="ts">
const props = defineProps({
  size: {
    type: String,
    default: '24'
  }
})
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :width="props.size" :height="props.size" viewBox="0 0 24 24" fill="none">
    <path d="M3 12H21M3 6H21M3 18H21" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</template>

<style scoped>

</style>