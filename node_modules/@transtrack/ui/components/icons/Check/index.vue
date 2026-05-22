<script setup lang="ts">
const props = defineProps({
  size: {
    type: String,
    default: '24'
  }
})
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" :width="props.size" :height="props.size" viewBox="0 0 20 20" fill="none">
    <path d="M16.6673 5L7.50065 14.1667L3.33398 10" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</template>

<style scoped>

</style>