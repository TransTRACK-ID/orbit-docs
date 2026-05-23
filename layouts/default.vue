<script setup lang="ts">
import { usePageStore } from "~/store/page";
const $page = usePageStore();
</script>

<template>
  <div class="app-shell">
    <LayoutsSidebar />
    <div class="main">
      <LayoutsHeader :title="$page.title" />
      <div class="content">
        <slot />
      </div>
      <footer class="pagefoot">
        <span>Orbit Docs · Internal documentation platform</span>
        <span class="num">v2026.05</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg, oklch(98% 0.004 250));
}
.content {
  padding: 32px;
  flex: 1;
}
.pagefoot {
  padding: 20px 32px;
  color: var(--muted, oklch(55% 0.015 250));
  font-size: 12px;
  border-top: 1px solid var(--border, oklch(90% 0.006 250));
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.num {
  font-family: var(--font-mono, 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 768px) {
  .content {
    padding: 20px;
  }
}
</style>
