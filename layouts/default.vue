<script setup lang="ts">
import type { DrawerInterface } from "flowbite";

let drawerSidebar: DrawerInterface | null = null;

const windowWidth = ref(0);

const isMdAndUp = computed((): boolean => {
  return windowWidth.value >= 768;
});

function resizeHandler() {
  if (process.client) {
    windowWidth.value = window.innerWidth;
  }
}

watch(isMdAndUp, () => {
  drawerSidebar?.hide();
});

onMounted(() => {
  if (process.client) {
    window.addEventListener("resize", resizeHandler);
    windowWidth.value = window.innerWidth;
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <LayoutsSidebar
      @on-mounted="drawerSidebar = $event"
      @on-click-close-sidebar="drawerSidebar?.hide()"
    />
    <div class="px-6 py-4 md:pl-[340px] min-h-screen w-full">
      <LayoutsHeader />
      <slot />
    </div>
  </div>
</template>
