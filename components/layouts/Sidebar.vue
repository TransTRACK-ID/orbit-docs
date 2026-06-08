<script setup lang="ts">
import { sidebarMenu } from "@/constant/sidebar";
import { useAuthStore } from "~/store/auth";

const route = useRoute();
const { workspace } = useSettings();
const $auth = useAuthStore();
const { data } = useAuth();

const isActive = (path: string) => route.path === path || route.path.startsWith(path + "/");

const user = computed(() => {
  const d = data.value as any;
  // v1.2.0 local provider returns a flat session object directly
  if (d?.id || d?.email) {
    return d;
  }
  // legacy fallback: wrapped response
  return d?.data?.user || d?.user || null;
});

const userName = computed(() => user.value?.name || "");
const userEmail = computed(() => user.value?.email || "");

/* mobile drawer state */
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

function toggleMobile() {
  if (isMobileOpen.value) closeMobile();
  else openMobile();
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

onMounted(() => {
  window.addEventListener("keydown", onEscape);
  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onEscape);
  window.removeEventListener("resize", onResize);
  document.body.style.overflow = "";
});

/* route change closes drawer on mobile */
watch(() => route.path, () => {
  if (isMobileOpen.value) closeMobile();
});

/* collapse state (desktop only) */
const isCollapsed = ref(false);

onMounted(() => {
  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved !== null) {
    isCollapsed.value = saved === 'true';
  }
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
  localStorage.setItem('sidebar-collapsed', String(isCollapsed.value));
}

function logout() {
  $auth.logout().catch(() => {
    // signOut handles navigation; only force-redirect on error
    window.location.href = "/login";
  });
}
</script>

<template>
  <!-- mobile toggle button (fixed, sits on top of content) -->
  <button
    class="mobile-nav-toggle"
    aria-label="Open navigation"
    aria-expanded="false"
    @click="openMobile"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>

  <!-- backdrop -->
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
    <div class="sidebar-brand">
      <button
        class="mobile-close-btn"
        aria-label="Close navigation"
        @click="closeMobile"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <img
        v-if="workspace?.logoUrl"
        :src="workspace.logoUrl"
        alt="Workspace logo"
        class="workspace-logo"
      />
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="22"
        height="22"
      >
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        <path d="M2 12h20"/>
      </svg>
      <span class="brand-text">{{ workspace?.name || "Orbit Docs" }}</span>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-group">
        <div class="nav-group-title">Workspace</div>
        <NuxtLink
          v-for="(item, idx) in sidebarMenu.filter(i => i.id !== 'menu__settings' && i.id !== 'menu__changelogs')"
          :key="item.id"
          ref="(el: any) => { if (idx === 0) firstNavLinkRef = el }"
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

        <div v-if="user" class="sidebar-profile">
          <div class="profile-row">
            <general-avatar :src="null" :size="28" :name="userName" />
            <div class="profile-info">
              <div class="profile-name">{{ userName }}</div>
              <div v-if="userEmail" class="profile-email">{{ userEmail }}</div>
            </div>
          </div>
          <button class="logout-btn" @click="logout">
            <IconsLogout size="16" class="logout-icon" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </nav>

    <button
      class="sidebar-collapse-toggle"
      :aria-label="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggleCollapse"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline v-if="!isCollapsed" points="15 18 9 12 15 6" />
        <polyline v-else points="9 18 15 12 9 6" />
      </svg>
    </button>
  </aside>
</template>

<style scoped>
/* ─── mobile toggle button ─────────────────────────────────────── */
.mobile-nav-toggle {
  display: none;
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 40;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--border, oklch(90% 0.006 250));
  background: var(--surface, oklch(100% 0 0));
  color: var(--fg, oklch(20% 0.02 250));
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.mobile-nav-toggle:hover {
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}
.mobile-nav-toggle:focus-visible {
  outline: 2px solid var(--accent, oklch(55% 0.16 25));
  outline-offset: 2px;
}

