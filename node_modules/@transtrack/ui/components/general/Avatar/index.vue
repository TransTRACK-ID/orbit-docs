<script setup lang="ts">
import User from '~/components/icons/User/index.vue';
const props = defineProps({
  src: {
    type: [String, Object as () => null],
    default: null
  }
})
</script>

<template>
  <div>
    <div v-if="props.src" class="w-10 h-10 rounded-full bg-center bg-cover" :style="`background-image: url(${props.src})`"/>
    <div v-else class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-300">
      <slot name="placeholder"/>
      <User v-if="!$slots.placeholder" class="stroke-white"/>
    </div>
  </div>
</template>

<style scoped>

</style>