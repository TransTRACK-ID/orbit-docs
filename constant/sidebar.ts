import {
  IconsApps,
  IconsVersions,
  IconsReleases,
  IconsChangelogs,
  IconsDocEditor,
  IconsApiDocs,
  IconsSettings,
} from "#components";
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
    id: "menu__versions",
    label: "Versions",
    route: "/versions",
    icon: markRaw(IconsVersions),
    active: false,
  },
  {
    id: "menu__releases",
    label: "Releases",
    route: "/releases",
    icon: markRaw(IconsReleases),
    active: false,
  },
  {
    id: "menu__changelogs",
    label: "Changelogs",
    route: "/changelogs",
    icon: markRaw(IconsChangelogs),
    active: false,
  },
  {
    id: "menu__docs",
    label: "Docs",
    route: "/docs",
    icon: markRaw(IconsDocEditor),
    active: false,
  },
  {
    id: "menu__api_docs",
    label: "API Docs",
    route: "/api-docs",
    icon: markRaw(IconsApiDocs),
    active: false,
  },
  {
    id: "menu__settings",
    label: "Settings",
    route: "/settings",
    icon: markRaw(IconsSettings),
    active: false,
  },
];
