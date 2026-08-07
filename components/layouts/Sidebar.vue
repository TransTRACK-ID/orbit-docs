<script setup lang="ts">
import { sidebarMenu } from "@/constant/sidebar";

const route = useRoute();
const { workspace } = useSettings();
const { data } = useAuth();
const { can, syncFromCurrentMember, isSuperAdmin, role } = usePermissions();

function canViewNavItem(item: (typeof sidebarMenu)[number]) {
  if (!item.permission) return true;
  return can(item.permission as any);
}

const workspaceNavItems = computed(() =>
  sidebarMenu.filter(
    (item) =>
      item.id !== "menu__settings" &&
      item.id !== "menu__changelogs" &&
      canViewNavItem(item)
  )
);

const canViewSettings = computed(() =>
  sidebarMenu.some((item) => item.id === "menu__settings" && canViewNavItem(item))
);

const isActive = (path: string) => route.path === path || route.path.startsWith(path + "/");

const user = computed(() => {
  const d = data.value as any;
  if (d?.id || d?.email) {
    return d;
  }
  return d?.data?.user || d?.user || null;
});

const userName = computed(() => user.value?.name || "");
const userEmail = computed(() => user.value?.email || "");
const roleLabel = computed(() => {
  if (isSuperAdmin.value) return "Super Admin";
  if (role.value) return role.value.replace(/_/g, " ");
  return "";
});

const isMobileOpen = ref(false);
const firstNavLinkRef = ref<HTMLAnchorElement | null>(null);

const MOBILE_BREAKPOINT = 768;

function openMobile() {
  isMobileOpen.value = true;
  document.body.style.overflow = "hidden";
  nextTick(() => {
    firstNavLinkRef.value?.focus();
  });
}

function closeMobile() {
  isMobileOpen.value = false;
  document.body.style.overflow = "";
}

function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape" && isMobileOpen.value) {
    closeMobile();
  }
}

function onResize() {
  if (window.innerWidth > MOBILE_BREAKPOINT && isMobileOpen.value) {
    closeMobile();
  }
}

const isCollapsed = ref(false);
const isMobileViewport = ref(false);

function updateViewport() {
  isMobileViewport.value = window.innerWidth <= MOBILE_BREAKPOINT;
}

const showCollapsedRail = computed(
  () => isCollapsed.value && !isMobileViewport.value
);

onMounted(() => {
  syncFromCurrentMember();
  window.addEventListener("keydown", onEscape);
  window.addEventListener("resize", onResize);
  updateViewport();
  window.addEventListener("resize", updateViewport);

  const saved = localStorage.getItem("sidebar-collapsed");
  if (saved !== null) {
    isCollapsed.value = saved === "true";
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onEscape);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("resize", updateViewport);
  document.body.style.overflow = "";
});

