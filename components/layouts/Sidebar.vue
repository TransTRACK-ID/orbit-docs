<script setup lang="ts">
import { sidebarMenu } from "@/constant/sidebar";

const route = useRoute();

const isActive = (path: string) => route.path === path || route.path.startsWith(path + "/");
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        <path d="M2 12h20"/>
      </svg>
      Orbit Docs
    </div>

    <nav class="sidebar-nav">
      <div class="nav-group">
        <div class="nav-group-title">Workspace</div>
        <NuxtLink
          v-for="item in sidebarMenu.filter(i => i.id !== 'menu__settings')"
          :key="item.id"
          :to="item.route"
          class="nav-item"
          :class="{ active: isActive(item.route || '') }"
        >
          <component :is="item.icon" size="16" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>

      <div class="nav-group" style="margin-top: auto;">
        <div class="nav-group-title">Account</div>
        <NuxtLink
          v-for="item in sidebarMenu.filter(i => i.id === 'menu__settings')"
          :key="item.id"
          :to="item.route"
          class="nav-item"
          :class="{ active: isActive(item.route || '') }"
        >
          <component :is="item.icon" size="16" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--surface, oklch(100% 0 0));
  border-right: 1px solid var(--border, oklch(90% 0.006 250));
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 24px;
  font-family: var(--font-display, -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif);
  font-size: 18px;
  font-weight: 600;
  border-bottom: 1px solid var(--border, oklch(90% 0.006 250));
  margin-bottom: 12px;
  color: var(--fg, oklch(20% 0.02 250));
}
.sidebar-brand svg {
  color: var(--accent, oklch(55% 0.16 25));
  flex-shrink: 0;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.nav-group {
  padding: 8px 0;
}
.nav-group-title {
  padding: 8px 20px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted, oklch(55% 0.015 250));
  font-weight: 500;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  margin: 2px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--muted, oklch(55% 0.015 250));
  transition: background .1s cubic-bezier(.4,0,.2,1), color .1s cubic-bezier(.4,0,.2,1);
  text-decoration: none;
}
.nav-item:hover {
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
  color: var(--fg, oklch(20% 0.02 250));
}
.nav-item.active {
  background: var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
  color: var(--accent, oklch(55% 0.16 25));
  font-weight: 500;
}
.nav-item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.nav-item:focus-visible {
  outline: 2px solid var(--accent, oklch(55% 0.16 25));
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
