<script setup lang="ts">
import { usePageStore } from "~/store/page";

const $page = usePageStore();

  const updateHead = (title: string) => {
    useHead({
      title: title ? `${title} · Orbit Docs` : "Orbit Docs",
    });
  };

watch(
  () => $page.title,
  (val) => {
    updateHead(val);
  }
);
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.25s;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}

.layout-enter-active,
.layout-leave-active {
  transition: all 0.4s;
}

.layout-enter-from,
.layout-leave-to {
  opacity: 0;
  transform: translate(-50px, 0);
}
</style>