watch(() => route.path, () => {
  if (isMobileOpen.value) closeMobile();
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  localStorage.setItem("sidebar-collapsed", String(isCollapsed.value));
}
</script>

<template>
  <button
    class="mobile-nav-toggle"
    aria-label="Open navigation"
    :aria-expanded="isMobileOpen"
    @click="openMobile"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  </button>

  <div
    v-if="isMobileOpen"
    class="sidebar-backdrop"
    aria-hidden="true"
    @click="closeMobile"
  />

  <aside
    class="sidebar"
    :class="{ 'sidebar--mobile-open': isMobileOpen, 'sidebar--collapsed': isCollapsed }"
  >
    <header class="sidebar-header">
      <button
        class="mobile-close-btn"
        aria-label="Close navigation"
        @click="closeMobile"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div class="brand-lockup">
        <img
          v-if="workspace?.logoUrl"
          :src="workspace.logoUrl"
          alt="Workspace logo"
          class="workspace-logo"
        />
        <svg
          v-else
          class="brand-mark"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
        <span class="brand-text">{{ workspace?.name || "Orbit Docs" }}</span>
      </div>

      <button
        class="sidebar-collapse-toggle"
        :class="{ 'is-collapsed': isCollapsed }"
        :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="toggleCollapse"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
    </header>

    <nav class="sidebar-nav" aria-label="Main navigation">
      <NuxtLink
        v-for="(item, idx) in workspaceNavItems"
        :key="item.id"
        ref="(el: any) => { if (idx === 0) firstNavLinkRef = el }"
        :to="item.route"
        class="nav-item"
        :class="{ active: isActive(item.route || '') }"
        :title="isCollapsed ? item.label : undefined"
        :aria-label="isCollapsed ? item.label : undefined"
      >
        <span class="nav-icon" aria-hidden="true">
          <component :is="item.icon" size="18" />
        </span>
        <span class="nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <footer v-if="user" class="sidebar-footer">
      <div v-if="showCollapsedRail" class="footer-rail">
        <NuxtLink
          v-if="canViewSettings"
          to="/settings?tab=profile"
          class="rail-btn"
          :class="{ active: isActive('/settings') }"
          title="Profile & settings"
          aria-label="Profile and settings"
        >
          <IconsSettings size="18" />
        </NuxtLink>
        <NuxtLink
          to="/settings?tab=profile"
          class="rail-avatar"
          :title="userName"
          aria-label="Open profile"
        >
          <general-avatar :src="null" :size="32" :name="userName" />
        </NuxtLink>
      </div>

      <div v-else class="profile-card">
          <NuxtLink to="/settings?tab=profile" class="profile-card-link" aria-label="Open profile">
            <general-avatar :src="null" :size="36" :name="userName" />
            <div class="profile-meta">
              <div class="profile-name">{{ userName }}</div>
              <div v-if="roleLabel" class="profile-badge">{{ roleLabel }}</div>
              <div v-if="userEmail" class="profile-email">{{ userEmail }}</div>
            </div>
          </NuxtLink>
          <div class="profile-actions">
            <NuxtLink
              v-if="canViewSettings"
              to="/settings?tab=profile"
              class="icon-btn"
              :class="{ active: isActive('/settings') }"
              aria-label="Profile and settings"
              title="Profile and settings"
            >
              <IconsSettings size="18" />
            </NuxtLink>
          </div>
        </div>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  --sb-space-1: 8px;
  --sb-space-2: 12px;
  --sb-space-3: 16px;
  --sb-space-4: 24px;
  --sb-width-expanded: 260px;
  --sb-width-collapsed: 64px;
  --sb-item-height: 40px;
  --sb-icon-size: 18px;
  --sb-radius: var(--radius, 8px);
  --sb-ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --sb-ease-snap: cubic-bezier(0.22, 1, 0.36, 1);
  --sb-duration-fast: 150ms;
  --sb-duration-med: 220ms;
  --sb-duration-drawer: 250ms;

  width: var(--sb-width-expanded);
  flex-shrink: 0;
  background: var(--surface, oklch(100% 0 0));
  border-right: 1px solid var(--border, oklch(90% 0.006 250));
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  height: 100vh;
  position: sticky;
  top: 0;
  align-self: flex-start;
  overflow: hidden;
  transition: width var(--sb-duration-med) var(--sb-ease-out);
}

.mobile-nav-toggle {
  display: none;
  position: fixed;
  top: var(--sb-space-3);
  left: var(--sb-space-3);
  z-index: 40;
  width: 40px;
  height: 40px;
  border-radius: var(--sb-radius);
  border: 1px solid var(--border, oklch(90% 0.006 250));
  background: var(--surface, oklch(100% 0 0));
  color: var(--fg, oklch(20% 0.02 250));
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background var(--sb-duration-fast) var(--sb-ease-out),
    transform 100ms var(--sb-ease-snap);
}

.mobile-nav-toggle:active {
  transform: scale(0.96);
}

.mobile-nav-toggle:hover {
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}

.mobile-nav-toggle:focus-visible,
.sidebar-collapse-toggle:focus-visible,
.icon-btn:focus-visible,
.rail-btn:focus-visible,
.nav-item:focus-visible {
  outline: 2px solid var(--accent, oklch(55% 0.16 25));
  outline-offset: 2px;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 48;
  background: color-mix(in oklch, oklch(20% 0.02 250) 40%, transparent);
  animation: backdrop-in var(--sb-duration-drawer) var(--sb-ease-out) both;
}

@keyframes backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: var(--sb-space-2);
  min-height: 56px;
  padding: var(--sb-space-3) var(--sb-space-3) var(--sb-space-2);
  flex-shrink: 0;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.brand-mark,
.workspace-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.brand-mark {
  color: var(--accent, oklch(55% 0.16 25));
}

.workspace-logo {
  object-fit: contain;
  border-radius: 6px;
}

.brand-text {
  font-family: var(--font-display, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--fg, oklch(20% 0.02 250));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--sb-duration-med) var(--sb-ease-out),
    max-width var(--sb-duration-med) var(--sb-ease-out),
    transform var(--sb-duration-med) var(--sb-ease-out);
}

