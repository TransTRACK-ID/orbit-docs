<script setup lang="ts">
import { useActiveRoute } from "@/composables/useActiveRoute";
import { sidebarMenu } from "@/constant/sidebar";
import type { IChildSidebar, ISidebar } from "@/types/sidebar";

const { data } = useAuth();
const route = useRoute();
const { isActive } = useActiveRoute();

let menuData = reactive(sidebarMenu);

const emit = defineEmits(["on-mounted", "on-click-close-sidebar"]);

const getMenuActiveClass = (destination: string) => {
  const hover = route.path.startsWith(destination)
    ? "bg-white-50 text-primary-700 border border-primary-700"
    : "hover:bg-gray-100";
  return `py-2 px-3 space-x-3 flex items-center rounded-md transition ${hover}`;
};

const getIconMenuActive = (destination: string) => {
  return route.path.startsWith(destination)
    ? "stroke-primary-700"
    : "stroke-gray-400";
};

const getActiveClass = (route: string) => {
  return isActive(route) ? "stroke-primary-700" : "stroke-gray-400";
};

const toggleMenu = (index: number) => {
  menuData[index].isOpen = !menuData[index].isOpen;
};

watchEffect(() => {
  menuData = menuData.map((menuItem: ISidebar) => {
    if (menuItem.menu && menuItem.menu.length > 0) {
      menuItem.menu.map((subMenu: IChildSidebar) => {
        if (route.path.includes(subMenu.route)) {
          menuItem.isOpen = true;
        }
      });
    }
    return menuItem;
  });
});
</script>

<template>
  <aside
    class="w-full h-full md:w-[300px] fixed top-0 border-r overflow-y-auto py-5 px-4 z-40 bg-white transition-transform -translate-x-full md:translate-x-0"
  >
    <div class="px-3 flex items-center justify-between">
      <div class="flex items-center w-full">
        <icons-logo-order-planning-full />
      </div>
    </div>

    <div class="py-5 mt-5">
      <ul class="space-y-3">
        <li v-for="(menuItem, index) in menuData" :key="menuItem.id">
          <template v-if="menuItem.menu && menuItem.menu.length > 0">
            <button
              class="w-full flex items-center justify-between text-sm"
              :class="getMenuActiveClass(menuItem?.startWith || '')"
              @click="toggleMenu(index)"
            >
              <div class="flex items-center gap-3">
                <component
                  :is="menuItem.icon"
                  :class="getIconMenuActive(menuItem?.startWith || '')"
                />
                <span class="font-medium text-base">{{ menuItem?.label }}</span>
              </div>
              <IconsChevronDown
                :class="`
    transition-transform duration-200 stroke-gray-900
    ${menuItem.isOpen ? 'rotate-180' : ''}
    ${getIconMenuActive(menuItem?.startWith || '')}
  `"
              />
            </button>

            <ul v-show="menuItem.isOpen" class="space-y-3 mt-2">
              <li v-for="subMenuItem in menuItem.menu" :key="subMenuItem.id">
                <AppNavigationLink
                  :id="subMenuItem.id"
                  :name="subMenuItem.label"
                  :destination="subMenuItem.route"
                >
                  <template #icon>
                    <component
                      :is="subMenuItem.icon"
                      :class="getActiveClass(subMenuItem.route)"
                    />
                  </template>
                </AppNavigationLink>
              </li>
            </ul>
          </template>

          <AppNavigationLink
            v-else
            :id="menuItem.id"
            :name="menuItem.label"
            :destination="menuItem.route"
          >
            <template #icon>
              <component
                :is="menuItem.icon"
                :class="getActiveClass(menuItem.route || '')"
              />
            </template>
          </AppNavigationLink>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped></style>
