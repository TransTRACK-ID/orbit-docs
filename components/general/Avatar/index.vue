<script setup lang="ts">
import User from '~/components/icons/User/index.vue';

const props = defineProps({
  src: {
    type: [String, Object as () => null],
    default: null
  },
  size: {
    type: Number,
    default: 40
  },
  name: {
    type: String,
    default: ""
  }
});

const sizeStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(10, props.size * 0.4)}px`
}));

const initials = computed(() => {
  if (!props.name) return "";
  return props.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});
</script>

<template>
  <div>
    <div
      v-if="props.src"
      class="rounded-full bg-center bg-cover"
      :style="[sizeStyle, { backgroundImage: `url(${props.src})` }]"
    />
    <div
      v-else
      class="rounded-full flex items-center justify-center font-semibold"
      :class="[initials ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--fg-soft)] text-[var(--fg)]']"
      :style="sizeStyle"
    >
      <slot name="placeholder"/>
      <template v-if="!$slots.placeholder">
        <span v-if="initials">{{ initials }}</span>
        <User v-else :size="String(Math.max(12, props.size * 0.5))" />
      </template>
    </div>
  </div>
</template>

<style scoped>
</style>