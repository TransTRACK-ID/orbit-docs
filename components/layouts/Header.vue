<script setup lang="ts">
import { useAuthStore } from "~/store/auth";
import type { ElementEvent } from "~/types/element";

const props = defineProps<{
  title?: string;
}>();

const $auth = useAuthStore();
const $router = useRouter();
const { data } = useAuth();

let modalLogout: ElementEvent | null = null;
async function logout() {
  $auth.logout().then(() => {
    window.location.href = "/login";
  });
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
            <general-avatar :src="null" size="28" />
          </button>
        </template>
        <template #content>
          <ul class="dropdown-menu">
            <li class="dropdown-item" @click="$router.push('/change-password')">
              <IconsSettings size="16" />
              <span>Change Password</span>
            </li>
            <li class="dropdown-item" @click="modalLogout?.show()">
              <IconsLogout size="16" />
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
}
.profile-btn:hover {
  border-color: var(--fg, oklch(20% 0.02 250));
}
.dropdown-menu {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  min-width: 180px;
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
