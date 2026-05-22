<script setup lang="ts">
import { useActiveRoute } from "@/composables/useActiveRoute";
const { isActive } = useActiveRoute();

const props = defineProps({
  id: {
    type: String,
    default: "",
  },
  destination: {
    type: String,
    default: "#",
  },
  name: {
    type: String,
    default: "",
  },
});

const linkClass = computed((): string => {
  const hover = isActive(props.destination || "")
    ? "bg-white-50 text-primary-700 border border-primary-700"
    : "hover:bg-gray-100";
  return `py-2 px-3 space-x-3 flex items-center rounded-md transition ${hover}`;
});
</script>

<template>
  <nuxt-link :id="props.id" :to="props.destination" :class="linkClass">
    <slot name="icon" />
    <span class="font-medium text-base">{{ props.name }}</span>
  </nuxt-link>
</template>

<style scoped></style>
