<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  html: string;
}>();

const containerRef = ref<HTMLElement | null>(null);

useMermaidRenderer(containerRef, computed(() => props.html));

defineExpose({ container: containerRef });
</script>

<template>
  <div ref="containerRef" v-bind="$attrs" v-html="html" />
</template>
