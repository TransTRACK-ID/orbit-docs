<script setup lang="ts">
import { useAuthStore } from "~/store/auth";
import type { ElementEvent } from "~/types/element";

const props = defineProps<{
  title?: string;
}>();

const $auth = useAuthStore();
const $router = useRouter();
const { data } = useAuth();

const user = computed(() => {
  const d = data.value as any;
  return d?.data?.user || d?.user || null;
});

const userName = computed(() => user.value?.name || "");
const userEmail = computed(() => user.value?.email || "");
const userInitials = computed(() => {
  if (!userName.value) return "";
  return userName.value
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

let modalLogout: ElementEvent | null = null;
async function logout() {
  await $auth.logout();
}
</script>

<template>
  <GeneralModalConfirmation
    id="modal-logout"
    title="Confirm Logout"
    subtitle="Are you sure you want to log out? This will end your current session."
    confirm-label="Log Out"
    :is-loading="$auth.isLoading"
    @mounted="modalLogout = $event"
    @negative="modalLogout?.hide()"
    @positive="logout()"
  >
    <template #icon>
      <IconsInfo class="stroke-red-500" size="32" />
    </template>
  </GeneralModalConfirmation>

  <header class="topbar">
    <h1>{{ props.title }}</h1>
    <div class="topbar-actions">
      <slot name="actions" />
      <GeneralDropdown v-if="data" id="dropdown-profile">
        <template #activator>
          <button class="profile-btn" aria-label="Open user menu">
            <general-avatar :src="null" :size="28" :name="userName" />
          </button>
        </template>
        <template #content>
          <div class="dropdown-header">
            <general-avatar :src="null" :size="36" :name="userName" />
            <div class="dropdown-header-info">
              <div v-if="userName" class="dropdown-name">{{ userName }}</div>
              <div v-if="userEmail" class="dropdown-email">{{ userEmail }}</div>
            </div>
          </div>
          <ul class="dropdown-menu">
            <li class="dropdown-item" @click="$router.push('/change-password')">
              <IconsSettings size="16" />
              <span>Change Password</span>
            </li>
            <li class="dropdown-item text-[var(--od-error)]" @click="modalLogout?.show()">
              <IconsLogout size="16" class="stroke-[var(--od-error)]" />
              <span>Log out</span>
            </li>
          </ul>
        </template>
      </GeneralDropdown>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: var(--surface, oklch(100% 0 0));
  border-bottom: 1px solid var(--border, oklch(90% 0.006 250));
}
.topbar h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--fg, oklch(20% 0.02 250));
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
}
.profile-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border, oklch(90% 0.006 250));
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: border-color .15s;
  overflow: hidden;
}
.profile-btn:hover {
  border-color: var(--fg, oklch(20% 0.02 250));
}
.dropdown-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--border, oklch(90% 0.006 250));
}
.dropdown-header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dropdown-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg, oklch(20% 0.02 250));
}
.dropdown-email {
  font-size: 12px;
  color: var(--muted, oklch(55% 0.015 250));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropdown-menu {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  min-width: 200px;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--fg, oklch(20% 0.02 250));
  cursor: pointer;
  transition: background .1s;
}
.dropdown-item:hover {
  background: var(--fg-soft, color-mix(in oklch, oklch(20% 0.02 250) 6%, transparent));
}
</style>
