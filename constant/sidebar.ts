import {
  IconsApps,
  IconsVersions,
  IconsReleases,
  IconsChangelogs,
  IconsDocEditor,
  IconsApiDocs,
  IconsFeedback,
  IconsSettings,
  IconsDocSites,
  IconsUser,
} from "#components";
import type { ISidebar, SidebarGroupId } from "@/types/sidebar";
import { markRaw } from "vue";

export const sidebarGroups: { id: SidebarGroupId; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "publishing", label: "Publishing" },
  { id: "admin", label: "Admin" },
];

export const sidebarMenu: ISidebar[] = [
  {
    id: "menu__apps",
    label: "Apps",
    route: "/apps",
    icon: markRaw(IconsApps),
    active: false,
    permission: "apps:read",
    group: "content",
  },
  {
    id: "menu__versions",
    label: "Versions",
    route: "/versions",
    icon: markRaw(IconsVersions),
    active: false,
    permission: "versions:read",
    group: "content",
  },
  {
    id: "menu__releases",
    label: "Releases",
    route: "/releases",
    icon: markRaw(IconsReleases),
    active: false,
    permission: "releases:read",
    group: "content",
  },
  {
    id: "menu__changelogs",
    label: "Changelogs",
    route: "/changelogs",
    icon: markRaw(IconsChangelogs),
    active: false,
    permission: "changelogs:read",
  },
  {
    id: "menu__docs",
    label: "Docs",
    route: "/docs",
    icon: markRaw(IconsDocEditor),
    active: false,
    permission: "docs:read",
    group: "content",
  },

  {
    id: "menu__doc_sites",
    label: "Doc Sites",
    route: "/sites",
    icon: markRaw(IconsDocSites),
    active: false,
    permission: "doc_sites:read",
    group: "publishing",
  },

  {
    id: "menu__api_docs",
    label: "API Docs",
    route: "/api-docs",
    icon: markRaw(IconsApiDocs),
    active: false,
    permission: "api_docs:read",
    group: "publishing",
  },
  {
    id: "menu__feedback",
    label: "Feedback",
    route: "/feedback",
    icon: markRaw(IconsFeedback),
    active: false,
    permission: "feedback:read",
    group: "admin",
  },
  {
    id: "menu__owners",
    label: "Owners",
    route: "/owners",
    icon: markRaw(IconsUser),
    active: false,
    permission: "owners:read",
    group: "admin",
  },
  {
    id: "menu__settings",
    label: "Settings",
    route: "/settings",
    icon: markRaw(IconsSettings),
    active: false,
    permission: "settings:read",
  },
];
