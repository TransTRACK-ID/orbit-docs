<script setup lang="ts">
import { useAuthStore } from "~/store/auth";
import { usePageStore } from "~/store/page";
import type { ElementEvent } from "~/types/element";

const $auth = useAuthStore();
const $router = useRouter();
const $page = usePageStore();
const { data } = useAuth();

const emit = defineEmits(["on-click-open-sidebar"]);
// logout
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
    subtitle="Are you sure you want to log out? This will end your current session. Press 'Log out' to continue."
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

  <div class="w-full flex items-center justify-between">
    <div class="flex items-center">
      <!-- burger menu -->
      <GeneralIconButton
        class="block md:hidden mr-4"
        @click="emit('on-click-open-sidebar')"
      >
        <template #icon>
          <IconsMenu />
        </template>
      </GeneralIconButton>

      <slot name="header" />

      <h1 v-if="!$slots.header" class="text-2xl font-[600]">
        {{ $page.$state.title }}
      </h1>
    </div>

    <div class="flex items-center space-x-4">
      <div class="text-right">
        <p class="text-base text-black font-[600] mb-1">Test Admin</p>
        <p class="text-sm font-[400] text-gray-500">
          {{ capitalizeString("admin", "_") }}
        </p>
      </div>

      <GeneralDropdown v-if="data" id="dropdown-profile">
        <template #activator>
          <general-avatar :src="null" />
        </template>

        <template #content>
          <ul>
            <li
              class="py-2.5 px-4 flex items-center cursor-pointer hover:bg-gray-100"
              @click="$router.push('/change-password')"
            >
              <IconsSettings size="16" class="mr-2 stroke-gray-700" />
              <p class="text-sm text-gray-700">Change Password</p>
            </li>
          </ul>
          <div
            class="py-2.5 px-4 flex items-center cursor-pointer hover:bg-gray-100"
            @click="modalLogout?.show()"
          >
            <IconsLogout size="16" class="mr-2 stroke-gray-700" />
            <p class="text-sm text-gray-700">Log out</p>
          </div>
        </template>
      </GeneralDropdown>
    </div>
  </div>
</template>