.sidebar-collapse-toggle,
.mobile-close-btn,
.icon-btn,
.rail-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted, oklch(55% 0.015 250));
  cursor: pointer;
  transition:
    color var(--sb-duration-fast) var(--sb-ease-out),
    background var(--sb-duration-fast) var(--sb-ease-out),
    transform 100ms var(--sb-ease-snap);
}

.sidebar-collapse-toggle svg {
  transition: transform var(--sb-duration-med) var(--sb-ease-out);
}

.sidebar-collapse-toggle.is-collapsed svg {
  transform: scaleX(-1);
}

.sidebar-collapse-toggle:active,
.icon-btn:active,
.rail-btn:active,
.mobile-close-btn:active {
  transform: scale(0.94);
}

.sidebar-collapse-toggle {
  width: var(--sb-item-height);
  height: var(--sb-item-height);
  border-radius: var(--sb-radius);
  flex-shrink: 0;
}

.sidebar-collapse-toggle:hover,
.icon-btn:hover,
.rail-btn:hover {
  color: var(--fg, oklch(20% 0.02 250));
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}

.mobile-close-btn {
  display: none;
  width: 32px;
  height: 32px;
  border-radius: var(--sb-radius);
  margin-right: var(--sb-space-1);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--sb-space-1) var(--sb-space-2);
  scrollbar-gutter: stable;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sb-space-2);
  min-height: var(--sb-item-height);
  padding: 0 var(--sb-space-2);
  border-radius: var(--sb-radius);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--muted, oklch(55% 0.015 250));
  text-decoration: none;
  transition:
    background var(--sb-duration-fast) var(--sb-ease-out),
    color var(--sb-duration-fast) var(--sb-ease-out),
    transform 100ms var(--sb-ease-snap);
}

.nav-item:active {
  transform: scale(0.98);
}

.nav-item:hover {
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
  color: var(--fg, oklch(20% 0.02 250));
}

.nav-item.active {
  background: var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
  color: var(--accent, oklch(55% 0.16 25));
}

.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-icon :deep(svg) {
  width: var(--sb-icon-size);
  height: var(--sb-icon-size);
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--sb-duration-med) var(--sb-ease-out),
    max-width var(--sb-duration-med) var(--sb-ease-out),
    transform var(--sb-duration-med) var(--sb-ease-out);
}

.sidebar-footer {
  padding: var(--sb-space-2) var(--sb-space-2) var(--sb-space-3);
  border-top: 1px solid var(--border, oklch(90% 0.006 250));
  flex-shrink: 0;
}

.footer-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sb-space-2);
}

.rail-btn {
  width: var(--sb-item-height);
  height: var(--sb-item-height);
  border-radius: var(--sb-radius);
  text-decoration: none;
}

.rail-btn.active {
  background: var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
  color: var(--accent, oklch(55% 0.16 25));
}

.profile-card {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--sb-space-2);
  padding: var(--sb-space-1) var(--sb-space-1);
}

.profile-card-link {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--sb-space-2);
  min-width: 0;
  text-decoration: none;
  color: inherit;
  border-radius: var(--sb-radius);
  transition: background var(--sb-duration-fast) var(--sb-ease-out);
}

.profile-card-link:hover {
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}

.profile-card-link:focus-visible {
  outline: 2px solid var(--accent, oklch(55% 0.16 25));
  outline-offset: 2px;
}

.rail-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sb-space-1) 0;
  border-radius: var(--sb-radius);
  text-decoration: none;
  transition: background var(--sb-duration-fast) var(--sb-ease-out);
}

.rail-avatar:hover {
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}

.rail-avatar:focus-visible {
  outline: 2px solid var(--accent, oklch(55% 0.16 25));
  outline-offset: 2px;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.profile-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--fg, oklch(20% 0.02 250));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 8%, transparent));
  color: var(--muted, oklch(55% 0.015 250));
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: capitalize;
}

.profile-email {
  font-size: 11px;
  line-height: 1.4;
  color: var(--muted, oklch(55% 0.015 250));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--sb-radius);
  text-decoration: none;
}

.icon-btn.active {
  background: var(--accent-soft, color-mix(in oklch, oklch(55% 0.16 25) 12%, transparent));
  color: var(--accent, oklch(55% 0.16 25));
}

