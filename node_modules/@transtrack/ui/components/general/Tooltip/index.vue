<script setup lang="ts">
import { initTooltips } from "flowbite";

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: "",
  },
  isVisible: {
    type: Boolean,
    default: true,
  },
});

onMounted(() => {
  initTooltips();
});
</script>

<template>
  <div>
    <div :data-tooltip-target="props.id" class="w-full">
      <slot name="default" />
    </div>

    <div
      v-show="props.isVisible"
      :id="props.id"
      role="tooltip"
      class="absolute z-10 invisible inline-block p-3 transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip"
    >
      <p class="text-xs font-semibold text-white">{{ props.label }}</p>
      <div class="tooltip-arrow" data-popper-arrow></div>
    </div>
  </div>
</template>

<style scoped></style>
