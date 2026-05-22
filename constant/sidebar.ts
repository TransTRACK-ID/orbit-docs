import { IconsBarChart, IconsBell, IconsEye, IconsApps } from "#components";
import type { ISidebar } from "@/types/sidebar";
import { markRaw } from "vue";

export const sidebarMenu: ISidebar[] = [
  {
    id: "menu__apps",
    label: "Apps",
    route: "/apps",
    icon: markRaw(IconsApps),
    active: false,
  },
  {
    id: "menu__dashboard",
    label: "Dashboard",
    route: "/dashboard",
    icon: markRaw(IconsBarChart),
    active: false,
  },
  {
    label: "Users",
    icon: markRaw(IconsBell),
    id: "menu__users",
    startWith: "/users",
    isOpen: false,
    menu: [
      {
        label: "Sub Users 1",
        id: "menu__users-users",
        route: "/users",
        icon: markRaw(IconsEye),
        active: false,
      },
      {
        label: "Admin",
        route: "/users/admin",
        id: "menu__users-admin",
        icon: markRaw(IconsEye),
        active: false,
      },
    ],
  },
];
