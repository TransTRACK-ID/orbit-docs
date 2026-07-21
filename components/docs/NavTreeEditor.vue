<script setup lang="ts">
import type { NavConfig, NavGroup, NavExternalLink } from "~/server/database/schema";

const props = defineProps<{
  modelValue: NavConfig;
  pages: Array<{ id: string; title: string; slug: string | null; status: string; frontmatter?: Record<string, unknown> | null }>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: NavConfig): void;
}>);

const config = ref<NavConfig>(clone(props.modelValue || { groups: [], pages: [], external: [] }));

watch(
  () => props.modelValue,
  (val) => {
    config.value = clone(val || { groups: [], pages: [], external: [] });
  },
  { deep: true },
);

watch(
  config,
  (val) => emit("update:modelValue", clone(val)),
  { deep: true },
);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

const pageOptions = computed(() =>
  props.pages
    .filter((p) => !!p.slug)
    .map((p) => ({
      slug: p.slug as string,
      title: p.title,
      status: p.status,
      sidebarTitle:
        (p.frontmatter as Record<string, unknown> | null | undefined)?.sidebarTitle as
          | string
          | undefined,
      hidden: (p.frontmatter as Record<string, unknown> | null | undefined)?.hidden === true,
    })),
);

const pageLabel = (slug: string) => {
  const p = pageOptions.value.find((o) => o.slug === slug);
  if (!p) return slug;
  return p.sidebarTitle ? `${p.sidebarTitle} (${p.title})` : p.title;
};

function addPage() {
  config.value.pages = [...(config.value.pages || []), ""];
}
function removePage(index: number) {
  config.value.pages = (config.value.pages || []).filter((_, i) => i !== index);
}
function movePage(index: number, dir: -1 | 1) {
  const arr = [...(config.value.pages || [])];
  const target = index + dir;
  if (target < 0 || target >= arr.length) return;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  config.value.pages = arr;
}

function addGroup() {
  config.value.groups = [...(config.value.groups || []), { id: crypto.randomUUID(), label: "New group", pages: [] }];
}
function removeGroup(index: number) {
  config.value.groups = (config.value.groups || []).filter((_, i) => i !== index);
}
function moveGroup(index: number, dir: -1 | 1) {
  const arr = [...(config.value.groups || [])];
  const target = index + dir;
  if (target < 0 || target >= arr.length) return;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  config.value.groups = arr;
}

function addGroupPage(group: NavGroup) {
  group.pages = [...(group.pages || []), ""];
}
function removeGroupPage(group: NavGroup, index: number) {
  group.pages = (group.pages || []).filter((_, i) => i !== index);
}
function moveGroupPage(group: NavGroup, index: number, dir: -1 | 1) {
  const arr = [...(group.pages || [])];
  const target = index + dir;
  if (target < 0 || target >= arr.length) return;
  [arr[index], arr[target]] = [arr[target], arr[index]];
  group.pages = arr;
}

function addExternal() {
  config.value.external = [
    ...(config.value.external || []),
    { id: crypto.randomUUID(), label: "External link", url: "https://" },
  ];
}
function removeExternal(index: number) {
  config.value.external = (config.value.external || []).filter((_, i) => i !== index);
}

function isMissing(slug: string) {
  return !!slug && !pageOptions.value.some((p) => p.slug === slug);
}
</script>

<template>
  <div class="nav-editor">
    <div class="nav-section">
      <div class="nav-section-header">
        <span class="nav-section-label">Top-level pages</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="addPage">+ Add page</button>
      </div>
      <div v-if="(config.pages || []).length === 0" class="nav-empty">No top-level pages.</div>
      <div
        v-for="(slug, idx) in config.pages || []"
        :key="`p-${idx}`"
        class="nav-row"
      >
        <select v-model="config.pages![idx]" class="select">
          <option value="">— select a page —</option>
          <option v-for="p in pageOptions" :key="p.slug" :value="p.slug">
            {{ p.title }} ({{ p.status }})
          </option>
        </select>
        <span v-if="slug && isMissing(slug)" class="nav-warn">missing page</span>
        <div class="nav-row-actions">
          <button type="button" class="icon-btn" :disabled="idx === 0" @click="movePage(idx, -1)">↑</button>
          <button type="button" class="icon-btn" :disabled="idx === (config.pages || []).length - 1" @click="movePage(idx, 1)">↓</button>
          <button type="button" class="icon-btn danger" @click="removePage(idx)">✕</button>
        </div>
      </div>
    </div>

    <div class="nav-section">
      <div class="nav-section-header">
        <span class="nav-section-label">Groups</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="addGroup">+ Add group</button>
      </div>
      <div v-if="(config.groups || []).length === 0" class="nav-empty">No groups.</div>
      <div
        v-for="(group, gIdx) in config.groups || []"
        :key="group.id"
        class="group-block"
      >
        <div class="group-header">
          <input v-model="group.label" class="input group-label-input" placeholder="Group label" />
          <input v-model="group.icon" class="input group-icon-input" placeholder="icon (optional)" />
          <label class="group-expanded-toggle">
            <input v-model="group.expanded" type="checkbox" /> expanded
          </label>
          <div class="nav-row-actions">
            <button type="button" class="icon-btn" :disabled="gIdx === 0" @click="moveGroup(gIdx, -1)">↑</button>
            <button type="button" class="icon-btn" :disabled="gIdx === (config.groups || []).length - 1" @click="moveGroup(gIdx, 1)">↓</button>
            <button type="button" class="icon-btn danger" @click="removeGroup(gIdx)">✕</button>
          </div>
        </div>
        <div class="group-pages">
          <div
            v-for="(slug, pIdx) in group.pages || []"
            :key="`gp-${pIdx}`"
            class="nav-row indented"
          >
            <select v-model="group.pages![pIdx]" class="select">
              <option value="">— select a page —</option>
              <option v-for="p in pageOptions" :key="p.slug" :value="p.slug">
                {{ p.title }} ({{ p.status }})
              </option>
            </select>
            <span v-if="slug && isMissing(slug)" class="nav-warn">missing page</span>
            <div class="nav-row-actions">
              <button type="button" class="icon-btn" :disabled="pIdx === 0" @click="moveGroupPage(group, pIdx, -1)">↑</button>
              <button type="button" class="icon-btn" :disabled="pIdx === (group.pages || []).length - 1" @click="moveGroupPage(group, pIdx, 1)">↓</button>
              <button type="button" class="icon-btn danger" @click="removeGroupPage(group, pIdx)">✕</button>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" @click="addGroupPage(group)">+ Add page to group</button>
        </div>
      </div>
    </div>

    <div class="nav-section">
      <div class="nav-section-header">
        <span class="nav-section-label">External links</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="addExternal">+ Add link</button>
      </div>
      <div v-if="(config.external || []).length === 0" class="nav-empty">No external links.</div>
      <div
        v-for="(link, idx) in config.external || []"
        :key="link.id"
        class="nav-row"
      >
        <input v-model="link.label" class="input" placeholder="Label" />
        <input v-model="link.url" class="input" placeholder="https://" />
        <div class="nav-row-actions">
          <button type="button" class="icon-btn danger" @click="removeExternal(idx)">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>
