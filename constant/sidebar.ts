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
    permission: "apps:read",
  },
  {
    id: "menu__versions",
    label: "Versions",
    route: "/versions",
    icon: markRaw(IconsVersions),
    active: false,
    permission: "versions:read",
  },
  {
    id: "menu__releases",
    label: "Releases",
    route: "/releases",
    icon: markRaw(IconsReleases),
    active: false,
    permission: "releases:read",
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
  },

  {
    id: "menu__doc_sites",
    label: "Doc Sites",
    route: "/sites",
    icon: markRaw(IconsDocSites),
    active: false,
    permission: "doc_sites:read",
  },

  {
    id: "menu__api_docs",
    label: "API Docs",
    route: "/api-docs",
    icon: markRaw(IconsApiDocs),
    active: false,
    permission: "api_docs:read",
  },
  {
    id: "menu__feedback",
    label: "Feedback",
    route: "/feedback",
    icon: markRaw(IconsFeedback),
    active: false,
    permission: "feedback:read",
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
