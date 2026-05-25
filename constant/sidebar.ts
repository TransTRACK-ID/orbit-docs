import {
  IconsApps,
  IconsVersions,
  IconsReleases,
  IconsChangelogs,
  IconsDocEditor,
  IconsPublishedDocs,
  IconsEmbedDocs,
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
    id: "menu__doc_editor",
    label: "Doc Editor",
    route: "/docs-editor",
    icon: markRaw(IconsDocEditor),
    active: false,
  },
  {
    id: "menu__published_docs",
    label: "Published Docs",
    route: "/docs-viewer",
    icon: markRaw(IconsPublishedDocs),
    active: false,
  },
  {
    id: "menu__embed_docs",
    label: "Embed Docs",
    route: "/embed-docs",
    icon: markRaw(IconsEmbedDocs),
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
