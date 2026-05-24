<script setup lang="ts">
import { usePageStore } from "~/store/page";

const $page = usePageStore();
const { workspace, fetchWorkspace } = useSettings();

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

function applyTheme(theme: string | undefined) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else if (theme === "light") {
    html.classList.remove("dark");
  } else if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.classList.toggle("dark", prefersDark);
  } else {
    html.classList.remove("dark");
  }
}

watch(() => workspace.value?.theme, applyTheme, { immediate: true });

onMounted(() => {
  fetchWorkspace();

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", (e) => {
    if (workspace.value?.theme === "system") {
      document.documentElement.classList.toggle("dark", e.matches);
    }
  });
});
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