/* ─── backdrop ───────────────────────────────────────────────── */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 48;
  background: color-mix(in oklch, oklch(20% 0.02 250) 40%, transparent);
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ─── sidebar ────────────────────────────────────────────────── */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--surface, oklch(100% 0 0));
  border-right: 1px solid var(--border, oklch(90% 0.006 250));
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  overflow-y: auto;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-close-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--muted, oklch(55% 0.015 250));
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  margin-right: 4px;
  flex-shrink: 0;
}
.mobile-close-btn:hover {
  color: var(--fg, oklch(20% 0.02 250));
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}
.mobile-close-btn:focus-visible {
  outline: 2px solid var(--accent, oklch(55% 0.16 25));
  outline-offset: 2px;
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
.workspace-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 4px;
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

.sidebar-profile {
  padding: 12px;
  margin: 8px 12px 0;
  border-radius: 8px;
  border: 1px solid var(--border, oklch(90% 0.006 250));
  background: var(--bg, oklch(98% 0.004 250));
}
.profile-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.profile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}
.profile-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg, oklch(20% 0.02 250));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile-email {
  font-size: 11px;
  color: var(--muted, oklch(55% 0.015 250));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border, oklch(90% 0.006 250));
  background: transparent;
  color: var(--muted, oklch(55% 0.015 250));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  font-family: inherit;
}
.logout-btn:hover {
  color: var(--fg, oklch(20% 0.02 250));
  border-color: var(--fg, oklch(20% 0.02 250));
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}
.logout-icon {
  stroke: currentColor;
  flex-shrink: 0;
}

/* ─── collapse toggle ────────────────────────────────────────── */
.sidebar-collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted, oklch(55% 0.015 250));
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  margin: 8px auto;
  flex-shrink: 0;
  padding: 0;
}
.sidebar-collapse-toggle:hover {
  color: var(--fg, oklch(20% 0.02 250));
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}
.sidebar-collapse-toggle:focus-visible {
  outline: 2px solid var(--accent, oklch(55% 0.16 25));
  outline-offset: 2px;
}

/* ─── collapsed state ────────────────────────────────────────── */
.sidebar--collapsed {
  width: 64px;
  padding: 16px 0;
}
.sidebar--collapsed .sidebar-brand {
  padding: 0 8px 16px;
  justify-content: center;
}
.sidebar--collapsed .brand-text {
  display: none;
}
.sidebar--collapsed .nav-group-title {
  display: none;
}
.sidebar--collapsed .nav-item {
  justify-content: center;
  gap: 0;
  padding: 8px;
  margin: 2px 8px;
}
.sidebar--collapsed .nav-item span {
  display: none;
}
.sidebar--collapsed .sidebar-profile {
  padding: 8px;
  margin: 8px 8px 0;
}
.sidebar--collapsed .profile-row {
  margin-bottom: 8px;
  justify-content: center;
}
.sidebar--collapsed .profile-info {
  display: none;
}
.sidebar--collapsed .logout-btn {
  justify-content: center;
  padding: 8px;
  gap: 0;
}
.sidebar--collapsed .logout-btn span {
  display: none;
}
.sidebar--collapsed .sidebar-collapse-toggle {
  margin: 8px auto;
}

/* ─── mobile breakpoint ──────────────────────────────────────── */
@media (max-width: 768px) {
  .mobile-nav-toggle {
    display: inline-flex;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 24px color-mix(in oklch, oklch(20% 0.02 250) 12%, transparent);
    border-right: none;
  }
  .sidebar--mobile-open {
    transform: translateX(0);
  }

  .mobile-close-btn {
    display: inline-flex;
  }

  .sidebar-brand {
    padding: 0 16px 20px;
  }

  .sidebar-collapse-toggle {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
  .sidebar-backdrop {
    animation: none;
  }
}
</style>