.sidebar--collapsed {
  --sb-rail-track: var(--sb-item-height);
  width: var(--sb-width-collapsed);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar--collapsed .sidebar-header {
  flex-direction: column;
  align-items: center;
  gap: var(--sb-space-2);
  width: var(--sb-rail-track);
  padding: var(--sb-space-3) 0 var(--sb-space-2);
  min-height: auto;
  box-sizing: border-box;
  flex-shrink: 0;
}

.sidebar--collapsed .brand-lockup {
  flex: 0;
  justify-content: center;
  align-items: center;
  gap: 0;
  width: var(--sb-rail-track);
  height: var(--sb-rail-track);
}

.sidebar--collapsed .sidebar-collapse-toggle {
  margin: 0;
}

.sidebar--collapsed .brand-text,
.sidebar--collapsed .nav-label {
  display: none;
}

.sidebar--collapsed .sidebar-nav {
  flex: 1;
  min-height: 0;
  width: var(--sb-rail-track);
  padding: var(--sb-space-1) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: unset;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sidebar--collapsed .sidebar-nav::-webkit-scrollbar {
  display: none;
}

.sidebar--collapsed .nav-item {
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  gap: 0;
  width: var(--sb-rail-track);
  height: var(--sb-rail-track);
  min-width: var(--sb-rail-track);
  max-width: var(--sb-rail-track);
  padding: 0;
  margin: 0;
}

.sidebar--collapsed .nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--sb-rail-track);
  height: var(--sb-rail-track);
}

.sidebar--collapsed .nav-icon :deep(svg) {
  width: var(--sb-icon-size);
  height: var(--sb-icon-size);
}

.sidebar--collapsed .sidebar-footer {
  width: var(--sb-rail-track);
  padding: var(--sb-space-2) 0 var(--sb-space-3);
  box-sizing: border-box;
  flex-shrink: 0;
}

.sidebar--collapsed .footer-rail {
  width: var(--sb-rail-track);
  margin: 0;
  align-items: center;
}

.sidebar--collapsed .rail-btn {
  flex-shrink: 0;
}

.sidebar--collapsed .rail-avatar {
  width: var(--sb-rail-track);
  height: var(--sb-rail-track);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .mobile-nav-toggle {
    display: inline-flex;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 50;
    width: min(88vw, 300px);
    transform: translateX(-100%);
    transition: transform var(--sb-duration-drawer) var(--sb-ease-out);
    box-shadow: 4px 0 24px color-mix(in oklch, oklch(20% 0.02 250) 12%, transparent);
    border-right: none;
  }

  .sidebar--mobile-open {
    transform: translateX(0);
    will-change: transform;
  }

  .sidebar--collapsed {
    width: min(88vw, 300px);
    display: grid;
    align-items: stretch;
    justify-items: stretch;
  }

  .sidebar--collapsed .brand-text,
  .sidebar--collapsed .nav-label {
    display: block;
  }

  .sidebar--collapsed .sidebar-header,
  .sidebar--collapsed .sidebar-nav,
  .sidebar--collapsed .sidebar-footer {
    width: auto;
    padding-left: var(--sb-space-3);
    padding-right: var(--sb-space-3);
    flex: unset;
  }

  .sidebar--collapsed .sidebar-nav {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    scrollbar-gutter: stable;
    scrollbar-width: auto;
    -ms-overflow-style: auto;
  }

  .sidebar--collapsed .sidebar-nav::-webkit-scrollbar {
    display: block;
  }

  .sidebar--collapsed .nav-item {
    width: auto;
    height: auto;
    min-width: 0;
    max-width: none;
    justify-content: flex-start;
    padding: 0 var(--sb-space-2);
  }

  .sidebar--collapsed .nav-icon {
    width: 20px;
    height: 20px;
  }

  .sidebar--collapsed .footer-rail {
    width: auto;
  }

  .sidebar--collapsed .rail-avatar {
    width: auto;
    height: auto;
  }

  .sidebar--collapsed .sidebar-header {
    flex-direction: row;
    align-items: center;
    padding: var(--sb-space-3);
    min-height: 56px;
  }

  .sidebar--collapsed .brand-lockup {
    justify-content: flex-start;
  }

  .sidebar--collapsed .nav-item {
    width: auto;
    min-width: 0;
    justify-content: flex-start;
    padding: 0 var(--sb-space-2);
    margin: 0;
  }

  .sidebar--collapsed .sidebar-nav {
    padding: var(--sb-space-1) var(--sb-space-2);
  }

  .mobile-close-btn {
    display: inline-flex;
  }

  .sidebar-collapse-toggle {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .mobile-nav-toggle,
  .brand-text,
  .nav-label,
  .nav-item,
  .sidebar-collapse-toggle,
  .sidebar-collapse-toggle svg,
  .icon-btn,
  .rail-btn,
  .mobile-close-btn {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }

  .sidebar-backdrop {
    animation: none;
  }
}
</style>
